/**
 * Прогон всех перенесённых калькуляторов на данных, собранных ИЗ РЕЕСТРА ПОЛЕЙ.
 *
 *   npx vite-node scripts/check-calculators.ts
 *
 * Смысл именно в источнике данных: вход строится по catalog.ts — по тем самым
 * описаниям, из которых блок рисует форму. Значит, проверяется не «работает ли
 * функция вообще», а «сходится ли реестр с функцией»: те ли ключи, те ли типы,
 * те ли значения списков. Импортёр собирает реестр разбором чужого JSX, и
 * ошибка там выглядела бы как поле с правильной подписью и неправильным ключом —
 * форма отрисовалась бы, а расчёт молча пошёл бы по значению по умолчанию.
 */
import { calcEntries } from "../src/generated/calculators/catalog";
import { CALCULATORS_BY_DIAGNOSIS } from "../src/config/diagnosisCalculators";
import fs from "node:fs";
import path from "node:path";
import {
  COMMON_RESULT_LABELS, PROSE_KEYS, RESULT_LABELS, STYLE_KEYS,
} from "../src/components/blocks/CalculatorsBlock";

const mods = import.meta.glob("../src/generated/calculators/lib/*.ts", { eager: true }) as Record<string, Record<string, unknown>>;

const placeholderNumber = (f: { placeholder?: string }) => {
  const p = parseFloat(String(f.placeholder ?? "").replace(",", "."));
  return Number.isFinite(p) ? p : 1;
};

let ok = 0;
const problems: string[] = [];
const notes: string[] = [];

for (const e of calcEntries) {
  const key = Object.keys(mods).find(k => k.endsWith(`/${e.module}.ts`));
  const fn = key ? mods[key][e.fn] : undefined;
  if (typeof fn !== "function") { problems.push(`${e.id}: нет функции ${e.fn} в ${e.module}.ts`); continue; }

  // Два прогона: «пусто/первый вариант» и «второй вариант, удвоенные числа».
  // Одного мало — почти у каждой шкалы первая ветка интерпретации возвращает
  // нули и не задевает ни таблиц, ни делений.
  let failed = false;
  for (const variant of [0, 1]) {
    // Ключ поля — путь: у PASI вход двухуровневый (четыре области тела).
    const input: Record<string, unknown> = {};
    const put = (path: string, v: unknown) => {
      const parts = path.split(".");
      let node = input;
      for (const p of parts.slice(0, -1)) {
        if (typeof node[p] !== "object" || node[p] === null) node[p] = {};
        node = node[p] as Record<string, unknown>;
      }
      node[parts[parts.length - 1]] = v;
    };
    for (const f of e.fields) {
      if (f.fixedValue !== undefined) { put(f.key, f.fixedValue); continue; }
      if (f.kind === "boolean") put(f.key, variant === 1);
      else if (f.kind === "select") put(f.key, f.options![Math.min(variant, f.options!.length - 1)].value);
      else if (f.kind === "text" || f.kind === "date") put(f.key, f.kind === "date" ? "2026-01-15" : "");
      else put(f.key, placeholderNumber(f) * (variant === 1 ? 2 : 1));
    }
    try {
      // Номограмма Купера принимает число, а не объект.
      const arg = e.scalarArg ? input[e.fields[0].key] : input;
      const r = (fn as (i: unknown) => Record<string, unknown>)(arg);
      if (!r || typeof r !== "object") { problems.push(`${e.id}[${variant}]: вернул не объект`); failed = true; break; }
      // Необязательные поля результата (invalidReason появляется только когда
      // формула неприменима) и поля-объекты, которые блок и не выводит.
      const at = (path: string) => path.split(".").reduce<unknown>(
        (node, p) => (node && typeof node === "object" ? (node as Record<string, unknown>)[p] : undefined), r);
      const missing = e.result.filter(x => !x.optional).map(x => x.key).filter(k => at(k) === undefined);
      if (missing.length) { problems.push(`${e.id}[${variant}]: в результате нет ${missing.join(", ")}`); failed = true; break; }
      // Часть формул MedCalc делит на разность, которая на некоторых входах
      // обращается в ноль (delta_delta при HCO₃ = 24). Это свойство источника,
      // а не переноса, и блок такой результат не печатает, а прямо говорит,
      // что формула не определена. Поэтому — заметка, а не ошибка.
      const flat = (o: unknown, prefix = ""): [string, unknown][] =>
        o && typeof o === "object" && !(o instanceof Date)
          ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
              v && typeof v === "object" && !(v instanceof Date) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v] as [string, unknown]])
          : [];
      const nan = flat(r).filter(([, v]) => typeof v === "number" && !Number.isFinite(v)).map(([k]) => k);
      if (nan.length) notes.push(`${e.id}: на тестовых значениях формула не определена (${nan.join(", ")})`);
    } catch (err) {
      problems.push(`${e.id}[${variant}]: ${err instanceof Error ? err.message : String(err)}`);
      failed = true; break;
    }
  }
  if (!failed) ok++;
}

// Одинаковые подписи у разных полей одного калькулятора. Проверка не
// косметическая: подписи вытаскиваются разбором чужой вёрстки, и типовая
// ошибка выглядит именно так — поле получает подпись СОСЕДА и врач заполняет
// не то. Так переключатель единиц мочевины у лития унаследовал подпись самого
// поля мочевины: два поля подряд «Азот мочевины крови (BUN)».
//
// Внутри разных групп повторы законны: у PASI «Эритема (E)» есть в каждой из
// четырёх областей тела, и это правильно.
for (const e of calcEntries) {
  const seen = new Map<string, string>();
  for (const f of e.fields) {
    if (f.fixedValue !== undefined) continue;
    const scope = `${f.group ?? ""}|${f.label}`;
    if (seen.has(scope)) problems.push(`${e.id}: одинаковая подпись «${f.label}» у полей ${seen.get(scope)} и ${f.key}`);
    else seen.set(scope, f.key);
  }
  const keys = e.fields.map(f => f.key);
  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupKeys.length) problems.push(`${e.id}: повторяющиеся ключи полей: ${[...new Set(dupKeys)].join(", ")}`);
}

// Два калькулятора с одинаковым названием и описанием — это одна и та же
// вещь, попавшая в список дважды. В каталоге MedCalc такие пары есть
// (lab_winter и winter_formula — формула Винтера под двумя рубриками), и
// импортёр обязан сливать их в одну запись с двумя разделами. Если слияние
// перестанет работать, врач увидит две неразличимые строки и будет гадать,
// чем они отличаются.
const shapes = new Map<string, string>();
for (const e of calcEntries) {
  const shape = `${e.name}|${e.description}`;
  if (shapes.has(shape)) problems.push(`одинаковые калькуляторы в списке: ${shapes.get(shape)} и ${e.id} («${e.name}»)`);
  else shapes.set(shape, e.id);
}

// Кто импортирует тяжёлый catalog.ts. В нём около 300 КБ описаний полей, и он
// рассчитан на загрузку по требованию — вместе с блоком калькуляторов, который
// подключён через lazy(). Импорт из любого другого места кладёт эти 300 КБ в
// основной бандл всем, включая врачей, которые в калькуляторы не заходят.
// Один такой импорт из вкладки клинреков это уже устраивал: бандл вырос
// с 856 до 1049 КБ, и заметить это можно было только по цифрам сборки.
// Для показа названий есть лёгкий index.ts.
const CATALOG_IMPORT_ALLOWED = ["src/utils/calculatorRegistry.ts"];
const srcRoot = path.resolve(import.meta.dirname ?? ".", "../src");
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name))
      : /\.tsx?$/.test(d.name) ? [path.join(dir, d.name)] : []);
for (const file of walk(srcRoot)) {
  const rel = path.relative(path.resolve(srcRoot, ".."), file);
  if (rel.startsWith("src/generated/")) continue;
  if (CATALOG_IMPORT_ALLOWED.includes(rel)) continue;
  if (/from\s+["'][^"']*generated\/calculators\/catalog["']/.test(fs.readFileSync(file, "utf8"))) {
    problems.push(`${rel} импортирует тяжёлый catalog.ts — для названий есть generated/calculators/index.ts`);
  }
}

// Привязка калькуляторов к диагнозам ссылается на идентификаторы каталога
// руками. Опечатка или переименование при следующем импорте не сломают ни
// сборку, ни расчёт — блок просто молча покажет врачу меньше, чем должен.
const known = new Set(calcEntries.map(e => e.id));
for (const [tag, ids] of Object.entries(CALCULATORS_BY_DIAGNOSIS)) {
  const gone = ids.filter(id => !known.has(id));
  if (gone.length) problems.push(`диагноз «${tag}»: в каталоге нет калькуляторов ${gone.join(", ")}`);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) problems.push(`диагноз «${tag}»: повторы ${[...new Set(dup)].join(", ")}`);
}

// Полнота подписей результата. Импортёр может вытащить из MedCalc новый
// калькулятор с полем, для которого подписи нет нигде, — и блок покажет врачу
// английский ключ вроде «Stage Number». Это не ломает расчёт, поэтому само
// себя не обнаружит: ловим здесь.
const untranslated: string[] = [];
for (const e of calcEntries) {
  for (const r of e.result) {
    const plain = r.subKey ?? r.key;
    if (r.label || r.nested || STYLE_KEYS.has(plain) || PROSE_KEYS.has(plain)) continue;
    if (RESULT_LABELS[`${e.id}.${plain}`] || COMMON_RESULT_LABELS[plain]) continue;
    untranslated.push(`${e.id}.${plain}`);
  }
}
if (untranslated.length) {
  problems.push(`поля результата без русской подписи (${untranslated.length}): ${untranslated.join(", ")}`);
}

console.log(`прогнано без ошибок: ${ok} из ${calcEntries.length}`);
if (notes.length) {
  console.log(`\nзаметки (${notes.length}):`);
  for (const n of notes) console.log("  · " + n);
}
if (problems.length) {
  console.log(`\nпроблемы (${problems.length}):`);
  for (const p of problems) console.log("  · " + p);
}
// Выходим явно: vite-node держит собственный модульный граф и сам не
// завершается, а скрипт задуман на один заход.
process.exit(problems.length ? 1 : 0);
