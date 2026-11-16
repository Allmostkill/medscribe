// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/bode.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type BODEInput = {
  bmi: number;            // kg/m2
  fev1Percent: number;   // % predicted
  mmrc: 0 | 1 | 2 | 3 | 4; // mMRC dyspnea scale
  walk6min: number;       // meters
};

export type BODEResult = {
  score: number;
  bmiPoints: number;
  fev1Points: number;
  mmrcPoints: number;
  walkPoints: number;
  mortality4yr: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateBODE(input: BODEInput): BODEResult {
  const bmiPoints = input.bmi <= 21 ? 1 : 0;

  let fev1Points: number;
  if (input.fev1Percent >= 65) fev1Points = 0;
  else if (input.fev1Percent >= 50) fev1Points = 1;
  else if (input.fev1Percent >= 36) fev1Points = 2;
  else fev1Points = 3;

  let mmrcPoints: number;
  if (input.mmrc <= 1) mmrcPoints = 0;
  else if (input.mmrc === 2) mmrcPoints = 1;
  else if (input.mmrc === 3) mmrcPoints = 2;
  else mmrcPoints = 3;

  let walkPoints: number;
  if (input.walk6min >= 350) walkPoints = 0;
  else if (input.walk6min >= 250) walkPoints = 1;
  else if (input.walk6min >= 150) walkPoints = 2;
  else walkPoints = 3;

  const score = bmiPoints + fev1Points + mmrcPoints + walkPoints;

  let mortality4yr: string;
  let interpretation: string;
  let severity: "normal" | "warning" | "error";

  if (score <= 2) {
    mortality4yr = "~15%";
    interpretation = "Лёгкая степень";
    severity = "normal";
  } else if (score <= 4) {
    mortality4yr = "~30%";
    interpretation = "Умеренная степень";
    severity = "warning";
  } else if (score <= 6) {
    mortality4yr = "~40%";
    interpretation = "Тяжёлая степень";
    severity = "warning";
  } else {
    mortality4yr = "~80%";
    interpretation = "Крайне тяжёлая";
    severity = "error";
  }

  return { score, bmiPoints, fev1Points, mmrcPoints, walkPoints, mortality4yr, interpretation, severity };
}

export const mmrcOptions = [
  { value: 0, label: "0 — Одышка только при тяжёлой нагрузке" },
  { value: 1, label: "1 — Одышка при быстрой ходьбе или подъёме на холм" },
  { value: 2, label: "2 — Идёт медленнее сверстников, останавливается" },
  { value: 3, label: "3 — Останавливается после 100 м на ровном месте" },
  { value: 4, label: "4 — Одышка при одевании, не выходит из дома" },
];
