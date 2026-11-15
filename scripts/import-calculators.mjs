#!/usr/bin/env node
/**
 * Импорт клинических калькуляторов из MedCalc в MedScribe.
 *
 * MedCalc (отдельный репозиторий, путь задаётся через --src или MEDCALC_SRC) — канонический источник: там калькуляторы
 * пишутся и правятся. Здесь они только используются. Поэтому ничего в
 * src/generated/calculators/ руками не редактируется: правка делается в
 * MedCalc и переносится повторным запуском этого скрипта.
 *
 *   node scripts/import-calculators.mjs --src ПУТЬ_К_MEDCALC [--report] [--dry-run]
 *   (или переменная окружения MEDCALC_SRC вместо --src)
 *
 * Что переносится:
 *   1. Файлы расчёта (src/lib/calculators/*.ts) — дословно. Они самодостаточны:
 *      ни одного импорта, чистые функции, вся интерпретация уже по-русски.
 *   2. Каталог (data.ts) — категории и карточки калькуляторов.
 *   3. Реестр полей — собирается из входного типа плюс русские подписи,
 *      разбросанные по React-обёрткам и по экспортам самих библиотек.
 *
 * Реестр полей — единственная нетривиальная часть. Обёртки MedCalc написаны
 * на Next и на тамошней библиотеке компонентов, перенести их нельзя, а
 * подписи полей в них есть только там. Скрипт достаёт их шестью способами
 * (см. collectLabels) и ОТКАЗЫВАЕТСЯ импортировать калькулятор, у которого
 * хотя бы одно поле осталось без подписи: калькулятор с полем «albumin»
 * вместо «Альбумин» врач заполнит неправильно, и неправильный ответ будет
 * выглядеть таким же уверенным, как правильный. Лучше не показать
 * калькулятор совсем, чем показать наполовину подписанным.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const SRC_ARG = opt('--src', process.env.MEDCALC_SRC);
if (!SRC_ARG) {
  console.error('Не указан путь к репозиторию MedCalc: передайте --src ПУТЬ или задайте переменную окружения MEDCALC_SRC');
  process.exit(1);
}
const SRC = path.resolve(SRC_ARG);
const LIB = path.join(SRC, 'src/lib/calculators');
const WRP = path.join(SRC, 'src/app/(portal)/calculators/[category]/[calculator]/calculators');
const OUT = path.join(ROOT, 'src/generated/calculators');

const HEADER = (src) => `// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, ${src}
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs
`;

// ─────────────────────────── разбор JSX ────────────────────────────────────

/**
 * Возвращает теги JSX с телом атрибутов. Обычной регуляркой это не берётся:
 * `[^>]*` спотыкается о `>` внутри стрелочных функций в onChange, поэтому
 * идём по символам, отслеживая вложенность {} и строки.
 */
function scanTags(src) {
  const out = [];
  const re = /<([A-Z][A-Za-z0-9]*)\b/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0, q = null, body = '';
    while (i < src.length) {
      const c = src[i];
      if (q) { if (c === q && src[i - 1] !== '\\') q = null; }
      else if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth === 0 && c === '>') break;
      body += c; i++;
    }
    out.push({ tag: m[1], body: body.replace(/\/\s*$/, '') });
  }
  return out;
}

function attr(s, n) {
  const m = new RegExp(`\\b${n}=`).exec(s);
  if (!m) return null;
  const i = m.index + m[0].length;
  if (s[i] === '"') return s.slice(i + 1, s.indexOf('"', i + 1));
  if (s[i] === '{') {
    let d = 0, j = i;
    for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { d--; if (!d) break; } }
    return s.slice(i + 1, j).trim();
  }
  return null;
}

const hasRussian = s => /[а-яё]/i.test(s);

// ─────────────────────── входной тип калькулятора ──────────────────────────

/**
 * Разворачивает поля, тип которых — другая структура из того же файла
 * (PASIInput состоит из четырёх PASIRegionInput). Ключ становится путём
 * «head.erythema», а имя внешнего поля запоминается в group: по нему потом
 * подставится человеческий заголовок группы.
 */
function expandNested(fields, src) {
  const out = [];
  for (const f of fields) {
    // Только имя типа. Литеральный union («0 | 1 | 2 | 3») в шаблон регулярки
    // подставлять нельзя: вертикальная черта превратится в альтернативу и
    // выражение совпадёт где попало.
    if (!/^[A-Z]\w*$/.test(f.type)) { out.push(f); continue; }
    const sub = src.match(new RegExp(`export type ${f.type} = \\{([\\s\\S]*?)\\n\\};`));
    if (!sub) { out.push(f); continue; }
    for (const raw of sub[1].split('\n')) {
      const g = raw.match(/^\s*(\w+)(\??):\s*([^;]+);\s*(?:\/\/\s*(.*))?$/);
      if (!g) continue;
      out.push({
        key: `${f.key}.${g[1]}`, subKey: g[1], group: f.key,
        optional: g[2] === '?', type: g[3].trim(), comment: (g[4] || '').trim(),
      });
    }
  }
  return out;
}

/** Разворачивает псевдоним типа: `export type LithiumIndication = "a" | "b";` */
function resolveAlias(type, src) {
  if (!/^[A-Z]\w*$/.test(type)) return type;
  const m = src.match(new RegExp(`export type ${type} = ([^;{]+);`));
  return m ? m[1].trim() : type;
}

function parseInputType(src, forced) {
  // В файле бывает несколько типов «…Input» (у PASI это PASIRegionInput и
  // PASIInput). Нужен ровно тот, что стоит в сигнатуре функции расчёта, —
  // иначе форма соберётся из полей вложенной структуры.
  const sig = src.match(/export function calculate\w+\(\s*\w+\s*:\s*(\w+)/);
  const pick = forced ?? (sig && new RegExp(`export type ${sig[1]} = \\{`).test(src) ? sig[1] : '\\w*Input');
  const m = src.match(new RegExp(`export type (${pick}) = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) return null;
  const fields = [];
  for (const raw of m[2].split('\n')) {
    const f = raw.match(/^\s*(\w+)(\??):\s*([^;]+);\s*(?:\/\/\s*(.*))?$/);
    if (!f) continue;
    fields.push({ key: f[1], optional: f[2] === '?', type: resolveAlias(f[3].trim(), src), comment: (f[4] || '').trim() });
  }
  return { name: m[1], fields: expandNested(fields, src) };
}

/** Литеральный union чисел (`0 | 1 | 2 | 3`) — готовый список значений. */
function literalValues(type) {
  const parts = type.split('|').map(s => s.trim().replace(/\s+as\s+const$/, ''));
  if (parts.length < 2 || !parts.every(p => /^-?\d+(\.\d+)?$/.test(p))) return null;
  return parts.map(Number);
}

const kindOf = (type, key = '', comment = '') => {
  // Единственная строка-дата во всём наборе (naegele.lmpDate). Текстовым полем
  // её показывать нельзя: пустая строка уходит в new Date() и весь расчёт
  // возвращает NaN, ничем не отличаясь от настоящего ответа.
  if (/^string$/.test(type) && (/date$/i.test(key) || /\bdate\b/i.test(comment))) return 'date';
  // `number | null` — необязательное число (fick_co.vo2measured): считать его
  // обычным обязательным полем нельзя, форма не даст отправить пустым.
  if (/^number \| null$/.test(type)) return 'number';
  if (/^boolean$/.test(type)) return 'boolean';
  if (literalValues(type)) return 'select';
  if (/^number$/.test(type)) return 'number';
  if (/^string$/.test(type)) return 'text';
  if (type.includes('|') && type.includes('"')) return 'select';
  return null;
};

/** Литеральный union строк (`"male" | "female"`). */
function stringValues(type) {
  const parts = type.split('|').map(s => s.trim());
  if (parts.length < 2 || !parts.every(p => /^"[^"]*"$/.test(p))) return null;
  return parts.map(p => p.slice(1, -1));
}

// ─────────────────────── сбор подписей к полям ─────────────────────────────

/** Массивы объектов верхнего уровня: `const X = [ … ];` */
function objectArrays(src) {
  const out = {};
  // Границу массива ищем подсчётом скобок, а не нежадной регуляркой: в файле
  // может стоять `const score = [...]` до нужного массива, и `[\s\S]*?\n\];`
  // тогда закрывает первый массив закрывающей скобкой второго, проглатывая всё
  // между ними (так пропали cageItems и abcItems).
  for (const m of src.matchAll(/(?:export\s+)?const\s+(\w+)\s*(?::[^=]*?)?=\s*\[/g)) {
    const open = m.index + m[0].length - 1;
    let d = 0, end = -1, q = null;
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === q && src[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '[') d++;
      else if (c === ']') { d--; if (!d) { end = i; break; } }
    }
    if (end < 0) continue;
    const bodySrc = src.slice(open + 1, end);
    const items = [];
    // объекты первого уровня внутри массива
    let depth = 0, buf = '', qq = null;
    for (let i = 0; i < bodySrc.length; i++) {
      const c = bodySrc[i];
      if (qq) { buf += c; if (c === qq && bodySrc[i - 1] !== '\\') qq = null; continue; }
      if (c === '"' || c === "'" || c === '`') { qq = c; buf += c; continue; }
      if (c === '{') { depth++; if (depth === 1) { buf = ''; continue; } }
      if (c === '}') { depth--; if (depth === 0) { items.push(buf); buf = ''; continue; } }
      if (depth > 0) buf += c;
    }
    out[m[1]] = items.flatMap(body => {
      const o = {};
      // Вложенный список вариантов: { key: "q1", text: "…", options: [ … ] }.
      // Его надо снять до того, как строковые пары внутри него попадут в сам
      // элемент — иначе label варианта затрёт текст вопроса.
      // Вопросы, сгруппированные по разделам: { name: "Кластер B", items: [ … ] }.
      // Разворачиваем вложенный список наружу — снаружи он и нужен.
      const nest = body.match(/\b(?:items|questions)\s*:\s*\[/);
      if (nest) {
        let dn = 0, jn = nest.index + nest[0].length - 1;
        for (; jn < body.length; jn++) { if (body[jn] === '[') dn++; else if (body[jn] === ']') { dn--; if (!dn) break; } }
        o.__nested = body.slice(nest.index + nest[0].length, jn);
        body = body.slice(0, nest.index) + body.slice(jn + 1);
      }
      const om = body.match(/\boptions\s*:\s*\[/);
      let head = body, optBody = null;
      if (om) {
        let d = 0, j = om.index + om[0].length - 1;
        for (; j < body.length; j++) { if (body[j] === '[') d++; else if (body[j] === ']') { d--; if (!d) break; } }
        optBody = body.slice(om.index + om[0].length, j);
        head = body.slice(0, om.index) + body.slice(j + 1);
      }
      if (optBody !== null) {
        o.options = [...optBody.matchAll(/\{([^{}]*)\}/g)].map(x => {
          const r = {};
          const lv = x[1].match(/\blabel\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const vv = x[1].match(/\bvalue\s*:\s*(-?\d+(?:\.\d+)?|"[^"]*")/);
          if (lv) r.label = lv[1].replace(/\\"/g, '"');
          if (vv) r.value = vv[1].startsWith('"') ? vv[1].slice(1, -1) : Number(vv[1]);
          return r;
        }).filter(r => 'value' in r && 'label' in r);
      }
      for (const f of head.matchAll(/(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/g)) o[f[1]] = f[2].replace(/\\"/g, '"');
      for (const f of head.matchAll(/(\w+)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:as const)?/g)) if (!(f[1] in o)) o[f[1]] = Number(f[2]);
      // Значения-идентификаторы: { state: female, setter: setFemale, label: "…" }
      // — так в части обёрток перечисляют флажки, и имя переменной здесь
      // и есть ключ входа.
      o.__idents = {};
      for (const f of head.matchAll(/(\w+)\s*:\s*([a-zA-Z_$][\w$]*)\s*(?=[,}\n])/g)) o.__idents[f[1]] = f[2];
      if (o.__nested) {
        const inner = [...o.__nested.matchAll(/\{([^{}]*)\}/g)].map(x => {
          const r = { __idents: {} };
          for (const f of x[1].matchAll(/(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/g)) r[f[1]] = f[2].replace(/\\"/g, '"');
          for (const f of x[1].matchAll(/(\w+)\s*:\s*(-?\d+(?:\.\d+)?)/g)) if (!(f[1] in r)) r[f[1]] = Number(f[2]);
          return r;
        });
        delete o.__nested;
        return inner.length ? inner : [o];
      }
      return [o];
    });
  }
  return out;
}

/** Объекты-словари `{ ключ: "Русская подпись" }` — паттерн `const labels: Record<keyof XInput, string>`. */
function labelMaps(src) {
  const out = [];
  for (const m of src.matchAll(/const\s+\w+\s*(?::\s*[^=]*?)?=\s*\{([\s\S]*?)\n\};/g)) {
    const pairs = {};
    for (const f of m[1].matchAll(/^\s*(\w+)\s*:\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) {
      if (hasRussian(f[2])) pairs[f[1]] = f[2].replace(/\\"/g, '"');
    }
    if (Object.keys(pairs).length) out.push(pairs);
  }
  return out;
}

/** Подписи из JSX-полей обёртки. */
function jsxLabels(src) {
  // Поле привязано к состоянию, а в функцию расчёта уходит производная:
  //   const [age, setAge] = useState("");  const ageNum = parseFloat(age);
  //   calculateX({ age: ageNum })
  // Значит, по объекту вызова строим карту переменная→ключ и разворачиваем
  // производные обратно к исходному состоянию.
  const deriv = {};
  for (const m of src.matchAll(/const\s+([\w$]+)\s*=\s*(?:parseFloat|parseInt|Number)\(\s*([\w$]+)/g)) deriv[m[1]] = m[2];
  for (const m of src.matchAll(/const\s+([\w$]+)\s*=\s*([\w$]+)\s*===\s*["'][^"']*["']/g)) deriv[m[1]] = m[2];

  const varToKey = {};
  const bind = (v, key) => {
    if (!varToKey[v]) varToKey[v] = key;
    if (deriv[v] && !varToKey[deriv[v]]) varToKey[deriv[v]] = key;
  };
  // Переменные состояния — только они могут быть источником поля формы.
  const stateVars = new Set([...src.matchAll(/const\s*\[\s*([\w$]+)\s*,/g)].map(m => m[1]));

  // Объект вызова бывает и многострочным, и в одну строку. Ищем от `calculateX({`
  // до парной закрывающей скобки, затем режем по запятым верхнего уровня.
  const fixed = {};
  const cm = src.match(/calculate\w+\(\s*\{/);
  if (cm) {
    let d = 0, end = -1;
    const open = cm.index + cm[0].length - 1;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') { d--; if (!d) { end = i; break; } }
    }
    if (end > 0) {
      const body = src.slice(open + 1, end);
      const parts = []; let depth = 0, buf = '';
      for (const c of body) {
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        if (c === ',' && depth === 0) { parts.push(buf); buf = ''; continue; }
        buf += c;
      }
      parts.push(buf);
      for (const part of parts) {
        const p = part.match(/^\s*([\w$]+)\s*:\s*([\s\S]+?)\s*$/);
        if (!p) continue;
        // Ключ, которому передан числовой литерал, пользователь не вводит —
        // в MedCalc он зафиксирован (pk_basics: cmax: 0, cmin: 0).
        if (/^-?\d+(\.\d+)?$/.test(p[2])) { fixed[p[1]] = Number(p[2]); continue; }
        const ids = [...p[2].matchAll(/\b([a-zA-Z_$][\w$]*)\b/g)].map(x => x[1])
          .filter(x => !/^(parseFloat|parseInt|Number|Boolean|String|Math|max|min|round|true|false|null|undefined|as|input|const)$/.test(x));
        if (ids.length === 1) { bind(ids[0], p[1]); continue; }
        // Выражение вроде Math.max(1, crNum): переменная состояния в нём одна.
        const st = ids.filter(x => stateVars.has(x) || stateVars.has(deriv[x]));
        if (st.length === 1) bind(st[0], p[1]);
      }
    }
  }

  const out = {};
  const FIELD = /^(InputField|CheckboxItem|CheckboxRow|Select)$/;
  for (const { tag, body } of scanTags(src)) {
    if (!FIELD.test(tag)) continue;
    const label = attr(body, 'label');
    // Требовать кириллицу здесь нельзя: «AUC», «CRP», «HCO₃⁻», «FiO₂» —
    // законные подписи. Явный label= на поле формы и так однозначен;
    // проверка на русский нужна только эвристикам ниже, где подпись
    // приходится угадывать по соседнему тексту.
    if (!label || label.startsWith('{')) continue;
    const b = attr(body, 'checked') ?? attr(body, 'value');
    if (!b) continue;
    // Состояние формы держат под разными именами: input.x, perry.x, values.x,
    // и нередко в обёртке значения: String(input.liquidStools). Поэтому берём
    // обращение к полю состояния откуда угодно из выражения — но только одно:
    // если их несколько, поле неоднозначно и подпись лучше не ставить вовсе.
    // Индексные скобки убираем до разбора: `input[r.key].erythema` — это
    // обращение к erythema, а не к key. Без этого поле вложенной группы
    // получило бы подпись от имени переменной цикла.
    const flat = b.replace(/\[[^\]]*\]/g, '');
    const refs = [...new Set([...flat.matchAll(/\b[a-zA-Z_$][\w$]*\.([A-Za-z0-9_]+)\b/g)].map(x => x[1]))];
    const key = refs.length === 1 ? refs[0]
      : refs.length === 0 && /^[a-zA-Z_$][\w$]*$/.test(flat) ? (varToKey[flat] ?? flat)
      : null;
    if (!key || out[key]) continue;
    out[key] = {
      label,
      kind: tag === 'InputField' ? 'number' : tag === 'Select' ? 'select' : 'boolean',
      unit: attr(body, 'unit') || undefined,
      placeholder: attr(body, 'placeholder') || undefined,
      hint: attr(body, 'normalRange') || attr(body, 'sublabel') || undefined,
      points: attr(body, 'points') || undefined,
      step: attr(body, 'step') || undefined,
      optionsExpr: tag === 'Select' ? attr(body, 'options') : undefined,
    };
  }
  return { labels: out, fixed };
}

/**
 * Подписи к полям результата. MedCalc выводит их через <ResultCard value=…
 * label=…> и <Stat label=… value={result.x}>, то есть русские названия для
 * половины ключей результата уже написаны — переводить их заново незачем.
 * Остальное разбирает сам блок: interpretation/recommendation — свободный
 * русский текст без подписи, severity/color — оформление.
 */
/**
 * Заголовки подразделов вложенного результата. У HADS они передаются
 * вспомогательной функции первым аргументом:
 *   renderSubscaleResult("HADS-A — Тревога", result.anxiety)
 */
function resultGroupLabels(src) {
  const out = {};
  for (const m of src.matchAll(/\w+\(\s*"([^"]+)"\s*,\s*result\.(\w+)\s*[,)]/g)) {
    if (!out[m[2]]) out[m[2]] = m[1];
  }
  return out;
}

function resultLabels(src) {
  const out = {};
  for (const { tag, body } of scanTags(src)) {
    if (!/^(Stat|ResultCard)$/.test(tag)) continue;
    const label = attr(body, 'label'), value = attr(body, 'value');
    if (!label || !value || label.startsWith('{')) continue;
    const k = value.match(/result\.(\w+)/);
    if (k && !out[k[1]]) out[k[1]] = label;
  }
  return out;
}

/**
 * Группа переключателей, у которой подпись стоит ОТДЕЛЬНЫМ АБЗАЦЕМ СВЕРХУ,
 * а не в атрибуте поля:
 *   <p className="…font-semibold">Качество жизни (не входит в IPSS)</p>
 *   <p className="text-xs…">Как бы вы себя чувствовали, если бы…</p>
 *   {ipssQoLOptions.map(opt => <input type="radio" checked={input.qol === opt.value} …>)}
 *
 * Подпись здесь нельзя брать «первым русским текстом после input», как у
 * обычных флажков: там окажется название варианта («Совсем нет»), и поле
 * получило бы подпись от своего же ответа. Поэтому смотрим назад — на
 * ближайший абзац перед группой, а следом за ним, если есть, поясняющий.
 *
 * Ограничение окна в 1200 символов не косметическое: без него подпись может
 * приехать от соседнего, ничем не связанным полем.
 */
function headingLabels(src, keys) {
  const out = {};
  const P = /<p\b[^>]*>([^<>{}]*[а-яё][^<>{}]*)<\/p>/gi;
  for (const m of src.matchAll(/<input\b[^>]*?type="(?:radio|checkbox)"[^>]*?>/g)) {
    const bound = [...m[0].matchAll(/\b(?:input|values|state)\.([A-Za-z0-9_]+)\b/g)].map(x => x[1]).find(k => keys.has(k));
    if (!bound || out[bound]) continue;
    const before = src.slice(Math.max(0, m.index - 1200), m.index);
    const paras = [...before.matchAll(P)];
    if (!paras.length) continue;
    // Последний абзац перед группой — как правило пояснение, предпоследний —
    // сам заголовок. Если абзац один, он и есть заголовок.
    const last = paras[paras.length - 1][1].trim().replace(/\s+/g, ' ');
    const prev = paras.length > 1 ? paras[paras.length - 2][1].trim().replace(/\s+/g, ' ') : null;
    const looksLikeHint = /[?]$/.test(last) || last.length > 60;
    out[bound] = looksLikeHint && prev
      ? { label: prev, hint: last }
      : { label: last };
  }
  return out;
}

/**
 * Поля, свёрстанные вручную: отдельный <label> прямо перед <input>/<select>.
 *   <label className="…">Целевой уровень Css (mmol/L)</label>
 *   <select value={perry.targetCss} …>
 * Так написана вся обёртка лития — она не пользуется общими компонентами.
 */
function bareLabelFields(src, keys) {
  const out = {};
  for (const m of src.matchAll(/<(?:input|select|textarea)\b[\s\S]{0,400}?>/g)) {
    const v = attr(m[0], 'value') ?? attr(m[0], 'checked');
    if (!v) continue;
    const flat = v.replace(/\[[^\]]*\]/g, '');
    const refs = [...new Set([...flat.matchAll(/\b[a-zA-Z_$][\w$]*\.([A-Za-z0-9_]+)\b/g)].map(x => x[1]))].filter(k => keys.has(k));
    if (refs.length !== 1 || out[refs[0]]) continue;
    const before = src.slice(Math.max(0, m.index - 600), m.index);
    const labels = [...before.matchAll(/<label\b[^>]*>([^<>{}]*[а-яёA-Za-z][^<>{}]*)<\/label>/gi)];
    if (!labels.length) continue;
    out[refs[0]] = labels[labels.length - 1][1].trim().replace(/\s+/g, ' ');
  }
  return out;
}

/**
 * Флажки, свёрстанные вручную, без компонента:
 *   <label …><input type="checkbox" checked={dialysis} …/><span>Диализ …</span></label>
 * Подпись берём из первого русского текстового узла после самого input.
 * Ограничиваем окном в 400 символов — дальше это уже соседнее поле.
 */
function rawCheckboxLabels(src) {
  const out = {};
  for (const m of src.matchAll(/<input\b[^>]*?type="(?:checkbox|radio)"[^>]*?>/g)) {
    const bind = attr(m[0], 'checked');
    if (!bind) continue;
    const v = bind.match(/^([a-zA-Z_$][\w$]*)$/) || bind.match(/^input\.([A-Za-z0-9_]+)$/);
    if (!v) continue;
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const t = after.match(/>\s*([^<>{}]*[а-яё][^<>{}]*?)\s*</i);
    if (t && !out[v[1]]) out[v[1]] = t[1].trim().replace(/\s+/g, ' ');
  }
  return out;
}

export { scanTags, attr, parseInputType, objectArrays, labelMaps, jsxLabels, rawCheckboxLabels, headingLabels, bareLabelFields, resultLabels, resultGroupLabels, literalValues, stringValues, kindOf, hasRussian };

// ───────────────────── объекты-словари массивов ────────────────────────────

/** `const childPughOptions = { bilirubin: [ … ], albumin: [ … ] }` */
function arrayMaps(src) {
  const out = {};
  for (const m of src.matchAll(/(?:export\s+)?const\s+(\w+)\s*(?::[^=]+?)?=\s*\{\n([\s\S]*?)\n\};/g)) {
    const inner = {};
    for (const a of m[2].matchAll(/^\s{2}(\w+):\s*\[([\s\S]*?)^\s{2}\],?$/gm)) {
      const items = [...a[2].matchAll(/\{([^{}]*)\}/g)].map(o => {
        const r = {};
        for (const f of o[1].matchAll(/(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/g)) r[f[1]] = f[2].replace(/\\"/g, '"');
        for (const f of o[1].matchAll(/(\w+)\s*:\s*(-?\d+(?:\.\d+)?)/g)) if (!(f[1] in r)) r[f[1]] = Number(f[2]);
        return r;
      });
      if (items.length) inner[a[1]] = items;
    }
    if (Object.keys(inner).length) out[m[1]] = inner;
  }
  return out;
}

const asOptions = arr =>
  Array.isArray(arr) && arr.length && arr.every(o => 'value' in o && ('label' in o || 'text' in o))
    ? arr.map(o => ({ value: o.value, label: String(o.label ?? o.text) }))
    : null;

/**
 * Собирает описания полей одного калькулятора.
 * Возвращает { fields, missing } — missing непуст, если подпись или список
 * значений найти не удалось; такой калькулятор не импортируется.
 */
function collectLabels(libSrc, wrpSrc, input, entryName, patch = {}) {
  const libArrays = objectArrays(libSrc);
  const wrpArrays = objectArrays(wrpSrc);
  const allArrays = { ...libArrays, ...wrpArrays };
  const libAMaps = { ...arrayMaps(libSrc), ...arrayMaps(wrpSrc) };
  const { labels: jsx, fixed } = jsxLabels(wrpSrc);
  const raw = rawCheckboxLabels(wrpSrc);
  const heads = headingLabels(wrpSrc, new Set(input.fields.map(f => f.key)));
  const bare = bareLabelFields(wrpSrc, new Set(input.fields.map(f => f.subKey ?? f.key)));
  const maps = [...labelMaps(wrpSrc), ...labelMaps(libSrc)];
  const keys = new Set(input.fields.map(f => f.key));

  // Массивы вопросов: элементы с key/id, совпадающими с ключами входа.
  const keyOf = (o) => {
    const direct = o.key ?? o.id;
    if (direct && keys.has(String(direct))) return String(direct);
    for (const v of Object.values(o.__idents || {})) if (keys.has(v)) return v;
    return null;
  };
  const questionText = {}, questionOptions = {}, questionHint = {}, questionPoints = {};
  for (const arr of Object.values(allArrays)) {
    const matched = arr.filter(o => keyOf(o));
    if (matched.length < 2) continue;
    for (const o of matched) {
      const k = keyOf(o);
      const t = o.text ?? o.label ?? o.question;
      // Кириллицу здесь не требуем. Совпадение ключа элемента с ключом входа —
      // уже достаточное основание, а подписи бывают формульные: «pH < 7.35»,
      // «Na < 130 мЭкв/л». Проверка на русский остаётся только там, где подпись
      // приходится угадывать по соседнему тексту.
      if (t && !questionText[k]) questionText[k] = String(t);
      const d = o.description ?? o.sublabel ?? (t && o.text && o.label !== o.text ? o.text : null);
      if (d && hasRussian(String(d)) && String(d) !== questionText[k] && !questionHint[k]) questionHint[k] = String(d);
      if (o.points && !questionPoints[k]) questionPoints[k] = String(o.points);
      if (o.options?.length && !questionOptions[k]) questionOptions[k] = o.options;
    }
  }

  // Общий список ответов опросника: массив {value,label}, чей размер совпадает
  // с литеральным union большинства полей (0|1|2|3 → четыре варианта).
  const sharedOptions = [];
  for (const [name, arr] of Object.entries(allArrays)) {
    const o = asOptions(arr);
    if (o && /option|answer|choice|grade|level|scale/i.test(name)) sharedOptions.push({ name, options: o });
  }

  // Поле, которого в интерфейсе MedCalc нет вовсе: ключ встречается в обёртке
  // ровно один раз — в объекте начального состояния — и ни к какому контролу не
  // привязан. Так сделано намеренно (caprini.historyDvtPe3 — дубль
  // двухбалльного пункта, в комментарии источника прямо написано «use only
  // once»). Подписывать тут нечего: поле надо зафиксировать на том значении,
  // на котором его держит источник.
  //
  // Одного вхождения НЕДОСТАТОЧНО. Опросники (PHQ-9, GAD-7, MMSE, MoCA, YMRS,
  // IPSS) рисуют поля циклом по массиву вопросов, поэтому там ключ тоже
  // встречается ровно один раз — в начальном состоянии. Правило без второго
  // условия зафиксировало бы их целиком, и PHQ-9 превратился бы в пустую
  // форму, уверенно выдающую ноль баллов любому пациенту.
  //
  // Поэтому фиксируем только там, где обёртка перечисляет свои контролы
  // поимённо: если ВСЕ остальные поля получили подпись из явного JSX, значит
  // список полон, и не попавший в него ключ действительно не выводится.
  const enumeratedInJsx = input.fields.filter(f => jsx[f.key]).length === input.fields.length - 1;
  const missingGroups = [];
  const pinned = {};
  const initState = wrpSrc.match(/useState<\w+>\(\s*\{([\s\S]*?)\n\s*\}\s*\)/);
  if (enumeratedInJsx && initState) for (const m of initState[1].matchAll(/(\w+)\s*:\s*(false|true|-?\d+(?:\.\d+)?)/g)) {
    if (jsx[m[1]]) continue;
    const occurrences = (wrpSrc.match(new RegExp(`\\b${m[1]}\\b`, 'g')) || []).length;
    if (occurrences === 1) pinned[m[1]] = m[2] === 'true' ? true : m[2] === 'false' ? false : Number(m[2]);
  }

  // Заголовки групп вложенного входа. У PASI это массив regions в обёртке:
  // { key: "head", label: "Голова и шея (H)", weight: "×0.1" }. Без них форма
  // покажет «Эритема (E)» четыре раза подряд, и врач не будет знать, какую
  // область тела он сейчас заполняет.
  const groups = [...new Set(input.fields.map(f => f.group).filter(Boolean))];
  const groupLabels = {};
  if (groups.length) for (const arr of Object.values(allArrays)) {
    const matched = arr.filter(o => groups.includes(String(o.key ?? o.id)));
    if (matched.length !== groups.length) continue;
    for (const o of matched) {
      const g = String(o.key ?? o.id);
      const l = o.label ?? o.text ?? o.name;
      if (l && !groupLabels[g]) groupLabels[g] = String(l) + (o.weight ? ` ${o.weight}` : '');
    }
  }
  for (const g of groups) if (!groupLabels[g]) missingGroups.push(g);

  const fields = [], missing = [];
  const selectFields = input.fields.filter(f => kindOf(f.type, f.key, f.comment) === 'select');

  for (const f of input.fields) {
    // У подполя вложенной группы подписи ищутся по его собственному имени:
    // в обёртке контрол один на все группы, он в цикле.
    if (f.subKey && !jsx[f.key]) jsx[f.key] = jsx[f.subKey];
    if (f.key in fixed) { fields.push({ key: f.key, label: f.key, kind: 'number', fixedValue: fixed[f.key] }); continue; }
    if (f.key in pinned) { fields.push({ key: f.key, label: f.key, kind: kindOf(f.type, f.key, f.comment) || 'number', fixedValue: pinned[f.key] }); continue; }
    const j = jsx[f.key];
    // Правка из таблицы исключений — первым источником, а не постобработкой:
    // поле без подписи до неё просто не доживёт.
    const label = patch[f.key]?.label
      ?? j?.label
      ?? questionText[f.key]
      ?? maps.map(m => m[f.key]).find(Boolean)
      ?? raw[f.key]
      ?? heads[f.key]?.label
      ?? bare[f.subKey ?? f.key]
      // Калькулятор из одного поля (NYHA, ECOG, Killip, mRS) — это поле и есть
      // сам калькулятор, отдельной подписи у него в источнике нет и быть не
      // должно. Берём название из каталога.
      ?? (input.fields.length === 1 ? entryName : null)
      ?? null;

    const byType = kindOf(f.type, f.key, f.comment);
    let kind = byType === 'date' ? 'date' : (j?.kind ?? byType);
    if (kind === 'select' && kindOf(f.type) === 'boolean') kind = 'boolean';
    if (!kind) { missing.push(`${f.key}: неизвестный тип ${f.type}`); continue; }
    if (!label) { missing.push(`${f.key}: нет подписи`); continue; }

    const field = { key: f.key, label, kind };
    if (j?.unit) field.unit = j.unit;
    if (j?.placeholder) field.placeholder = j.placeholder;
    const hint = j?.hint ?? questionHint[f.key] ?? heads[f.key]?.hint;
    if (hint) field.hint = hint;
    if (j?.points ?? questionPoints[f.key]) field.points = j?.points ?? questionPoints[f.key];
    if (j?.step) field.step = Number(j.step) || undefined;
    if (f.optional || /\| null$/.test(f.type)) field.optional = true;
    if (f.group) field.group = groupLabels[f.group] ?? f.group;
    if (patch[f.key]) Object.assign(field, patch[f.key]);

    if (kind === 'select') {
      const lit = literalValues(f.type);
      const str = stringValues(f.type);
      let options = questionOptions[f.key] ?? null;

      // 1. Явный options= в обёртке, ссылающийся на массив
      if (j?.optionsExpr) {
        if (j.optionsExpr.trimStart().startsWith('[')) {
          const inline = [...j.optionsExpr.matchAll(/\{([^{}]*)\}/g)].map(x => {
            const lv = x[1].match(/\blabel\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const vv = x[1].match(/\bvalue\s*:\s*(-?\d+(?:\.\d+)?|"[^"]*")/);
            return lv && vv ? { value: vv[1].startsWith('"') ? vv[1].slice(1, -1) : Number(vv[1]), label: lv[1] } : null;
          }).filter(Boolean);
          if (inline.length) options = inline;
        }
        const ref = j.optionsExpr.match(/^(\w+)/);
        if (!options && ref && allArrays[ref[1]]) options = asOptions(allArrays[ref[1]]);
        const idx = j.optionsExpr.match(/^(\w+)\[/);
        if (!options && idx && libAMaps[idx[1]]?.[f.key]) options = asOptions(libAMaps[idx[1]][f.key]);
      }
      // 2. Словарь массивов, ключ которого совпадает с ключом поля
      if (!options) for (const am of Object.values(libAMaps)) {
        if (am[f.key]) { options = asOptions(am[f.key]); if (options) break; }
      }
      // 3. Массив с именем, производным от ключа поля (bishopDilationOptions)
      if (!options) for (const [name, arr] of Object.entries(allArrays)) {
        if (new RegExp(f.key, 'i').test(name)) { options = asOptions(arr); if (options) break; }
      }
      // 4. Общий список ответов опросника подходящего размера
      if (!options && lit) {
        const fit = sharedOptions.find(s => s.options.length === lit.length &&
          s.options.every(o => lit.includes(Number(o.value))));
        if (fit) options = fit.options;
      }
      // 5. Единственное select-поле калькулятора — берём единственный
      //    подходящий по размеру список
      if (!options && lit && selectFields.length === 1) {
        const fit = Object.values(allArrays).map(asOptions).filter(Boolean)
          .find(o => o.length === lit.length && o.every(x => lit.includes(Number(x.value))));
        if (fit) options = fit;
      }
      // 5b. Поле типа string: массив, у элементов которого есть свойство с
      //     именем этого поля (значение) и человеческое название рядом
      //     (opioidDrugs: { drug: "morphine_oral", name: "Морфин (пероральный)" }).
      if (!options && f.type === 'string') for (const arr of Object.values(allArrays)) {
        const ok = arr.length > 1 && arr.every(o => typeof o[f.key] === 'string' && (o.name || o.label));
        if (ok) { options = arr.map(o => ({ value: o[f.key], label: String(o.name ?? o.label) })); break; }
      }
      if (!options && str) options = str.map(v => ({ value: v, label: v }));
      // 6. Непрерывный целочисленный ряд 0…N без словесных якорей. В самом
      //    MedCalc такие поля тоже показываются просто числами
      //    (ciwaOptions07 = Array.from(…, i => ({ value: i, label: String(i) }))),
      //    так что это не огрубление источника, а его точное повторение.
      if (!options && lit && lit.every((v, i) => v === i)) options = lit.map(v => ({ value: v, label: String(v) }));

      if (!options) { missing.push(`${f.key}: нет списка значений (${f.type})`); continue; }
      field.options = options;
    }
    fields.push(field);
  }
  // Группа без заголовка — это форма, в которой одинаковые подписи идут
  // подряд и непонятно, к чему относятся. Отказываемся так же, как от поля
  // без подписи.
  for (const g of missingGroups) missing.push(`группа ${g}: нет заголовка`);
  return { fields, missing };
}
export { arrayMaps, collectLabels };

// ─────────────────────────── каталог MedCalc ───────────────────────────────

/** Вытаскивает массив-литерал `export const NAME: T[] = [ … ];` как данные. */
function evalArray(src, name) {
  const m = src.match(new RegExp(`export const ${name}\\s*:[^=]*=\\s*(\\[[\\s\\S]*?\\n\\];)`));
  if (!m) throw new Error(`в data.ts не найден массив ${name}`);
  // Литерал состоит только из строк, чисел и булевых — исполнять безопасно.
  return new Function(`return ${m[1].replace(/;$/, '')}`)();
}

// ─────────────────────── единственное исключение ───────────────────────────

/**
 * Одна запись каталога MedCalc = один калькулятор. Исключение ровно одно.
 *
 * Литий в MedCalc — это одна карточка «Калькулятор лития: дозирование,
 * интерпретация уровня, токсичность», за которой стоят ТРИ независимые
 * функции: регрессия Перри, номограмма Купера и интерпретация уровня. В
 * MedCalc они разведены вкладками внутри одной страницы; здесь блок узкий и
 * вкладок внутри вкладки не будет, поэтому запись разворачивается в три.
 *
 * Здесь же — единственные во всём импортёре подписи, написанные руками:
 * переключатель единиц мочевины делит <label> с самим полем мочевины, и
 * автоматически он получал подпись соседа («Азот мочевины крови (BUN)» на
 * двух полях подряд). Аргумент номограммы Купера подписать вообще неоткуда:
 * функция принимает голое число, а не структуру.
 *
 * Правильное место для этой правки — сам MedCalc: разделить там карточку на
 * три и дать полям подписи. Пока этого не сделано, знание лежит здесь, явно
 * и в одном месте.
 */
const SPLIT = {
  lithium: [
    {
      id: 'lithium_perry',
      name: 'Литий: подбор дозы (Perry)',
      description: 'Начальная доза Li₂CO₃ по регрессии Перри, без тест-дозы',
      fn: 'calculatePerry',
      inputType: 'PerryInput',
      patch: { ureaInMmol: { label: 'Мочевина введена в ммоль/л', hint: 'Пересчитывается в BUN: мочевина × 2.8' } },
    },
    {
      id: 'lithium_cooper',
      name: 'Литий: номограмма Купера',
      description: 'Доза Li₂CO₃ по уровню через 24 ч после тест-дозы 600 мг',
      fn: 'calculateCooper',
      // Функция принимает число, а не объект.
      scalarField: { key: 'c24h', label: 'Уровень лития через 24 ч', kind: 'number', unit: 'ммоль/л', placeholder: '0.2' },
    },
    {
      id: 'lithium_level',
      name: 'Литий: интерпретация уровня',
      description: 'Терапевтический диапазон и признаки токсичности',
      fn: 'interpretLithiumLevel',
      inputType: 'LithiumLevelInput',
      // MedCalc даёт ввести уровень в ммоль/л, мг/л или мкг/л и пересчитывает
      // сам; здесь поле одно, поэтому единица названа прямо в подписи. Найти
      // её автоматически нельзя: вход собирается не вызовом функции, а
      // промежуточной переменной с конверсией.
      patch: { level: { label: 'Уровень лития в сыворотке', unit: 'ммоль/л', placeholder: '0.8' } },
    },
  ],
};

// ──────────────────────────────── импорт ───────────────────────────────────

function main() {
  const report = flag('--report'), dry = flag('--dry-run') || report;
  for (const p of [LIB, WRP]) if (!fs.existsSync(p)) {
    console.error(`Нет каталога-источника: ${p}\nУкажите путь к MedCalc через --src`);
    process.exit(1);
  }

  const dataSrc = fs.readFileSync(path.join(LIB, 'data.ts'), 'utf8');
  const categories = evalArray(dataSrc, 'categories');
  const catalog = evalArray(dataSrc, 'calculators');

  const libFiles = fs.readdirSync(LIB).filter(f => f.endsWith('.ts') && f !== 'data.ts' && f !== 'index.ts');
  const wrpFiles = fs.readdirSync(WRP).filter(f => f.endsWith('.tsx'));
  const wrpByBase = new Map(wrpFiles.map(f => [f.replace(/-calculator\.tsx$/, '').replace(/-/g, '_'), f]));

  const imported = [], skipped = [];
  // Один и тот же калькулятор бывает заведён в каталог MedCalc дважды под
  // разными рубриками: lab_winter / winter_formula, lab_delta_delta /
  // delta_delta, lab_corrected_phenytoin / corrected_phenytoin — совпадают
  // название, короткое имя, тип и описание, различается только categoryId, и
  // файл расчёта есть только у одной из пары.
  //
  // Импортировать обе записи нельзя: врач увидел бы в списке две одинаковые
  // строки и гадал, чем они отличаются (ничем). Выбрасывать вторую тоже
  // неправильно — она несёт полезное: тот, кто открыл «Лабораторную
  // диагностику», должен найти формулу Винтера там же. Поэтому запись без
  // реализации не становится отдельным калькулятором, а добавляет свой раздел
  // существующему.
  const implemented = new Set(catalog.filter(e => libFiles.includes(`${e.id}.ts`)).map(e => e.id));
  const sameCalc = e => `${e.name}|${e.shortName ?? ''}|${e.type}|${e.description}`;
  const byShape = new Map(catalog.filter(e => implemented.has(e.id)).map(e => [sameCalc(e), e.id]));
  const extraCategories = {}, merged = [];
  for (const e of catalog) {
    if (implemented.has(e.id)) continue;
    const twin = byShape.get(sameCalc(e));
    if (!twin) continue;
    (extraCategories[twin] ??= []).push(e.categoryId);
    merged.push(`${e.id} → ${twin} (+раздел ${e.categoryId})`);
  }

  const work = catalog
    .filter(e => implemented.has(e.id) || !byShape.get(sameCalc(e)))
    .flatMap(e => (SPLIT[e.id] ?? [{}]).map(o => ({ ...e, ...o, base: e.id })));

  for (const entry of work) {
    const base = entry.base;
    const libFile = `${base}.ts`;
    if (!libFiles.includes(libFile)) { skipped.push({ id: base, why: 'нет файла расчёта' }); continue; }

    const libSrc = fs.readFileSync(path.join(LIB, libFile), 'utf8');
    const fnName = entry.fn ?? (libSrc.match(/export function (calculate\w+)\(/) || [])[1];
    if (!fnName || !new RegExp(`export function ${fnName}\\(`).test(libSrc)) {
      skipped.push({ id: entry.id, why: `нет функции ${fnName ?? 'расчёта'}` }); continue;
    }
    const fn = [null, fnName];

    const input = entry.scalarField
      ? { name: null, fields: [{ key: entry.scalarField.key, type: 'number', comment: '' }] }
      : parseInputType(libSrc, entry.inputType);
    if (!input) { skipped.push({ id: entry.id, why: 'не разобран входной тип' }); continue; }

    const wrpFile = wrpByBase.get(base);
    const wrpSrc = wrpFile ? fs.readFileSync(path.join(WRP, wrpFile), 'utf8') : '';
    let fields, missing;
    if (entry.scalarField) {
      // Голый аргумент: описываем поле целиком в таблице исключений.
      ({ ...fields } = {}); fields = [{ ...entry.scalarField }]; missing = [];
    } else {
      ({ fields, missing } = collectLabels(libSrc, wrpSrc, input, entry.name, entry.patch ?? {}));
      for (const k of Object.keys(entry.patch ?? {})) {
        if (!fields.some(f => f.key === k)) missing.push(`${k}: правка подписи не нашла такого поля`);
      }
    }
    if (missing.length) { skipped.push({ id: entry.id, why: missing.join('; '), partial: fields.length, total: input.fields.length }); continue; }

    // Ссылка на первоисточник — она есть в обёртке, в ResultCard citation=.
    const cite = wrpSrc.match(/\bcitation="([^"]+)"/);

    // Поля результата в порядке объявления, с подписями там, где они есть.
    // Тип результата — тоже по сигнатуре, а не «первый подходящий»: у HADS
    // раньше объявлен HADSSubscaleResult, и по нему выходил список ключей,
    // которых в настоящем результате нет вовсе.
    const rsig = libSrc.match(new RegExp(`export function ${fn[1]}\\([^)]*\\)\\s*:\\s*(\\w+)`));
    const rname = rsig && new RegExp(`export type ${rsig[1]} = \\{`).test(libSrc) ? rsig[1] : '\\w*Result';
    const rt = libSrc.match(new RegExp(`export type ${rname} = \\{([\\s\\S]*?)\\n\\};`));
    const rl = resultLabels(wrpSrc);
    const rg = resultGroupLabels(wrpSrc);
    const rawResult = rt
      ? [...rt[1].matchAll(/^\s*(\w+)(\??):\s*([^;]+);/gm)].map(x => ({ key: x[1], optional: x[2] === '?', type: x[3].trim() }))
      : [];

    // Результат-структура (HADS: две подшкалы объектами) разворачивается так же,
    // как вложенный вход: подполя получают путь и заголовок подраздела. Без
    // этого калькулятор пришлось бы пропустить — выводить было бы нечего.
    const result = [];
    for (const r of rawResult) {
      const subType = /^[A-Z]\w*$/.test(r.type)
        ? libSrc.match(new RegExp(`export type ${r.type} = \\{([\\s\\S]*?)\\n\\};`))
        : null;
      if (subType && rg[r.key]) {
        for (const x of subType[1].matchAll(/^\s*(\w+)(\??):\s*([^;]+);/gm)) {
          result.push({
            key: `${r.key}.${x[1]}`, subKey: x[1], group: rg[r.key],
            ...(rl[x[1]] ? { label: rl[x[1]] } : {}),
            ...(x[2] === '?' ? { optional: true } : {}),
          });
        }
        continue;
      }
      result.push({
        key: r.key,
        ...(rl[r.key] ? { label: rl[r.key] } : {}),
        ...(r.optional ? { optional: true } : {}),
        ...(/^[A-Z]/.test(r.type) ? { nested: true } : {}),
      });
    }

    // Поля результата-объекты (Date, подшкалы) блок не рисует — он выводит
    // строки и числа. Само по себе это не беда: у naegele рядом с датой-объектом
    // лежит её же готовая строка. Отказываемся только когда после них не
    // остаётся ничего выводимого — как у HADS, где весь результат состоит из
    // двух вложенных подшкал и карточка вышла бы пустой.
    const renderable = result.filter(r => !r.nested && !['severity', 'color'].includes(r.key));
    if (result.length && renderable.length === 0) {
      skipped.push({ id: base, why: `результат целиком вложенный (${result.filter(r => r.nested).map(r => r.key).join(', ')}) — выводить нечего` });
      continue;
    }

    imported.push({
      ...entry,
      // Разделов у калькулятора может быть несколько: первый — из его
      // собственной записи, остальные — из записей-дубликатов.
      categories: [entry.categoryId, ...(extraCategories[entry.base] ?? [])],
      libFile, fn,
      scalarArg: !!entry.scalarField,
      fields, result,
      citation: cite ? cite[1] : undefined,
      resultFn: fn[1],
    });
  }

  // ── отчёт ───────────────────────────────────────────────────────────────
  const totalFields = imported.reduce((a, c) => a + c.fields.length, 0);
  const pinnedAll = imported.flatMap(c => c.fields.filter(f => f.fixedValue !== undefined).map(f => `${c.id}.${f.key} = ${f.fixedValue}`));

  console.log(`Каталог MedCalc: ${catalog.length} записей, ${categories.length} категорий`);
  if (merged.length) console.log(`Записи-дубликаты, слитые с основными: ${merged.join(', ')}`);
  if (pinnedAll.length) console.log(`Зафиксировано (в интерфейсе MedCalc не выводятся): ${pinnedAll.join(', ')}`);
  console.log(`Импортировано:  ${imported.length} калькуляторов, ${totalFields} полей`);
  console.log(`Пропущено:      ${skipped.length}`);
  if (report || skipped.length) {
    for (const s of skipped) {
      const frac = s.total ? ` [${s.partial}/${s.total} полей]` : '';
      console.log(`  · ${s.id.padEnd(24)}${frac} ${s.why}`);
    }
  }
  if (dry) { console.log('\n--dry-run: ничего не записано'); return { imported, skipped, categories }; }

  // ── запись ──────────────────────────────────────────────────────────────
  const libOut = path.join(OUT, 'lib');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(libOut, { recursive: true });

  for (const c of imported) {
    const src = fs.readFileSync(path.join(LIB, c.libFile), 'utf8');
    fs.writeFileSync(path.join(libOut, c.libFile), HEADER(`src/lib/calculators/${c.libFile}`) + '\n' + src);
  }

  const usedCats = new Set(imported.map(c => c.categoryId));
  const cats = categories.filter(c => usedCats.has(c.id));
  const catalogOut = imported.map(c => ({
    id: c.id, categoryId: c.categoryId, categories: c.categories, name: c.name, shortName: c.shortName,
    type: c.type, description: c.description, featured: c.featured,
    module: c.libFile.replace(/\.ts$/, ''), fn: c.resultFn,
    citation: c.citation, fields: c.fields, result: c.result,
    ...(c.scalarArg ? { scalarArg: true } : {}),
  }));

  fs.writeFileSync(path.join(OUT, 'catalog.ts'),
    HEADER('src/lib/calculators/data.ts + обёртки') + `
export type CalcFieldKind = "number" | "boolean" | "select" | "text" | "date";

export interface CalcField {
  key: string;
  label: string;
  kind: CalcFieldKind;
  unit?: string;
  placeholder?: string;
  /** Норма или уточнение под полем. */
  hint?: string;
  /** Вклад в балл, как показано в MedCalc («+1», «+2»). */
  points?: string;
  step?: number;
  optional?: boolean;
  /** Заголовок группы: у PASI поля сгруппированы по областям тела. */
  group?: string;
  /** Значение, зафиксированное в MedCalc: врач его не вводит. */
  fixedValue?: number | boolean;
  options?: { value: string | number; label: string }[];
}

export interface CalcCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface CalcEntry {
  id: string;
  /** Основной раздел — по нему калькулятор показывается, если разделов один. */
  categoryId: string;
  /** Все разделы, включая пришедшие из записей-дубликатов каталога. */
  categories: string[];
  name: string;
  shortName?: string;
  type: "formula" | "scale" | "risk";
  description: string;
  featured?: boolean;
  /** Имя файла в ./lib без расширения. */
  module: string;
  /** Имя экспортированной функции расчёта в этом файле. */
  fn: string;
  citation?: string;
  /** Функция принимает одно число, а не объект (номограмма Купера). */
  scalarArg?: boolean;
  fields: CalcField[];
  /** Поля результата в порядке объявления; label — там, где он есть в MedCalc. */
  result: {
    key: string;
    label?: string;
    /** Заголовок подраздела: у вложенного результата (HADS) их два. */
    group?: string;
    /** Имя поля внутри подраздела. */
    subKey?: string;
    optional?: boolean;
    /** Значение-объект (Date, подшкала): блок такие поля не выводит. */
    nested?: boolean;
  }[];
}

export const calcCategories: CalcCategory[] = ${JSON.stringify(cats.map(({ id, name, icon, description }) => ({ id, name, icon, description })), null, 2)};

export const calcEntries: CalcEntry[] = ${JSON.stringify(catalogOut, null, 2)};
`);

  // Лёгкий индекс отдельным файлом: id, название и раздел, без описаний полей
  // и результата. Нужен тем, кто просто называет калькулятор по имени, —
  // прежде всего вкладке клинреков со связками диагноза.
  //
  // Разделение не косметическое. Полный catalog.ts весит около 300 КБ и
  // попадает в бандл того, кто его импортирует; вкладка клинреков не ленивая,
  // и один её импорт вернул эти 300 КБ в основной бандл всем, включая врачей,
  // которые в калькуляторы не заходят. Индекс не импортирует catalog.ts —
  // это его собственные данные, и случайно потянуть тяжёлый файл через него
  // нельзя.
  fs.writeFileSync(path.join(OUT, 'index.ts'),
    HEADER('src/lib/calculators/data.ts') + `
export interface CalcListing {
  id: string;
  categoryId: string;
  categories: string[];
  name: string;
  shortName?: string;
  type: "formula" | "scale" | "risk";
  description: string;
  featured?: boolean;
}

export const calcListing: CalcListing[] = ${JSON.stringify(
    catalogOut.map(({ id, categoryId, categories, name, shortName, type, description, featured }) =>
      ({ id, categoryId, categories, name, shortName, type, description, featured })), null, 2)};
`);

  console.log(`\nЗаписано в ${path.relative(ROOT, OUT)}: ${imported.length} файлов расчёта + catalog.ts + index.ts`);
  return { imported, skipped, categories: cats };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
export { main, evalArray };
