// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/curb65.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CURB65Input = {
  confusion: boolean; // New confusion
  urea: boolean; // BUN > 19 mg/dL (urea > 7 mmol/L)
  rr: boolean; // RR ≥ 30/min
  bp: boolean; // SBP < 90 or DBP ≤ 60 mmHg
  age65: boolean; // Age ≥ 65
};

export type CURB65Result = {
  score: number;
  severity: "normal" | "warning" | "error";
  color: string;
  riskLevel: string;
  mortality: string;
  recommendation: string;
};

export function calculateCURB65(input: CURB65Input): CURB65Result {
  let score = 0;
  if (input.confusion) score++;
  if (input.urea) score++;
  if (input.rr) score++;
  if (input.bp) score++;
  if (input.age65) score++;

  if (score <= 1) {
    return {
      score,
      severity: "normal",
      color: "success",
      riskLevel: "Низкий",
      mortality: "≈1.5%",
      recommendation: "Амбулаторное лечение возможно",
    };
  } else if (score === 2) {
    return {
      score,
      severity: "warning",
      color: "warning",
      riskLevel: "Умеренный",
      mortality: "≈9.2%",
      recommendation: "Госпитализация рекомендована",
    };
  } else {
    return {
      score,
      severity: "error",
      color: "error",
      riskLevel: "Высокий",
      mortality: "≈22%",
      recommendation: "Госпитализация в ОРИТ при счёте ≥ 4–5",
    };
  }
}
