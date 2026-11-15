// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/child_pugh.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ChildPughInput = {
  bilirubin: 1 | 2 | 3; // <2 / 2-3 / >3 mg/dL
  albumin: 1 | 2 | 3; // >3.5 / 2.8-3.5 / <2.8 g/dL
  inr: 1 | 2 | 3; // <1.7 / 1.7-2.3 / >2.3
  ascites: 1 | 2 | 3; // None / Mild-Moderate / Severe
  encephalopathy: 1 | 2 | 3; // None / Grade 1-2 / Grade 3-4
};

export type ChildPughResult = {
  score: number;
  grade: "A" | "B" | "C";
  oneYearSurvival: string;
  twoYearSurvival: string;
  severity: "normal" | "warning" | "error";
  color: string;
  interpretation: string;
};

export function calculateChildPugh(input: ChildPughInput): ChildPughResult {
  const score =
    input.bilirubin +
    input.albumin +
    input.inr +
    input.ascites +
    input.encephalopathy;

  if (score <= 6) {
    return {
      score,
      grade: "A",
      oneYearSurvival: "100%",
      twoYearSurvival: "85%",
      severity: "normal",
      color: "success",
      interpretation: "Компенсированный цирроз",
    };
  } else if (score <= 9) {
    return {
      score,
      grade: "B",
      oneYearSurvival: "80%",
      twoYearSurvival: "60%",
      severity: "warning",
      color: "warning",
      interpretation: "Значительная функциональная недостаточность",
    };
  } else {
    return {
      score,
      grade: "C",
      oneYearSurvival: "45%",
      twoYearSurvival: "35%",
      severity: "error",
      color: "error",
      interpretation: "Декомпенсированный цирроз",
    };
  }
}

export const childPughOptions = {
  bilirubin: [
    { value: 1, label: "< 2 мг/дл" },
    { value: 2, label: "2–3 мг/дл" },
    { value: 3, label: "> 3 мг/дл" },
  ],
  albumin: [
    { value: 1, label: "> 3.5 г/дл" },
    { value: 2, label: "2.8–3.5 г/дл" },
    { value: 3, label: "< 2.8 г/дл" },
  ],
  inr: [
    { value: 1, label: "< 1.7" },
    { value: 2, label: "1.7–2.3" },
    { value: 3, label: "> 2.3" },
  ],
  ascites: [
    { value: 1, label: "Нет" },
    { value: 2, label: "Умеренный (контролируемый)" },
    { value: 3, label: "Напряжённый (рефрактерный)" },
  ],
  encephalopathy: [
    { value: 1, label: "Нет" },
    { value: 2, label: "1–2 степень" },
    { value: 3, label: "3–4 степень" },
  ],
};
