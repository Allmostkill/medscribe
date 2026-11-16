// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/abcd2.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ABCD2Input = {
  age60plus: boolean;
  bpElevated: boolean;   // >=140/90
  clinicalFeature: 0 | 1 | 2; // 0=other, 1=speech without weakness, 2=unilateral weakness
  duration: 0 | 1 | 2;        // 0=<10min, 1=10-59min, 2=>=60min
  diabetes: boolean;
};

export type ABCD2Result = {
  score: number;
  risk: string;
  strokeRisk2d: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateABCD2(input: ABCD2Input): ABCD2Result {
  const score =
    (input.age60plus ? 1 : 0) +
    (input.bpElevated ? 1 : 0) +
    input.clinicalFeature +
    input.duration +
    (input.diabetes ? 1 : 0);

  if (score <= 3) {
    return {
      score,
      risk: "Низкий",
      strokeRisk2d: "~1%",
      recommendation: "Низкий риск — наблюдение, вторичная профилактика",
      severity: "normal",
    };
  } else if (score <= 5) {
    return {
      score,
      risk: "Умеренный",
      strokeRisk2d: "~4%",
      recommendation: "Умеренный риск — госпитализация или срочная амбулаторная оценка",
      severity: "warning",
    };
  } else {
    return {
      score,
      risk: "Высокий",
      strokeRisk2d: "~8%",
      recommendation: "Высокий риск инсульта — госпитализация, неотложная нейровизуализация",
      severity: "error",
    };
  }
}

export const abcd2ClinicalOptions = [
  { value: 0, label: "0 — Другие симптомы" },
  { value: 1, label: "1 — Речевые нарушения без слабости" },
  { value: 2, label: "2 — Односторонняя мышечная слабость" },
];

export const abcd2DurationOptions = [
  { value: 0, label: "0 — Менее 10 минут" },
  { value: 1, label: "1 — 10–59 минут" },
  { value: 2, label: "2 — 60 минут и более" },
];
