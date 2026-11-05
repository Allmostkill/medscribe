// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/heart_score.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HEARTScoreInput = {
  history: 0 | 1 | 2;      // 0=slightly suspicious, 1=moderately, 2=highly suspicious
  ecg: 0 | 1 | 2;          // 0=normal, 1=non-specific, 2=significant ST deviation
  age: 0 | 1 | 2;          // 0=<45, 1=45-64, 2=>=65
  riskFactors: 0 | 1 | 2;  // 0=none, 1=1-2 or DM/HTN, 2=>=3 or atherosclerotic disease
  troponin: 0 | 1 | 2;     // 0=<=normal, 1=1-3x normal, 2=>3x normal
};

export type HEARTScoreResult = {
  score: number;
  risk: string;
  maceRate: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateHEARTScore(input: HEARTScoreInput): HEARTScoreResult {
  const score = input.history + input.ecg + input.age + input.riskFactors + input.troponin;

  if (score <= 3) {
    return {
      score,
      risk: "Низкий",
      maceRate: "1.7%",
      recommendation: "Низкий риск MACE — возможна выписка без нагрузочного теста",
      severity: "normal",
    };
  } else if (score <= 6) {
    return {
      score,
      risk: "Умеренный",
      maceRate: "12%",
      recommendation: "Умеренный риск — госпитализация, наблюдение, нагрузочный тест",
      severity: "warning",
    };
  } else {
    return {
      score,
      risk: "Высокий",
      maceRate: "65%",
      recommendation: "Высокий риск MACE — ранняя инвазивная стратегия",
      severity: "error",
    };
  }
}

export const heartScoreOptions = {
  history: [
    { value: 0, label: "0 — Слабо подозрительный (нетипичный)" },
    { value: 1, label: "1 — Умеренно подозрительный" },
    { value: 2, label: "2 — Высоко подозрительный (типичный)" },
  ],
  ecg: [
    { value: 0, label: "0 — Норма" },
    { value: 1, label: "1 — Неспецифические изменения реполяризации" },
    { value: 2, label: "2 — Значимая девиация ST" },
  ],
  age: [
    { value: 0, label: "0 — Младше 45 лет" },
    { value: 1, label: "1 — 45–64 года" },
    { value: 2, label: "2 — 65 лет и старше" },
  ],
  riskFactors: [
    { value: 0, label: "0 — Нет известных факторов риска" },
    { value: 1, label: "1 — 1–2 ФР или СД/АГ/дислипидемия" },
    { value: 2, label: "2 — ≥3 ФР или атеросклеротическое заболевание" },
  ],
  troponin: [
    { value: 0, label: "0 — ≤ верхней границы нормы" },
    { value: 1, label: "1 — 1–3× верхней границы нормы" },
    { value: 2, label: "2 — >3× верхней границы нормы" },
  ],
};
