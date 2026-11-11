// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/das28.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type DAS28Input = {
  tjc28: number;   // Tender joint count 0-28
  sjc28: number;   // Swollen joint count 0-28
  crp: number;     // CRP mg/L (for DAS28-CRP)
  esr: number;     // ESR mm/h (for DAS28-ESR)
  vas: number;     // Patient VAS 0-100
  useESR: boolean; // Use ESR instead of CRP
};

export type DAS28Result = {
  score: number;
  activity: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  formula: string;
};

export function calculateDAS28(input: DAS28Input): DAS28Result {
  const { tjc28, sjc28, crp, esr, vas, useESR } = input;
  let score: number;
  let formula: string;

  if (useESR) {
    score = 0.56 * Math.sqrt(tjc28) + 0.28 * Math.sqrt(sjc28) + 0.70 * Math.log(esr) + 0.014 * vas;
    formula = `0.56×√${tjc28} + 0.28×√${sjc28} + 0.70×ln(${esr}) + 0.014×${vas}`;
  } else {
    score = 0.56 * Math.sqrt(tjc28) + 0.28 * Math.sqrt(sjc28) + 0.36 * Math.log(crp + 1) + 0.014 * vas + 0.96;
    formula = `0.56×√${tjc28} + 0.28×√${sjc28} + 0.36×ln(${crp}+1) + 0.014×${vas} + 0.96`;
  }

  const rounded = Math.round(score * 100) / 100;

  let activity: string;
  let severity: "normal" | "warning" | "error";
  let interpretation: string;

  if (rounded < 2.6) {
    activity = "Ремиссия"; severity = "normal"; interpretation = "Ремиссия (DAS28 < 2.6)";
  } else if (rounded < 3.2) {
    activity = "Низкая"; severity = "normal"; interpretation = "Низкая активность (2.6–3.2)";
  } else if (rounded <= 5.1) {
    activity = "Умеренная"; severity = "warning"; interpretation = "Умеренная активность (3.2–5.1)";
  } else {
    activity = "Высокая"; severity = "error"; interpretation = "Высокая активность (> 5.1)";
  }

  return { score: rounded, activity, interpretation, severity, formula };
}
