// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/pcr_urine.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PCRUrineInput = {
  protein: number;    // mg/dL
  creatinine: number; // mg/dL
};

export type PCRUrineResult = {
  ratio: number;
  dailyEstimate: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  category: string;
};

export function calculatePCRUrine(input: PCRUrineInput): PCRUrineResult {
  const ratio = input.protein / input.creatinine;
  const rounded = Math.round(ratio * 100) / 100;

  // PCR approximates g/g which correlates to g/day
  const dailyMg = rounded * 1000;
  const dailyEstimate = dailyMg < 300
    ? `~${Math.round(dailyMg)} мг/сут`
    : `~${(dailyMg / 1000).toFixed(1)} г/сут`;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let category: string;

  if (rounded < 0.3) {
    interpretation = "Норма (< 0.3)";
    severity = "normal";
    category = "Нормальная экскреция белка";
  } else if (rounded < 3.5) {
    interpretation = "Значимая протеинурия (0.3–3.5)";
    severity = rounded >= 0.3 && rounded < 0.5 ? "warning" : "error";
    category = rounded < 0.5 ? "Умеренная протеинурия" : "Значимая протеинурия (критерий преэклампсии ≥ 0.3)";
  } else {
    interpretation = "Нефротическая протеинурия (> 3.5)";
    severity = "error";
    category = "Нефротический диапазон";
  }

  return { ratio: rounded, dailyEstimate, interpretation, severity, category };
}
