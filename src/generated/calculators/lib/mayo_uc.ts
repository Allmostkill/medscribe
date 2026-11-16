// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/mayo_uc.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MayoUCInput = {
  stoolFrequency: 0 | 1 | 2 | 3;
  rectalBleeding: 0 | 1 | 2 | 3;
  physicianAssessment: 0 | 1 | 2 | 3;
  endoscopy: 0 | 1 | 2 | 3;
};

export type MayoUCResult = {
  score: number;
  activity: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateMayoUC(input: MayoUCInput): MayoUCResult {
  const score = input.stoolFrequency + input.rectalBleeding + input.physicianAssessment + input.endoscopy;

  if (score <= 2) {
    return { score, activity: "Ремиссия", interpretation: "Клиническая ремиссия", severity: "normal" };
  } else if (score <= 5) {
    return { score, activity: "Лёгкая", interpretation: "Лёгкая активность", severity: "normal" };
  } else if (score <= 10) {
    return { score, activity: "Умеренная", interpretation: "Умеренная активность", severity: "warning" };
  } else {
    return { score, activity: "Тяжёлая", interpretation: "Тяжёлая активность", severity: "error" };
  }
}

export const mayoUCOptions = {
  stoolFrequency: [
    { value: 0 as const, label: "0 — Нормальная частота" },
    { value: 1 as const, label: "1 — На 1–2 раза больше нормы" },
    { value: 2 as const, label: "2 — На 3–4 раза больше нормы" },
    { value: 3 as const, label: "3 — На 5+ раз больше нормы" },
  ],
  rectalBleeding: [
    { value: 0 as const, label: "0 — Нет" },
    { value: 1 as const, label: "1 — Прожилки крови < 50% дефекаций" },
    { value: 2 as const, label: "2 — Явная кровь в большинстве дефекаций" },
    { value: 3 as const, label: "3 — Преимущественно кровь" },
  ],
  physicianAssessment: [
    { value: 0 as const, label: "0 — Норма" },
    { value: 1 as const, label: "1 — Лёгкое обострение" },
    { value: 2 as const, label: "2 — Умеренное обострение" },
    { value: 3 as const, label: "3 — Тяжёлое обострение" },
  ],
  endoscopy: [
    { value: 0 as const, label: "0 — Норма или неактивная болезнь" },
    { value: 1 as const, label: "1 — Лёгкая (эритема, сниженная васкуляризация)" },
    { value: 2 as const, label: "2 — Умеренная (выраженная эритема, эрозии)" },
    { value: 3 as const, label: "3 — Тяжёлая (язвы, спонтанное кровотечение)" },
  ],
};
