// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/wells_pe.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type WellsPEInput = {
  dvtSigns: boolean; // Clinical signs of DVT (+3)
  altDxLikely: boolean; // Alternative Dx less likely than PE (+3)
  hr100plus: boolean; // HR > 100 (+1.5)
  immobilization: boolean; // Immobilization ≥3d or surgery in last 4w (+1.5)
  priorDvtPe: boolean; // Prior DVT/PE (+1.5)
  hemoptysis: boolean; // Hemoptysis (+1)
  malignancy: boolean; // Malignancy (+1)
};

export type WellsPEResult = {
  score: number;
  probabilityClassic: string;
  probabilityBinary: string;
  percentRiskClassic: string;
  percentRiskBinary: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateWellsPE(input: WellsPEInput): WellsPEResult {
  let score = 0;
  if (input.dvtSigns) score += 3;
  if (input.altDxLikely) score += 3;
  if (input.hr100plus) score += 1.5;
  if (input.immobilization) score += 1.5;
  if (input.priorDvtPe) score += 1.5;
  if (input.hemoptysis) score += 1;
  if (input.malignancy) score += 1;

  let probabilityClassic: string;
  let percentRiskClassic: string;
  let severity: "normal" | "warning" | "error";
  let color: string;

  if (score <= 1) {
    probabilityClassic = "Низкая";
    percentRiskClassic = "≈3.6%";
    severity = "normal";
    color = "success";
  } else if (score <= 6) {
    probabilityClassic = "Умеренная";
    percentRiskClassic = "≈20.5%";
    severity = "warning";
    color = "warning";
  } else {
    probabilityClassic = "Высокая";
    percentRiskClassic = "≈66.7%";
    severity = "error";
    color = "error";
  }

  const probabilityBinary = score <= 4 ? "ТЭЛА маловероятна" : "ТЭЛА вероятна";
  const percentRiskBinary = score <= 4 ? "≈12%" : "≈37%";
  const recommendation =
    score <= 4
      ? "D-димер; при позитивном — КТ-ангиография"
      : "КТ-ангиография лёгочных артерий";

  return {
    score,
    probabilityClassic,
    probabilityBinary,
    percentRiskClassic,
    percentRiskBinary,
    recommendation,
    severity,
    color,
  };
}
