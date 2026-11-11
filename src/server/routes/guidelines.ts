import express from "express";
import { parseCriteria } from "../../utils/guidelineCriteria";
import { db } from "../context";
import { rateLimit } from "../middleware/rateLimit";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";

// ── Клинические рекомендации Минздрава по коду МКБ-10 ─────────────────────
//
// Это СПРАВОЧНЫЙ запрос, а не генерация. Модель здесь не участвует вовсе, и
// поэтому выдуманной ссылки быть не может: и название, и номер версии, и URL
// приходят из рубрикатора. Врачу при проверке ОМС нужен именно проверяемый
// документ, а не пересказ по памяти языковой модели.
//
// 152-ФЗ: наружу уходит ТОЛЬКО код МКБ-10. Ни стенограммы, ни протокола, ни
// чего-либо, что относится к пациенту. Внешние вызовы есть и в других местах:
// к языковой модели (LLM_BASE_URL — куда уходит текст приёма, выбирает оператор
// и отвечает за него сам). Здесь же
// персональных данных нет вообще.
const CR_API = 'https://apicr.minzdrav.gov.ru/api.ashx?op=';
const CR_HEADERS = { 'Origin': 'https://cr.minzdrav.gov.ru', 'Referer': 'https://cr.minzdrav.gov.ru/' };
// 0 — не применяется, 1 — применяется, 2 — применение отложено,
// 3 — применяется в предыдущей редакции.
const CR_APPLY_STATUS: Record<number, string> = {
  0: 'не применяется', 1: 'применяется',
  2: 'применение отложено', 3: 'применяется в предыдущей редакции',
};
// Формат кода МКБ-10: буква, две цифры, необязательный подрубрикатор.
const MKB_CODE_RE = /^[A-Z]\d{2}(\.\d{1,2})?$/;

// Дерево МКБ рубрикатора (код → внутренний Id) — фильтровать можно только по
// Id. Около 3 МБ, тянется один раз за жизнь процесса.
let mkbIndex: Map<string, number> | null = null;
let mkbLoading: Promise<Map<string, number>> | null = null;
async function loadMkbIndex(): Promise<Map<string, number>> {
  if (mkbIndex) return mkbIndex;
  if (mkbLoading) return mkbLoading;
  mkbLoading = (async () => {
    const r = await fetch(CR_API + 'GetMkbRefList', { headers: CR_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`GetMkbRefList ${r.status}`);
    const nodes = await r.json() as any[];
    const idx = new Map<string, number>();
    for (const n of nodes) {
      const c = (n?.Code || '').trim().toUpperCase();
      if (c && !idx.has(c)) idx.set(c, n.Id);
    }
    mkbIndex = idx;
    return idx;
  })();
  try { return await mkbLoading; } finally { mkbLoading = null; }
}

// Рекомендации меняются раз в годы, а не в минуты: сутки кэша убирают
// задержку в полсекунды на каждое открытие вкладки и снимают нагрузку с
// чужого сервиса, который нам ничего не должен.
const crCache = new Map<string, { at: number; items: any[] }>();
const CR_TTL = 24 * 60 * 60 * 1000;

// Лимит свой, отдельно от ИИ: справочник дёргается при каждом выборе кода
// МКБ, но за ним стоит чужой сервис, который нам ничего не должен.
const guidelinesRateLimit = rateLimit(30, 60 * 1000);

// ── Зеркало корпуса ───────────────────────────────────────────────────────
//
// Список документов (750 строк) держим целиком в памяти: он нужен на каждый
// выбор кода МКБ, а гонять фильтр по перекрытию массивов в Postgres ради
// 750 строк незачем. Тексты разделов, разумеется, тянутся по требованию.
type MirrorDoc = {
  code_version: string; code: string; name: string; publish_date: string | null;
  age_label: string | null; mkb_codes: string[]; developers: string[];
  npc_approved: boolean; template_ver: number;
};
const MIRROR_FIELDS = 'code_version, code, name, publish_date, age_label, mkb_codes, developers, npc_approved, template_ver';
const MIRROR_TTL = 60 * 60 * 1000;
let mirror: MirrorDoc[] | null = null;
let mirrorAt = 0;

async function loadMirror(): Promise<MirrorDoc[]> {
  if (mirror && Date.now() - mirrorAt < MIRROR_TTL) return mirror;
  const { data, error } = await db.from('guideline_documents').select(MIRROR_FIELDS);
  if (error) throw new Error(error.message);
  mirror = (data || []) as MirrorDoc[];
  mirrorAt = Date.now();
  return mirror;
}

// Совпадение в обе стороны. Врач выбрал G43.0 — рекомендация с тегом G43
// подходит; выбрал G43 — подходит и помеченная G43.1. Рубрикатор умеет
// искать только вниз по дереву, но врачу нужны оба направления: коды в карте
// бывают и точнее, и грубее, чем разметка документа.
const mkbMatches = (tag: string, code: string) =>
  tag === code || tag.startsWith(code + '.') || code.startsWith(tag + '.');

const mirrorItem = (d: MirrorDoc) => ({
  title: d.name,
  year: (d.publish_date || '').slice(0, 4) || null,
  // В зеркале лежат только применяемые редакции — так задуман загрузчик:
  // вышедшие из применения он удаляет. Поэтому статус здесь константа, а не
  // забытое поле.
  applyStatus: 'применяется',
  approvedByNpc: !!d.npc_approved,
  docId: d.code_version,
  age: d.age_label,
  mkb: (d.mkb_codes || []).slice(0, 8),
  developers: d.developers || [],
  url: `https://cr.minzdrav.gov.ru/preview-cr/${d.code_version}`,
});

// Запасной путь: пока зеркало не залито (или база недоступна) — идём в
// рубрикатор напрямую, как раньше. Медленнее и без текста разделов, но
// список врач всё равно увидит.
async function fetchFromRubricator(code: string) {
  const idx = await loadMkbIndex();
  const ids: number[] = [];
  for (const [c, id] of idx) if (c === code || c.startsWith(code + '.')) ids.push(id);
  if (ids.length === 0) return null;

  const payload = {
    filters: [
      { fieldName: 'status', filterType: 1, filterValueType: 2, value1: 0, value2: '', values: [] },
      { fieldName: 'mkbid', filterType: 1, filterValueType: 1, value1: ids[0], value2: '', values: ids },
    ],
    sortOption: { fieldName: 'publishdate', sortType: 2 },
    currentPage: 1, pageSize: 10,
  };
  const r = await fetch(CR_API + 'GetJsonClinrecsFilterV2', {
    method: 'POST',
    headers: { ...CR_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`GetJsonClinrecsFilterV2 ${r.status}`);
  const data = await r.json() as any;
  return (data?.Data || []).map((x: any) => ({
    title: x.Name,
    year: (x.PublishDateStr || '').slice(0, 4) || null,
    applyStatus: CR_APPLY_STATUS[x.ApplyStatusCalculated] ?? '—',
    approvedByNpc: !!x.NPC_approved,
    docId: x.CodeVersion,
    age: x.AgeCategoryStr || null,
    mkb: (x.Mkbs || []).map((m: any) => m.MkbCode).filter(Boolean).slice(0, 8),
    developers: (x.Developers || []).map((d: any) => d.NkoName).filter(Boolean),
    url: `https://cr.minzdrav.gov.ru/preview-cr/${x.CodeVersion}`,
  }));
}

const DOC_ID_RE = /^\d{1,6}_\d{1,3}$/;
const SECTION_ID_RE = /^doc_[a-z0-9_]{1,40}$/;

export function registerGuidelinesRoutes(app: express.Express) {
  app.get("/api/guidelines", guidelinesRateLimit, async (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!MKB_CODE_RE.test(code)) return res.status(400).json({ error: 'Некорректный код МКБ-10', items: [] });

    try {
      const docs = await loadMirror();
      const items = docs
        .filter(d => (d.mkb_codes || []).some(t => mkbMatches(t, code)))
        .sort((a, b) => (b.publish_date || '').localeCompare(a.publish_date || ''))
        .slice(0, 20)
        .map(mirrorItem);
      // Пустая выдача зеркала — НЕ ответ. Оно может быть ещё не залито или
      // залито наполовину (полный обход рубрикатора идёт около двух часов), и
      // тогда «ничего не найдено» — прямая ложь: рекомендации существуют,
      // просто мы их пока не скачали. В этом случае спрашиваем рубрикатор.
      if (items.length > 0) return res.json({ items, source: 'mirror' });
    } catch (e: any) {
      logError('GUIDE_001', `зеркало недоступно: ${safeErr(e)}`);
    }

    const hit = crCache.get(code);
    if (hit && Date.now() - hit.at < CR_TTL) return res.json({ items: hit.items, cached: true, source: 'rubricator' });
    try {
      const items = await fetchFromRubricator(code);
      if (items === null) return res.json({ items: [], note: 'Код не найден в справочнике рубрикатора' });
      crCache.set(code, { at: Date.now(), items });
      res.json({ items, source: 'rubricator' });
    } catch (e: any) {
      logError('GUIDE_001', `${code}: ${safeErr(e)}`);
      // Рубрикатор — чужой сервис. Его недоступность не должна выглядеть как
      // «рекомендаций нет»: врач решит, что их не существует.
      res.status(502).json({ error: 'Рубрикатор Минздрава недоступен', items: [] });
    }
  });

  // Оглавление документа. Текст сюда не попадает намеренно: у одного раздела
  // бывает под 600 тысяч знаков, а врачу сперва нужно выбрать, куда идти.
  app.get("/api/guidelines/doc/:docId", guidelinesRateLimit, async (req, res) => {
    const docId = String(req.params.docId || '');
    if (!DOC_ID_RE.test(docId)) return res.status(400).json({ error: 'Некорректный идентификатор документа' });
    try {
      const [{ data: doc, error: de }, { data: secs, error: se }] = await Promise.all([
        db.from('guideline_documents').select(MIRROR_FIELDS).eq('code_version', docId).maybeSingle(),
        db.from('guideline_sections')
          .select('section_id, part, ord, title, char_len, uur, image_only')
          .eq('code_version', docId).order('ord'),
      ]);
      if (de) throw new Error(de.message);
      if (se) throw new Error(se.message);
      if (!doc) return res.status(404).json({ error: 'Рекомендация не найдена в локальной копии' });
      res.json({ document: mirrorItem(doc as MirrorDoc), sections: secs || [] });
    } catch (e: any) {
      logError('GUIDE_001', `doc ${docId}: ${safeErr(e)}`);
      res.status(502).json({ error: 'Локальная копия рекомендаций недоступна' });
    }
  });

  // Один раздел документа. Разделы «3. Лечение» и «Приложение Г» приходят от
  // рубрикатора одним куском с подзаголовками внутри — загрузчик дорезал их,
  // поэтому здесь может вернуться несколько частей.
  app.get("/api/guidelines/doc/:docId/section/:sectionId", guidelinesRateLimit, async (req, res) => {
    const docId = String(req.params.docId || '');
    const sectionId = String(req.params.sectionId || '');
    if (!DOC_ID_RE.test(docId)) return res.status(400).json({ error: 'Некорректный идентификатор документа' });
    if (!SECTION_ID_RE.test(sectionId)) return res.status(400).json({ error: 'Некорректный идентификатор раздела' });
    try {
      const { data, error } = await db.from('guideline_sections')
        .select('section_id, part, title, html, plain, char_len, uur, udd, image_only')
        .eq('code_version', docId).eq('section_id', sectionId).order('part');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return res.status(404).json({ error: 'Раздел не найден' });

      const body: any = { docId, sectionId, parts: data };
      if (sectionId === 'doc_criteria') {
        body.criteria = parseCriteria(data.map((p: any) => p.html).join(''));
      }
      res.json(body);
    } catch (e: any) {
      logError('GUIDE_001', `section ${docId}/${sectionId}: ${safeErr(e)}`);
      res.status(502).json({ error: 'Локальная копия рекомендаций недоступна' });
    }
  });
}
