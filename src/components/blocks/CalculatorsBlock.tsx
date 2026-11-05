import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, Search, Star, Weight, X } from "lucide-react";
import DosageCalcPanel from "./DosageCalcBlock";
import {
  calcCategories, calcEntries, categoryName, loadCalculator, rankedEntries, searchEntries,
  type CalcEntry, type CalcField, type CalcFn,
} from "../../utils/calculatorRegistry";

interface ActiveDiagnosis { code: string; name: string; category?: string }
interface ActiveDrug { mnn: string; note?: string; group?: string }

interface CalculatorsPanelProps {
  specialtyId: string;
  activeDiagnosis?: ActiveDiagnosis | null;
  onClearDiagnosis?: () => void;
  activeDrug?: ActiveDrug | null;
  /** Калькулятор, открытый переходом с вкладки клинреков. */
  initialCalculatorId?: string | null;
  onConsumeInitial?: () => void;
}

/** Расчёт дозы по массе тела — не из MedCalc, поэтому отдельный идентификатор. */
const DOSAGE_ID = "__dosage__";

// Служебные поля результата: оформление, а не клинический вывод.
export const STYLE_KEYS = new Set(["severity", "color"]);
// Поля со свободным русским текстом — они сами себя объясняют, подпись к ним
// в MedCalc не выводится и здесь была бы шумом.
export const PROSE_KEYS = new Set([
  "interpretation", "recommendation", "description", "rationale", "prognosis",
  "invalidReason", "cause", "gapInterpretation", "ciInterpretation",
  "ktvInterpretation", "urrInterpretation", "stageDescription", "details",
  "breakdown", "note", "symptoms", "action", "status",
]);

// Общие термины, которые в MedCalc выводятся без подписи (ResultCard печатает
// их в шапке карточки). Это словарь интерфейса, а не данные калькулятора:
// значения приходят из перенесённых файлов расчёта и уже по-русски.
export const COMMON_RESULT_LABELS: Record<string, string> = {
  score: "Балл", total: "Сумма", value: "Значение", level: "Уровень",
  category: "Категория", risk: "Риск", riskLevel: "Уровень риска",
  riskGroup: "Группа риска", mortality: "Летальность", diagnosis: "Заключение",
  probability: "Вероятность", stage: "Стадия", grade: "Степень",
  activity: "Активность", activityLabel: "Активность", unit: "Единицы",
  formula: "Формула", positive: "Результат положительный", zone: "Зона",
  target: "Цель", ratio: "Отношение", adjustedScore: "Скорректированный балл",
};

// Второстепенные строки результата, названия которых MedCalc нигде не выводит
// по-русски: у каждого калькулятора свои. Ключ здесь составной, «id.поле», —
// одно и то же слово у разных шкал значит разное (somatic у BDI-II это
// субшкала депрессии, а у HAMA — соматическая тревога).
//
// Полнота этой таблицы проверяется скриптом scripts/check-calculators.ts: он
// падает, если в перенесённом наборе появилось поле результата, для которого
// нет ни подписи из MedCalc, ни строки здесь.
export const RESULT_LABELS: Record<string, string> = {
  "hasbled.annualBleedingRisk": "Годовой риск кровотечения",
  "grace.mortalityCategory": "Категория риска смерти",
  "cockcroft_gault.stageNumber": "Стадия ХБП, номер",
  "anion_gap.hasAlbuminCorrection": "Введена поправка на альбумин",
  "corrected_na.coefficient": "Коэффициент поправки",
  "wells_pe.probabilityClassic": "Вероятность, трёхуровневая шкала",
  "wells_pe.percentRiskClassic": "Риск, трёхуровневая шкала",
  "wells_pe.percentRiskBinary": "Риск, двухуровневая шкала",
  "aa_gradient.normalGradient": "Норма градиента для возраста",
  "parkland.rateFirst8h": "Скорость инфузии, первые 8 ч",
  "parkland.rateNext16h": "Скорость инфузии, следующие 16 ч",
  "meld.mortality90day": "Смертность за 90 дней",
  "meld3.mortality90Day": "Смертность за 90 дней",
  "ibw.abw": "Фактическая масса тела",
  "ibw.isObese": "Ожирение",
  "mifflin.activityMultiplier": "Коэффициент активности",
  "ldl_friedewald.valid": "Формула применима",
  "phq9.suicidalRisk": "Риск суицида",
  "hamd17.suicidalRisk": "Риск суицида",
  "naegele.gestationalWeeks": "Срок беременности, недель",
  "pcr_urine.dailyEstimate": "Оценка суточной потери белка",
  "fick_co.vo2": "Потребление кислорода (VO₂)",
  "fick_co.ci": "Сердечный индекс",
  "revised_geneva.prevalence": "Распространённость ТЭЛА в группе",
  "rockall.rebleed": "Риск повторного кровотечения",
  "phq2.positiveScreen": "Скрининг положительный",
  "bdi2.cognitiveAffective": "Когнитивно-аффективная субшкала",
  "bdi2.somatic": "Соматическая субшкала",
  "bdi2.suicidalIdeation": "Суицидальные мысли",
  "hama.psychicSubscale": "Психическая тревога, субшкала",
  "hama.somaticSubscale": "Соматическая тревога, субшкала",
  "pcl5.clusterB": "Кластер B — навязчивые воспоминания",
  "pcl5.clusterC": "Кластер C — избегание",
  "pcl5.clusterD": "Кластер D — негативные изменения мыслей и настроения",
  "pcl5.clusterE": "Кластер E — возбудимость и реактивность",
  "pcl5.provisionalPTSD": "Предварительные критерии ПТСР выполнены",
  "hcl32.activatingCount": "Активирующих признаков",
  "hcl32.inhibitingCount": "Тормозящих признаков",
  "audit.auditC": "AUDIT-C, первые три вопроса",
  "ktv.urr": "URR, коэффициент снижения мочевины",
  "winter_formula.expectedPaCO2High": "Ожидаемый PaCO₂, верхняя граница",
  "winter_formula.measuredPaCO2": "Измеренный PaCO₂",
  "rts.trts": "T-RTS, триажный вариант",
  "abc_score.mtpProbability": "Вероятность массивной трансфузии",
  "calvert.effectiveGFR": "СКФ, использованная в расчёте",
  "khorana.vteRate": "Частота венозных тромбоэмболий",
  "ecog.karnofsky": "Индекс Карновского",
  "mascc.complicationRate": "Частота осложнений",
  "pk_basics.vdTotal": "Общий объём распределения",
  "pk_basics.ke": "Константа элиминации",
  "four_t_hit.hitRate": "Вероятность гепарин-индуцированной тромбоцитопении",
  "holliday_segar.hourlyMl": "Скорость инфузии, мл/ч",
  "eag_hba1c.eagMmolL": "Средняя глюкоза, ммоль/л",
  "psi_port.riskClass": "Класс риска",
  "ipss.qol": "Качество жизни, баллов",
  "mdq.part1Count": "Часть 1: положительных ответов",
  "mdq.part1Positive": "Часть 1 положительна",
  "mdq.part2Positive": "Часть 2 положительна (симптомы одновременно)",
  "mdq.part3Positive": "Часть 3 положительна (значимые проблемы)",
  "mdq.overallPositive": "Скрининг положительный",
  "lithium_perry.rawDose": "Расчётная доза Li₂CO₃, мг/сут",
  "lithium_perry.roundedDose": "Ближайшая стандартная доза, мг/сут",
  "lithium_cooper.dose": "Доза по номограмме, мг/сут",
  "lithium_cooper.formulaDose": "Доза по формуле, мг/сут",
};

const resultLabel = (calcId: string, key: string, label?: string) =>
  label ?? RESULT_LABELS[`${calcId}.${key}`] ?? COMMON_RESULT_LABELS[key]
  // Незнакомый ключ показываем как есть, разбив по словам: скрывать вывод
  // калькулятора из-за отсутствия перевода нельзя — врач должен видеть всё,
  // что посчитано. Проверка в check-calculators.ts следит, чтобы сюда не
  // доходило ничего нового.
  ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());

/**
 * Группирует подряд идущие элементы, сохраняя исходный порядок: он в MedCalc
 * осмысленный (области тела сверху вниз, вопросы по номерам), и сортировать
 * его нельзя.
 */
function groupInOrder<T>(items: T[], keyOf: (x: T) => string | undefined): [string | undefined, T[]][] {
  const out: [string | undefined, T[]][] = [];
  for (const item of items) {
    const k = keyOf(item);
    const last = out[out.length - 1];
    if (last && last[0] === k) last[1].push(item);
    else out.push([k, [item]]);
  }
  return out;
}

/** Булево в результате — это «есть/нет», а не «true/false». */
const formatValue = (v: unknown) => (typeof v === "boolean" ? (v ? "Да" : "Нет") : String(v));

const SEVERITY_STYLE: Record<string, string> = {
  normal: "bg-success-50 border-success-200 text-success-800",
  warning: "bg-warning-50 border-warning-200 text-warning-900",
  error: "bg-error-50 border-error-200 text-error-900",
};

/** Приводит введённое к типу, который ждёт функция расчёта. */
function coerce(field: CalcField, raw: unknown): unknown {
  if (field.fixedValue !== undefined) return field.fixedValue;
  if (field.kind === "boolean") return raw === true;
  if (field.kind === "text" || field.kind === "date") return typeof raw === "string" ? raw : "";
  if (field.kind === "select") {
    const opt = field.options?.find(o => String(o.value) === String(raw));
    return opt ? opt.value : field.options?.[0]?.value;
  }
  const n = parseFloat(String(raw ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Значения по умолчанию: флажки сняты, списки — на первом варианте. */
function initialValues(entry: CalcEntry): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const f of entry.fields) {
    if (f.fixedValue !== undefined) continue;
    v[f.key] = f.kind === "boolean" ? false
      : f.kind === "select" ? String(f.options?.[0]?.value ?? "")
      : "";
  }
  return v;
}

// Клинические калькуляторы: 101 шкала и формула, перенесённые из MedCalc
// скриптом scripts/import-calculators.mjs. Ни одна цифра здесь не считается
// моделью — это те же чистые функции, что и в источнике, вместе с их
// таблицами интерпретации и ссылками на первоисточник.
//
// Вкладка раньше называлась «Дозы» и содержала только расчёт по массе тела,
// у которого пресеты были заполнены ровно для одной специальности из
// шестнадцати — для остальных вкладка открывалась пустой. Расчёт по весу
// никуда не делся, он стал первым пунктом списка.
//
// Порядок списка зависит от диагноза и специальности, но НИЧЕГО не
// выбирается автоматически. По одному коду МКБ подходящих шкал обычно
// несколько, и открыть не ту — значит посчитать пациенту чужой риск. Та же
// причина, по которой не выбирает сам ни калькулятор доз, ни клинреки.
export default function CalculatorsPanel({
  specialtyId, activeDiagnosis = null, onClearDiagnosis, activeDrug = null,
  initialCalculatorId = null, onConsumeInitial,
}: CalculatorsPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Переход с вкладки клинреков открывает конкретный калькулятор. Заявку
  // сразу гасим: иначе кнопка «Все калькуляторы» возвращала бы в список, а
  // следующий же рендер снова открывал тот же калькулятор.
  useEffect(() => {
    if (!initialCalculatorId) return;
    setOpenId(initialCalculatorId);
    setQuery("");
    onConsumeInitial?.();
  }, [initialCalculatorId, onConsumeInitial]);

  const ranked = useMemo(
    () => rankedEntries(specialtyId, activeDiagnosis?.code ?? null, activeDiagnosis?.category),
    [specialtyId, activeDiagnosis?.code, activeDiagnosis?.category],
  );
  const found = useMemo(() => searchEntries(query), [query]);

  if (openId === DOSAGE_ID) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <DetailHeader title="Доза по массе тела" onBack={() => setOpenId(null)} />
        <DosageCalcPanel
          specialtyId={specialtyId}
          activeDiagnosis={activeDiagnosis}
          onClearDiagnosis={onClearDiagnosis}
          activeDrug={activeDrug}
        />
      </div>
    );
  }

  if (openId) {
    const entry = ranked.find(r => r.entry.id === openId)?.entry;
    if (entry) return <CalculatorDetail entry={entry} onBack={() => setOpenId(null)} />;
  }

  const searching = query.trim().length > 0;
  const exact = ranked.filter(r => r.reason === "exact");
  const suggested = ranked.filter(r => r.reason === "diagnosis" || r.reason === "specialty");

  return (
    <>
      <div className="px-[var(--bl-pad)] pt-[var(--bl-pad)]">
        {activeDiagnosis && (
          <div className="flex items-center gap-1.5 bg-primary-50 border border-primary-200 rounded-md px-2 py-1 bl-label text-primary-800 mb-2">
            <span className="truncate">Диагноз: {activeDiagnosis.code} {activeDiagnosis.name}</span>
            <button onClick={onClearDiagnosis} className="ml-auto flex-shrink-0 text-primary-600 hover:text-primary-800">
              <X size={12} />
            </button>
          </div>
        )}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ds-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Поиск среди ${calcEntries.length} калькуляторов`}
            className="w-full bg-ds-50 border border-ds-400 pl-8 pr-3 py-1.5 bl-label rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack-sm)] overflow-y-auto flex-1 bg-ds-50">
        {searching ? (
          found.length === 0
            ? <p className="text-center bl-label text-ds-600 mt-6">Ничего не найдено</p>
            : found.map(e => <EntryRow key={e.id} entry={e} onOpen={() => setOpenId(e.id)} />)
        ) : (
          <>
            <button
              onClick={() => setOpenId(DOSAGE_ID)}
              className="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border border-ds-400 bg-white hover:border-primary-400 transition-colors text-left"
            >
              <Weight size={13} className="flex-shrink-0 mt-0.5 text-primary-600" />
              <div className="flex-1 min-w-0">
                <span className="bl-label font-bold text-ds-900">Доза по массе тела</span>
                <p className="bl-caption text-ds-600 leading-snug">Разовая и суточная доза, мг/кг × вес</p>
              </div>
            </button>

            {/* Точная привязка к диагнозу и грубая по классу МКБ разведены:
                первая — это «шкалы для фибрилляции предсердий», вторая —
                «вообще кардиологические». Общий заголовок над ними выдавал бы
                вторые за первые. */}
            {exact.length > 0 && (
              <Group title={`Под диагноз ${activeDiagnosis?.code ?? ""}`}>
                {exact.map(({ entry }) => (
                  <EntryRow key={entry.id} entry={entry} highlight onOpen={() => setOpenId(entry.id)} />
                ))}
              </Group>
            )}

            {suggested.length > 0 && (
              <Group title={activeDiagnosis ? "По профилю диагноза и специальности" : "По вашей специальности"}>
                {suggested.map(({ entry }) => (
                  <EntryRow key={entry.id} entry={entry} onOpen={() => setOpenId(entry.id)} />
                ))}
              </Group>
            )}

            {calcCategories.map(cat => {
              // Калькулятор с двумя разделами показывается в обоих: тот, кто
              // открыл «Лабораторную диагностику», должен найти формулу
              // Винтера там, а не только в нефрологии. В поиске он при этом
              // остаётся одной строкой.
              const items = ranked.filter(r => !r.reason && r.entry.categories.includes(cat.id));
              if (items.length === 0) return null;
              return (
                <Group key={cat.id} title={`${cat.icon} ${cat.name}`}>
                  {items.map(({ entry }) => (
                    <EntryRow key={entry.id} entry={entry} onOpen={() => setOpenId(entry.id)} />
                  ))}
                </Group>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

interface GroupProps { title: string; children: ReactNode }

function Group({ title, children }: GroupProps) {
  return (
    <div className="pt-1">
      <p className="bl-caption font-bold text-ds-600 uppercase tracking-wide mb-1">{title}</p>
      <div className="space-y-[var(--bl-stack-sm)]">{children}</div>
    </div>
  );
}

interface EntryRowProps { entry: CalcEntry; highlight?: boolean; onOpen: () => void }

function EntryRow({ entry, highlight, onOpen }: EntryRowProps) {
  return (
    <button
      onClick={onOpen}
      className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors ${
        highlight ? "bg-primary-50/60 border-primary-200 hover:border-primary-400" : "bg-white border-ds-400 hover:border-primary-400"
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className="bl-label font-bold text-ds-900">{entry.name}</span>
        {entry.shortName && entry.shortName !== entry.name && (
          <span className="bl-caption text-ds-600 ml-1.5">{entry.shortName}</span>
        )}
        <p className="bl-caption text-ds-600 leading-snug">{entry.description}</p>
      </div>
      {entry.featured && <Star size={11} className="flex-shrink-0 mt-0.5 text-warning-500" />}
    </button>
  );
}

interface DetailHeaderProps { title: string; onBack: () => void }

function DetailHeader({ title, onBack }: DetailHeaderProps) {
  return (
    <div className="flex items-center gap-1.5 px-[var(--bl-pad)] pt-[var(--bl-pad)] pb-1.5 flex-shrink-0">
      <button onClick={onBack} className="flex items-center gap-1 bl-caption text-ds-600 hover:text-primary-700 transition-colors">
        <ArrowLeft size={13} /> Все калькуляторы
      </button>
      <span className="bl-label font-bold text-ds-900 ml-auto truncate">{title}</span>
    </div>
  );
}

interface CalculatorDetailProps { entry: CalcEntry; onBack: () => void }

function CalculatorDetail({ entry, onBack }: CalculatorDetailProps) {
  const [fn, setFn] = useState<CalcFn | null>(null);
  const [failed, setFailed] = useState(false);
  const [values, setValues] = useState(() => initialValues(entry));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setFn(null); setFailed(false); setValues(initialValues(entry));
    loadCalculator(entry)
      .then(f => { if (alive) setFn(() => f); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [entry]);

  // Ключ поля — это путь: у PASI он двухуровневый («head.erythema»), потому что
  // функция расчёта ждёт структуру из четырёх областей тела.
  const input = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of entry.fields) {
      const v = coerce(f, values[f.key]);
      const path = f.key.split(".");
      let node = out;
      for (const part of path.slice(0, -1)) {
        if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
        node = node[part] as Record<string, unknown>;
      }
      node[path[path.length - 1]] = v;
    }
    return out;
  }, [entry, values]);

  const missing = entry.fields.filter(f => {
    if (f.fixedValue !== undefined || f.optional) return false;
    if (f.kind === "number") return input[f.key] === null;
    // Пустая дата уходит в new Date("") и превращает весь расчёт в NaN, ничем
    // не отличимый от настоящего ответа, — поэтому она тоже обязательна.
    if (f.kind === "date") return !String(input[f.key] ?? "").trim();
    return false;
  });

  // Функция расчёта — чужой код с собственными допущениями о входе. Если она
  // на каком-то сочетании падает, показываем это прямо, а не «результат
  // недоступен»: молча проглоченная ошибка выглядит как отсутствие риска.
  const [result, error] = useMemo<[Record<string, unknown> | null, string | null]>(() => {
    if (!fn || missing.length > 0) return [null, null];
    try {
      // Номограмма Купера принимает голое число, а не объект.
      const arg = entry.scalarArg ? input[entry.fields[0].key] : input;
      return [fn(arg as Record<string, unknown>), null];
    } catch (e) {
      return [null, e instanceof Error ? e.message : "не удалось посчитать"];
    }
  }, [fn, input, missing.length, entry]);

  const lines = useMemo(() => {
    if (!result) return [];
    const at = (path: string) => path.split(".").reduce<unknown>(
      (node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
      result,
    );
    return entry.result
      .map(r => ({ ...r, plain: r.subKey ?? r.key, value: at(r.key) }))
      .filter(r => !STYLE_KEYS.has(r.plain) && r.value !== undefined && r.value !== null && typeof r.value !== "object")
      .map(r => ({
        key: r.key,
        group: r.group,
        label: resultLabel(entry.id, r.plain, r.label),
        prose: PROSE_KEYS.has(r.plain),
        value: r.value,
      }));
  }, [entry, result]);

  // Часть формул MedCalc делит на разность, которая может оказаться нулём
  // (delta_delta при HCO₃ = 24). Печатать «NaN» или «Infinity» рядом с
  // подписью «Отношение» нельзя: это выглядит как посчитанный ответ.
  const undefinedResult = !!result && Object.values(result)
    .some(v => typeof v === "number" && !Number.isFinite(v));

  const severity = String(result?.severity ?? "");

  const groupedFields = useMemo(
    () => groupInOrder(entry.fields.filter(f => f.fixedValue === undefined), f => f.group),
    [entry],
  );
  const groupedLines = useMemo(() => groupInOrder(lines, l => l.group), [lines]);
  const copyText = () => {
    const text = [
      entry.name,
      ...lines.map(l => (l.prose ? String(l.value) : `${l.label}: ${formatValue(l.value)}`)),
      entry.citation ? `Источник: ${entry.citation}` : null,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <DetailHeader title={entry.shortName ?? entry.name} onBack={onBack} />

      <div className="p-[var(--bl-pad)] pt-0 space-y-[var(--bl-stack-lg)] overflow-y-auto flex-1 bg-ds-50">
        <div>
          <p className="bl-label font-bold text-ds-900">{entry.name}</p>
          <p className="bl-caption text-ds-600 leading-snug">{entry.description}</p>
          <p className="bl-caption text-ds-500 mt-0.5">{entry.categories.map(categoryName).join(" · ")}</p>
        </div>

        <p className="bl-caption text-warning-700 bg-warning-50 border border-warning-200 rounded-md px-2 py-1.5 leading-snug">
          Справочный расчёт, не заменяет клиническое суждение.
        </p>

        {failed && (
          <p className="bl-label text-error-700 bg-error-50 border border-error-200 rounded-md px-2 py-1.5">
            Не удалось загрузить этот калькулятор.
          </p>
        )}

        <div className="space-y-[var(--bl-stack-lg)]">
          {groupedFields.map(([group, groupFields]) => (
            <div key={group || "—"} className="space-y-[var(--bl-stack-lg)]">
              {/* Заголовок области у PASI обязателен: подписи полей внутри
                  областей одинаковые, и без него врач не знает, какую часть
                  тела он сейчас оценивает. */}
              {group && (
                <p className="bl-label font-bold text-ds-900 border-b border-ds-300 pb-1">{group}</p>
              )}
              {groupFields.map(f => (
                <Field
                  key={f.key}
                  field={f}
                  value={values[f.key]}
                  onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                />
              ))}
            </div>
          ))}
        </div>

        {error && (
          <p className="bl-label text-error-700 bg-error-50 border border-error-200 rounded-md px-2 py-1.5">
            Расчёт не выполнен: {error}. Проверьте введённые значения.
          </p>
        )}

        {undefinedResult && (
          <p className="bl-label text-warning-900 bg-warning-50 border border-warning-200 rounded-md px-2 py-1.5 leading-snug">
            При этих значениях формула не определена — в расчёте получается деление на ноль.
            Проверьте введённые данные.
          </p>
        )}

        {result && !undefinedResult && lines.length > 0 && (
          <div className={`rounded-lg border p-3 space-y-1.5 ${SEVERITY_STYLE[severity] ?? "bg-white border-primary-200"}`}>
            {groupedLines.map(([group, groupLines]) => (
              <div key={group || "—"} className="space-y-1.5">
                {/* У HADS результат состоит из двух подшкал — тревоги и
                    депрессии, — и балл без указания подшкалы бессмыслен. */}
                {group && <p className="bl-caption font-bold uppercase tracking-wide opacity-70 pt-1">{group}</p>}
                {groupLines.map(l => (
                  l.prose
                    ? <p key={l.key} className="bl-body leading-snug">{String(l.value)}</p>
                    : (
                      <div key={l.key} className="flex justify-between gap-2 bl-body">
                        <span className="opacity-80">{l.label}</span>
                        <span className="font-bold text-right">{formatValue(l.value)}</span>
                      </div>
                    )
                ))}
              </div>
            ))}
            <button
              onClick={copyText}
              className="flex items-center gap-1 bl-caption opacity-70 hover:opacity-100 transition-opacity pt-1"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Скопировано" : "Копировать результат"}
            </button>
          </div>
        )}

        {!result && !error && !failed && missing.length > 0 && (
          <p className="text-center bl-label text-ds-600">
            Заполните {missing.length === 1 ? "поле" : "поля"}: {missing.map(f => f.label).join(", ")}
          </p>
        )}

        {entry.citation && (
          <p className="bl-caption text-ds-500 leading-snug border-t border-ds-300 pt-2">{entry.citation}</p>
        )}
      </div>
    </div>
  );
}

interface FieldProps { field: CalcField; value: unknown; onChange: (v: unknown) => void }

function Field({ field, value, onChange }: FieldProps) {
  if (field.kind === "boolean") {
    return (
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value === true}
          onChange={e => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 flex-shrink-0 accent-primary-500"
        />
        <span className="flex-1 min-w-0">
          <span className="bl-body text-ds-900">{field.label}</span>
          {field.points && <span className="bl-caption text-primary-600 ml-1.5">{field.points}</span>}
          {field.hint && <span className="block bl-caption text-ds-600 leading-snug">{field.hint}</span>}
        </span>
      </label>
    );
  }

  const label = (
    <label className="bl-caption font-bold text-ds-600 uppercase tracking-wide mb-1 block">
      {field.label}
      {field.unit && <span className="normal-case text-ds-500 font-normal ml-1">, {field.unit}</span>}
      {field.optional && <span className="normal-case text-ds-500 font-normal ml-1">— необязательно</span>}
    </label>
  );
  const box = "w-full bg-white border border-ds-400 px-3 py-2 bl-body rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div>
      {label}
      {field.kind === "date" ? (
        <input
          type="date"
          value={String(value ?? "")}
          onChange={e => onChange(e.target.value)}
          className={box}
        />
      ) : field.kind === "select" ? (
        <select value={String(value ?? "")} onChange={e => onChange(e.target.value)} className={box}>
          {field.options?.map(o => (
            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          inputMode={field.kind === "number" ? "decimal" : "text"}
          value={String(value ?? "")}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={box}
        />
      )}
      {field.hint && <p className="bl-caption text-ds-600 mt-0.5 leading-snug">{field.hint}</p>}
    </div>
  );
}
