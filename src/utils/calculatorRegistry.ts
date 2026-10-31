import { calcCategories, calcEntries, type CalcEntry, type CalcField } from "../generated/calculators/catalog";
import { getCalculatorsForDiagnosis } from "../config/diagnosisCalculators";

export type { CalcEntry, CalcField };
export { calcCategories, calcEntries };

// Файлы расчёта грузятся по требованию: их сто один, каждый со своими
// таблицами интерпретации, и тянуть всё в основной бандл ради одного
// открытого калькулятора незачем.
const modules = import.meta.glob("../generated/calculators/lib/*.ts");

export type CalcFn = (input: Record<string, unknown>) => Record<string, unknown>;

export async function loadCalculator(entry: CalcEntry): Promise<CalcFn> {
  const load = modules[`../generated/calculators/lib/${entry.module}.ts`];
  if (!load) throw new Error(`нет файла расчёта: ${entry.module}`);
  const mod = (await load()) as Record<string, unknown>;
  const fn = mod[entry.fn];
  if (typeof fn !== "function") throw new Error(`в ${entry.module} нет функции ${entry.fn}`);
  return fn as CalcFn;
}

export const categoryName = (id: string) => calcCategories.find(c => c.id === id)?.name ?? id;

// Специальность врача → разделы калькуляторов. У терапевта разделов несколько:
// он и есть тот, кто пользуется чужими шкалами чаще всех. Пустой список —
// не ошибка: для офтальмологии и стоматологии клинических калькуляторов в
// исходном наборе нет, и придумывать соответствие «лишь бы не пусто» значило
// бы поднять наверх заведомо нерелевантное.
const BY_SPECIALTY: Record<string, string[]> = {
  therapist: ["cardiology", "pulmonology", "endocrinology", "nephrology", "gastro", "lab"],
  cardiologist: ["cardiology"],
  neurologist: ["neurology"],
  endocrinologist: ["endocrinology"],
  psychiatrist: ["psychiatry"],
  pediatrician: ["pediatrics"],
  pulmonologist: ["pulmonology"],
  gastroenterologist: ["gastro"],
  gynecologist: ["obstetrics"],
  orthopedist: ["trauma"],
  urologist: ["nephrology"],
  dermatologist: [],
  ophthalmologist: [],
  otolaryngologist: [],
  ultrasound: [],
  dentist: [],
};

// Класс МКБ-10 по первой букве кода → раздел калькуляторов. Связь грубая, на
// уровне системы органов, и годится ровно на то, для чего используется:
// поднять подходящие шкалы выше в списке. Ничего не выбирается автоматически —
// по одному коду подходящих шкал обычно несколько, и подставить не ту значит
// решить за врача.
const BY_ICD_CHAPTER: Record<string, string[]> = {
  I: ["cardiology"], J: ["pulmonology"], N: ["nephrology"], K: ["gastro"],
  E: ["endocrinology"], G: ["neurology"], F: ["psychiatry"], M: ["rheumatology"],
  O: ["obstetrics"], C: ["oncology"], S: ["trauma"], T: ["trauma"],
};

function icdCategories(code: string | null | undefined): string[] {
  if (!code) return [];
  const letter = code[0]?.toUpperCase();
  if (letter === "D") {
    // D00–D48 — новообразования, D50–D89 — кровь и иммунитет.
    const n = parseInt(code.slice(1, 3), 10);
    return Number.isFinite(n) ? (n <= 48 ? ["oncology"] : ["hematology"]) : [];
  }
  return BY_ICD_CHAPTER[letter] ?? [];
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

/**
 * Порядок списка: сначала подходящие диагнозу, затем специальности врача,
 * затем избранные MedCalc, затем остальные. Внутри группы — по названию.
 */
/**
 * Порядок списка: сначала шкалы, привязанные к самому диагнозу, потом
 * подходящие его классу МКБ, потом специальности врача, потом избранные.
 *
 * Точная привязка (diagnosisTag) и грубая (класс МКБ) — разные вещи, и
 * смешивать их нельзя: под «фибрилляцию предсердий» точная даёт две шкалы,
 * а класс I — все два десятка кардиологических, включая расчёт сердечного
 * выброса по Фику. Поэтому у них разные группы и разные заголовки.
 */
export function rankedEntries(specialtyId: string, icdCode: string | null, diagnosisTag?: string | null): {
  entry: CalcEntry; reason: "exact" | "diagnosis" | "specialty" | null;
}[] {
  const exact = new Set(getCalculatorsForDiagnosis(diagnosisTag));
  const byIcd = new Set(icdCategories(icdCode));
  const bySpec = new Set(BY_SPECIALTY[specialtyId] ?? []);
  // Разделов у калькулятора бывает несколько (формула Винтера — и нефрология,
  // и лабораторная диагностика), поэтому подходящим считается совпадение по
  // любому из них.
  const inIcd = (e: CalcEntry) => e.categories.some(c => byIcd.has(c));
  const inSpec = (e: CalcEntry) => e.categories.some(c => bySpec.has(c));
  const rank = (e: CalcEntry) =>
    exact.has(e.id) ? 0 : inIcd(e) ? 1 : inSpec(e) ? 2 : e.featured ? 3 : 4;
  return [...calcEntries]
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "ru"))
    .map(entry => ({
      entry,
      reason: exact.has(entry.id) ? "exact" as const
        : inIcd(entry) ? "diagnosis" as const
        : inSpec(entry) ? "specialty" as const : null,
    }));
}

// Названия и описания в MedCalc написаны через аббревиатуры: «СКФ (расчётная)»
// найдётся по «скф», но не по «клубочковая фильтрация». Поэтому в поиск идут
// ещё и подписи полей — там лежит клиническая лексика, которой врач и
// пользуется: «креатинин», «билирубин», «мокрота».
const haystack = new Map<string, string>(
  calcEntries.map(e => [e.id, norm([
    e.name, e.shortName ?? "", e.description, ...e.categories.map(categoryName),
    ...e.fields.map(f => f.label),
  ].join(" "))]),
);

export function searchEntries(query: string): CalcEntry[] {
  const q = norm(query.trim());
  if (!q) return [];
  const inName = (e: CalcEntry) =>
    norm(e.name).includes(q) || norm(e.shortName ?? "").includes(q) || norm(e.description).includes(q);
  return calcEntries
    .filter(e => haystack.get(e.id)!.includes(q))
    // Совпадение в названии и описании важнее совпадения в подписи поля:
    // иначе «креатинин» вынесет наверх десяток шкал, где он лишь один из
    // входов, а не то, что считают.
    .sort((a, b) => Number(inName(b)) - Number(inName(a)) || a.name.localeCompare(b.name, "ru"));
}
