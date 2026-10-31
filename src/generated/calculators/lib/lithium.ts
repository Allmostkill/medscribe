// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/lithium.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type LithiumMode = "perry" | "cooper" | "level";
export type LithiumIndication = "acute_mania" | "maintenance" | "elderly";

// Standard available doses of Li2CO3 (mg/day)
const STANDARD_DOSES = [300, 450, 600, 750, 900, 1050, 1200, 1350, 1500, 1800];

export function roundToStandardDose(mgPerDay: number): number {
  return STANDARD_DOSES.reduce((prev, curr) =>
    Math.abs(curr - mgPerDay) < Math.abs(prev - mgPerDay) ? curr : prev
  );
}

// ─── Mode 1: Perry regression ─────────────────────────────────────────────
export type PerryInput = {
  targetCss: number; // mmol/L (0.6–1.0)
  age: number;       // years
  weight: number;    // kg
  bun: number;       // mg/dL (if ureaInMmol=true, convert first)
  ureaInMmol: boolean;
};

export type PerryResult = {
  rawDose: number;
  roundedDose: number;
};

export function calculatePerry(input: PerryInput): PerryResult {
  const bun = input.ureaInMmol ? input.bun * 2.8 : input.bun;
  const rawDose =
    100.5 +
    752.7 * input.targetCss -
    3.6 * input.age +
    7.2 * input.weight -
    13.7 * bun;

  return {
    rawDose: Math.round(rawDose),
    roundedDose: roundToStandardDose(rawDose),
  };
}

// ─── Mode 2: Cooper nomogram ──────────────────────────────────────────────
// Lookup table: C24h (mmol/L) → dose (mg/day Li2CO3)
export const cooperTable: { c24h: number; dose: number }[] = [
  { c24h: 0.05, dose: 3600 },
  { c24h: 0.10, dose: 2700 },
  { c24h: 0.15, dose: 1800 },
  { c24h: 0.20, dose: 1200 },
  { c24h: 0.25, dose: 900 },
  { c24h: 0.30, dose: 900 },
  { c24h: 0.35, dose: 600 },
  { c24h: 0.40, dose: 600 },
  { c24h: 0.50, dose: 300 },
];

export type CooperResult = {
  dose: number | null;
  formulaDose: number;
  note: string;
};

export function calculateCooper(c24h: number): CooperResult {
  // Formula: D (mmol/day) = e^(4.80 - 7.5 * C24h)
  const dMmol = Math.exp(4.80 - 7.5 * c24h);
  // Convert: 1 mmol Li = 36.9 mg Li2CO3; Li2CO3 MW=73.89, each molecule has 2 Li ions
  const formulaDose = Math.round(dMmol * 73.89 / 2);

  // Find closest table entry
  const sorted = [...cooperTable].sort(
    (a, b) => Math.abs(a.c24h - c24h) - Math.abs(b.c24h - c24h)
  );
  const closest = sorted[0];

  if (c24h < 0.05) {
    return { dose: 3600, formulaDose, note: "Уровень очень низкий — максимальная доза по номограмме" };
  }
  if (c24h > 0.50) {
    return { dose: 300, formulaDose, note: "Уровень выше 0.50 — минимальная доза по номограмме" };
  }

  return { dose: closest.dose, formulaDose, note: `Ближайшее значение номограммы: C24h = ${closest.c24h} mmol/L` };
}

// ─── Mode 3: Level interpretation ─────────────────────────────────────────
export type LithiumLevelInput = {
  level: number; // mmol/L
  indication: LithiumIndication;
};

export type LithiumLevelResult = {
  severity: "normal" | "warning" | "error";
  status: string;
  description: string;
  symptoms?: string;
  action?: string;
};

const therapeuticRanges: Record<LithiumIndication, { low: number; high: number; label: string }> = {
  acute_mania: { low: 0.8, high: 1.2, label: "Острая мания" },
  maintenance: { low: 0.6, high: 1.0, label: "Поддерживающая терапия" },
  elderly: { low: 0.4, high: 0.7, label: "Пациенты пожилого возраста" },
};

export function interpretLithiumLevel(input: LithiumLevelInput): LithiumLevelResult {
  const { level, indication } = input;
  const range = therapeuticRanges[indication];

  if (level > 2.5) {
    return {
      severity: "error",
      status: "Тяжёлая токсичность",
      description: `КРИТИЧНО: уровень ${level} mmol/L`,
      symptoms: "Судороги, кома, угроза жизни",
      action: "Экстренная госпитализация, рассмотреть гемодиализ, отменить литий",
    };
  } else if (level > 2.0) {
    return {
      severity: "error",
      status: "Умеренно-тяжёлая токсичность",
      description: `Уровень ${level} mmol/L`,
      symptoms: "Атаксия, дизартрия, грубый тремор, риск судорог",
      action: "Госпитализация, отменить литий, форсированный диурез (NaCl в/в)",
    };
  } else if (level > 1.5) {
    return {
      severity: "error",
      status: "Лёгкая — умеренная токсичность",
      description: `Уровень ${level} mmol/L`,
      symptoms: "Тошнота, рвота, тремор, нарушение координации, спутанность",
      action: "Снизить или отменить дозу, обеспечить гидратацию, наблюдение",
    };
  } else if (level > range.high) {
    return {
      severity: "warning",
      status: "Выше терапевтического диапазона",
      description: `Уровень ${level} mmol/L (цель ${range.low}–${range.high} для: ${range.label})`,
      symptoms: "Риск токсичности — контролировать симптомы",
      action: "Снизить дозу или пропустить приём, повторить уровень",
    };
  } else if (level >= range.low) {
    return {
      severity: "normal",
      status: "Терапевтический диапазон",
      description: `Уровень ${level} mmol/L (цель ${range.low}–${range.high} для: ${range.label})`,
      action: "Продолжить текущую дозу, плановый мониторинг",
    };
  } else {
    return {
      severity: "warning",
      status: "Ниже терапевтического диапазона",
      description: `Уровень ${level} mmol/L (цель ${range.low}–${range.high} для: ${range.label})`,
      action: "Рассмотреть увеличение дозы или оценить приверженность",
    };
  }
}

// ─── Drug interactions table ───────────────────────────────────────────────
export const lithiumDrugInteractions = [
  { drug: "НПВС (ибупрофен, диклофенак)", effect: "↑ уровень лития", mechanism: "Снижение почечного клиренса", severity: "Значимое" },
  { drug: "Тиазидные диуретики", effect: "↑ уровень лития (до 50%)", mechanism: "Усиление реабсорбции Na⁺/Li⁺ в проксимальных канальцах", severity: "Значимое" },
  { drug: "Петлевые диуретики (фуросемид)", effect: "↑ или ↓ уровень лития", mechanism: "Зависит от водного баланса", severity: "Умеренное" },
  { drug: "ИАПФ / АРА", effect: "↑ уровень лития (30–60%)", mechanism: "Снижение СКФ и реабсорбция Li⁺", severity: "Значимое" },
  { drug: "Метронидазол", effect: "↑ уровень лития", mechanism: "Снижение почечного клиренса", severity: "Умеренное" },
  { drug: "Теофиллин / кофеин", effect: "↓ уровень лития", mechanism: "Усиление почечной экскреции", severity: "Умеренное" },
  { drug: "Галоперидол (высокие дозы)", effect: "Нейротоксичность", mechanism: "Синергизм при высоких уровнях лития", severity: "Значимое" },
  { drug: "Карбамазепин", effect: "Нейротоксичность без ↑ уровня", mechanism: "Фармакодинамическое взаимодействие", severity: "Значимое" },
  { drug: "Верапамил", effect: "↓ уровень лития", mechanism: "Ускорение почечного клиренса", severity: "Умеренное" },
  { drug: "Трамадол", effect: "Риск серотонинового синдрома", mechanism: "Серотонинергический синергизм", severity: "Умеренное" },
];

// ─── Monitoring schedule ───────────────────────────────────────────────────
export const lithiumMonitoringSchedule = [
  { phase: "До начала терапии", items: "ОАК, креатинин, ТТГ, кальций, ЭКГ (у пожилых), тест на беременность" },
  { phase: "Начало / титрация", items: "Уровень лития через 12 ч — каждые 4–7 дней до стабилизации" },
  { phase: "Стабильная терапия", items: "Уровень лития каждые 3–6 месяцев, функция почек каждые 6 мес, ТТГ ежегодно" },
  { phase: "После смены дозы", items: "Уровень через 5–7 дней (4–5 периодов полувыведения)" },
];
