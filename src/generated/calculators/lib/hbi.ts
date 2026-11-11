// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/hbi.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HBIInput = {
  generalWellbeing: 0 | 1 | 2 | 3 | 4;
  abdominalPain: 0 | 1 | 2 | 3;
  liquidStools: number; // count per day
  abdominalMass: 0 | 1 | 2 | 3;
  // Complications (each 1 point)
  arthritis: boolean;
  uveitis: boolean;
  erythemaNodosum: boolean;
  pyodermaGangrenosum: boolean;
  aphthousUlcers: boolean;
  analFissure: boolean;
  fistula: boolean;
  abscess: boolean;
};

export type HBIResult = {
  score: number;
  activity: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateHBI(input: HBIInput): HBIResult {
  const complications = [
    input.arthritis, input.uveitis, input.erythemaNodosum, input.pyodermaGangrenosum,
    input.aphthousUlcers, input.analFissure, input.fistula, input.abscess,
  ].filter(Boolean).length;

  const score = input.generalWellbeing + input.abdominalPain + input.liquidStools + input.abdominalMass + complications;

  let activity: string;
  let severity: "normal" | "warning" | "error";
  let interpretation: string;

  if (score <= 4) {
    activity = "Ремиссия"; severity = "normal"; interpretation = "Клиническая ремиссия (≤ 4)";
  } else if (score <= 7) {
    activity = "Лёгкая"; severity = "normal"; interpretation = "Лёгкая активность (5–7)";
  } else if (score <= 16) {
    activity = "Умеренная"; severity = "warning"; interpretation = "Умеренная активность (8–16)";
  } else {
    activity = "Тяжёлая"; severity = "error"; interpretation = "Тяжёлая активность (> 16)";
  }

  return { score, activity, interpretation, severity };
}
