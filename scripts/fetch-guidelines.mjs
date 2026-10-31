#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  Загрузчик зеркала клинических рекомендаций Минздрава.
//
//  Запуск:  docker compose exec app npm run fetch-guidelines -- [--limit N] [--force] [--dry-run]
//  (локально — npm run fetch-guidelines, нужны POSTGREST_URL и POSTGREST_JWT_SECRET)
//
//    --limit N   взять только N документов (для проверки на живом API)
//    --force     перекачать даже те, что уже лежат в базе
//    --dry-run   ничего не писать в базу, только показать план
//
//  Полный обход — 750 документов, ~1,13 ГБ, около 1,8 часа с паузой 1,5 с.
//  Инкрементально (обычный еженедельный прогон) — единицы документов: поток
//  обновлений порядка 10–15 в месяц.
//
//  Вежливость к чужому сервису здесь не формальность. Рубрикатор отдаёт
//  документ медленно (медиана 4,8 с, p90 20 с), троттлинга мы не увидели, но
//  короткая серия — не доказательство его отсутствия. Поэтому: честный
//  User-Agent с контактом, пауза между запросами, остановка на первой же
//  серии ошибок.
// ════════════════════════════════════════════════════════════════════════════
import dotenv from 'dotenv';
import { createDb } from '../src/server/db.ts';
import { pathToFileURL } from 'url';

dotenv.config();

const API = 'https://apicr.minzdrav.gov.ru/api.ashx?op=';
const HEADERS = {
  'Origin': 'https://cr.minzdrav.gov.ru',
  'Referer': 'https://cr.minzdrav.gov.ru/',
  // Только ASCII: HTTP-заголовок — ByteString, кириллица здесь роняет fetch.
  'User-Agent': process.env.GUIDELINES_USER_AGENT || 'MedScribe-OSS/0.1 (self-hosted clinical guidelines mirror)',
};
const DELAY_MS = 1500;
const DOC_TIMEOUT_MS = 60_000;

// Раздел «Список литературы» в индекс не идёт: медианно это 34 тысячи знаков,
// то есть треть полезного объёма документа, а цитируем мы саму рекомендацию,
// а не её источники.
const SKIP_SECTIONS = new Set(['doc_bible']);
// Разделы, приходящие одним куском с подзаголовками внутри. Остальные уже
// нарезаны самим рубрикатором.
const SPLIT_SECTIONS = new Set(['doc_3', 'doc_g']);

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const LIMIT = num('--limit', Infinity);
const FORCE = has('--force');
const DRY = has('--dry-run');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── разбор HTML ─────────────────────────────────────────────────────────────

// Картинки вшиты в HTML как data:image;base64 и составляют 70–87 % байт
// документа. В индексе им делать нечего.
// Картинку не просто обесточиваем, а заменяем видимой пометкой: пустой <img>
// без src — это либо иконка «битое изображение», либо ничего, и врач не узнает,
// что в этом месте документа был рисунок. Он о нём должен знать: рядом есть
// ссылка на оригинал.
const IMG_TAG = /<img\b[^>]*\bsrc="data:[^"]*"[^>]*>/gi;
const DATA_URI = /\s(?:src|href)="data:[^"]*"/gi;
const FIGURE_MARK = '[рисунок — см. оригинал]';
const stripImages = (html) => html
  .replace(IMG_TAG, `<span class="cr-figure">${FIGURE_MARK}</span>`)
  .replace(DATA_URI, ' data-stripped="1"');

// «Пусто ли по существу». Считать надо БЕЗ пометок о рисунках: иначе раздел из
// трёх сканов набирает 70 знаков пометок и перестаёт выглядеть пустым, хотя
// читать в нём по-прежнему нечего.
const bodyLength = (plain) => plain.split(FIGURE_MARK).join('').trim().length;

// Разметка приходит из чужого сервиса, а показывать её мы будем в странице
// врача. Чистим один раз здесь, на входе в базу, а не при каждом рендере:
// так у отравленного фрагмента нет ни одного шанса дожить до браузера, даже
// если завтра появится второй потребитель этих данных.
const sanitizeHtml = (html) => html
  .replace(/<(script|style|iframe|object|embed|form|link|meta)[\s\S]*?<\/\1>/gi, '')
  .replace(/<(script|style|iframe|object|embed|form|link|meta)[^>]*\/?>/gi, '')
  // Обработчики событий: on*="…" / on*='…' / on*=без кавычек.
  .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/\s(?:href|src|action|formaction)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, '');

const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&laquo;': '«', '&raquo;': '»', '&mdash;': '—', '&ndash;': '–',
};
function decodeEntities(s) {
  return s
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|laquo|raquo|mdash|ndash);/g, m => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

// Плоский текст. Таблицы схлопываются в строки с разделителем ' | ' — иначе
// ячейки слипаются и получается нечитаемая каша, а таблиц в рекомендациях
// много (до 11 на документ).
function htmlToPlain(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(td|th)>/gi, ' | ')
      .replace(/<\/(tr|p|div|li|h[1-6])>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// УУР/УДД идут прямо в тексте тезиса, отдельного поля в API нет. Буквы уровня
// в источнике встречаются и латиницей, и кириллицей — на вид не отличить.
// Формулировка гуляет от документа к документу: «рекомендаций» и
// «рекомендации», разделитель то скобка, то точка с запятой, тире то есть, то
// нет, буква уровня то латиницей, то кириллицей (на вид не отличить).
const GRADE_RE = /Уровень\s+убедительности\s+рекомендаци[йи]\s*[–—:-]?\s*([ABCDEАВСЕ])\s*[;(]?\s*уровень\s+достоверности\s+доказательств\s*[–—:-]?\s*(\d)/gi;
const GRADE_MENTION_RE = /Уровень\s+убедительности\s+рекомендаци[йи]/gi;
function extractGrades(plain) {
  const uur = [], udd = [];
  for (const m of plain.matchAll(GRADE_RE)) { uur.push(m[1].toUpperCase()); udd.push(m[2]); }
  return { uur, udd };
}

// Дорезка doc_3 / doc_g по заголовкам h1/h2. Заголовок остаётся с куском,
// который он открывает; текст до первого заголовка — вводная часть, part 0.
function splitByHeadings(html, fallbackTitle) {
  const re = /<h([12])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const marks = [];
  for (const m of html.matchAll(re)) {
    marks.push({ at: m.index, title: htmlToPlain(m[2]).replace(/\s+/g, ' ').trim() });
  }
  if (marks.length === 0) return [{ title: fallbackTitle, html }];

  const out = [];
  if (marks[0].at > 0) {
    const lead = html.slice(0, marks[0].at);
    if (htmlToPlain(lead).length > 40) out.push({ title: fallbackTitle, html: lead });
  }
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].at : html.length;
    out.push({ title: marks[i].title || fallbackTitle, html: html.slice(marks[i].at, end) });
  }
  return out;
}

// ── API ─────────────────────────────────────────────────────────────────────

async function listApplied() {
  // status/value1=0 — это статус жизненного цикла записи, а НЕ статус
  // применения: без фильтра приходит 1838 записей, включая черновики и
  // тестовые. С ним — ровно 750, все с apply_status_calculated = 1.
  const payload = {
    filters: [{ fieldName: 'status', filterType: 1, filterValueType: 2, value1: 0, value2: '', values: [] }],
    sortOption: { fieldName: 'publishdate', sortType: 2 },
    currentPage: 1, pageSize: 1000,
  };
  const r = await fetch(API + 'GetJsonClinrecsFilterV2', {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`GetJsonClinrecsFilterV2 ${r.status}`);
  const data = await r.json();
  return { total: data.TotalRecords, rows: data.Data || [] };
}

async function fetchDoc(codeVersion) {
  const r = await fetch(`${API}GetClinrec2&id=${encodeURIComponent(codeVersion)}&ssid=null`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(DOC_TIMEOUT_MS),
  });
  // Несуществующий id рубрикатор отдаёт как 403 «Invalid argument: ssid», а не
  // как 404. Это не бан — не надо принимать его за блокировку и уходить в
  // долгий backoff.
  if (!r.ok) throw new Error(`GetClinrec2 ${codeVersion} → ${r.status}`);
  return r.json();
}

// ── преобразование документа в строки ───────────────────────────────────────

function toRows(listRow, doc) {
  const codeVersion = listRow.CodeVersion;
  const document = {
    code_version: codeVersion,
    code: String(doc.code ?? listRow.Code ?? '').trim(),
    version: Number(doc.version ?? listRow.Version ?? 1),
    name: doc.name || listRow.Name || '',
    publish_date: doc.publish_date || listRow.PublishDateStr || null,
    age_category: listRow.AgeCategory ?? null,
    age_label: listRow.AgeCategoryStr || null,
    adult: !!doc.adult,
    child: !!doc.child,
    mkb_codes: (listRow.Mkbs || []).map(m => m.MkbCode).filter(Boolean),
    developers: (listRow.Developers || []).map(d => d.NkoName).filter(Boolean),
    npc_approved: !!(doc.NPC_approved ?? listRow.NPC_approved),
    template_ver: Number(doc.ver ?? 2),
    source_url: `https://cr.minzdrav.gov.ru/preview-cr/${codeVersion}`,
    fetched_at: new Date().toISOString(),
  };

  const sections = [];
  let ord = 0;
  for (const s of doc?.obj?.sections || []) {
    // donotsearch=true стоит ровно у doc_whole и doc_title и больше ни у кого.
    // doc_whole — не аккуратный дубль документа, а мусор: где-то 90 % от
    // остального текста, где-то 11 символов, и найти в нём фрагмент из doc_3
    // нельзя. Это готовый машинный фильтр, пользуемся им.
    if (s.donotsearch) continue;
    if (SKIP_SECTIONS.has(s.id)) continue;
    const src = s.content || '';
    const raw = sanitizeHtml(stripImages(src));
    const hasImages = /data:image\//i.test(src);
    if (bodyLength(htmlToPlain(raw)) < 40) {
      // Пустой контейнер-заголовок — пропускаем. А вот раздел, из которого
      // после вырезания картинок ничего не осталось, — это скан: он в
      // документе ЕСТЬ, и врач должен об этом узнать.
      if (!hasImages) continue;
      sections.push({
        code_version: codeVersion, section_id: s.id, part: 0, ord: ord++,
        title: s.title || s.id, html: raw, plain: htmlToPlain(raw),
        char_len: 0, uur: [], udd: [], image_only: true,
      });
      continue;
    }

    const parts = SPLIT_SECTIONS.has(s.id)
      ? splitByHeadings(raw, s.title || s.id)
      : [{ title: s.title || s.id, html: raw }];

    parts.forEach((p, i) => {
      const plain = htmlToPlain(p.html);
      if (bodyLength(plain) < 40) return;
      const { uur, udd } = extractGrades(plain);
      sections.push({
        code_version: codeVersion,
        section_id: s.id,
        part: i,
        ord: ord++,
        title: p.title,
        html: p.html,
        plain,
        char_len: plain.length,
        uur, udd,
        image_only: false,
      });
    });
  }
  return { document, sections };
}

// ── запись ──────────────────────────────────────────────────────────────────

async function save(db, document, sections) {
  const { error: de } = await db.from('guideline_documents').upsert(document, { onConflict: 'code_version' });
  if (de) throw new Error(`upsert документа: ${de.message}`);
  const { error: xe } = await db.from('guideline_sections').delete().eq('code_version', document.code_version);
  if (xe) throw new Error(`очистка разделов: ${xe.message}`);

  // Раздел может весить сотни килобайт, поэтому батчим по объёму, а не по
  // числу строк.
  let batch = [], bytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    const { error } = await db.from('guideline_sections').insert(batch);
    if (error) throw new Error(`вставка разделов: ${error.message}`);
    batch = []; bytes = 0;
  };
  for (const s of sections) {
    const size = s.html.length + s.plain.length;
    if (bytes + size > 2_000_000) await flush();
    batch.push(s); bytes += size;
  }
  await flush();
}

// ── основной ход ────────────────────────────────────────────────────────────

async function main() {
  const db = DRY ? null : createDb();

  process.stdout.write('Список действующих рекомендаций… ');
  const t0 = Date.now();
  const { total, rows } = await listApplied();
  console.log(`${rows.length} из ${total}, ${Date.now() - t0} мс`);
  if (rows.length !== total) console.warn(`⚠ пришло меньше, чем заявлено (${rows.length} < ${total})`);

  let known = new Set();
  if (db && !FORCE) {
    const { data, error } = await db.from('guideline_documents').select('code_version');
    if (error) throw new Error(`чтение базы: ${error.message}`);
    known = new Set((data || []).map(r => r.code_version));
  }

  const live = new Set(rows.map(r => r.CodeVersion));
  const retired = [...known].filter(cv => !live.has(cv));
  const todo = rows.filter(r => FORCE || !known.has(r.CodeVersion)).slice(0, LIMIT);

  console.log(`в базе: ${known.size}, к загрузке: ${todo.length}, вышло из применения: ${retired.length}`);
  if (DRY) {
    console.log('--dry-run: ничего не пишем.');
    todo.slice(0, 10).forEach(r => console.log(`  ${r.CodeVersion}  ${r.Name.slice(0, 70)}`));
    if (todo.length > 10) console.log(`  … и ещё ${todo.length - 10}`);
    return;
  }

  // Редакция = новый code_version, а не правка старой записи. Мы храним ровно
  // «то, что применяется сейчас»: сослаться при проверке ОМС на отменённую
  // рекомендацию хуже, чем не сослаться вовсе. Прежняя редакция остаётся
  // доступной у рубрикатора по старому id, если понадобится сравнить.
  if (retired.length) {
    const { error } = await db.from('guideline_documents').delete().in('code_version', retired);
    if (error) throw new Error(`удаление вышедших из применения: ${error.message}`);
    console.log(`удалено вышедших из применения: ${retired.length}`);
  }

  let ok = 0, failed = 0, chars = 0, streak = 0;
  for (const [i, row] of todo.entries()) {
    const cv = row.CodeVersion;
    const t = Date.now();
    try {
      const doc = await fetchDoc(cv);
      const { document, sections } = toRows(row, doc);
      await save(db, document, sections);
      const size = sections.reduce((a, s) => a + s.char_len, 0);
      chars += size; ok++; streak = 0;
      console.log(`[${i + 1}/${todo.length}] ${cv}  разделов ${String(sections.length).padStart(3)}  ${String(Math.round(size / 1000)).padStart(4)} тыс. знаков  ${Date.now() - t} мс  ${document.name.slice(0, 45)}`);
    } catch (e) {
      failed++; streak++;
      console.error(`[${i + 1}/${todo.length}] ${cv}  ОШИБКА: ${e.message}`);
      // Три подряд — это уже не случайность, а либо мы уткнулись в лимит, либо
      // сервис лёг. Продолжать долбить в обоих случаях неправильно.
      if (streak >= 3) { console.error('Три ошибки подряд — останавливаюсь.'); break; }
    }
    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nготово: ${ok}, ошибок: ${failed}, текста ${(chars / 1e6).toFixed(1)} млн знаков, ${Math.round((Date.now() - t0) / 1000)} с`);
}

// Разбор вынесен наружу, чтобы его можно было прогнать на сохранённых
// документах без обращения к сети.
export { stripImages, sanitizeHtml, htmlToPlain, splitByHeadings, extractGrades, toRows, GRADE_MENTION_RE };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
