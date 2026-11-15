// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/wells_dvt.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type WellsDVTInput = {
  activeCancer: boolean;
  paralysisParesis: boolean;
  bedridden: boolean;
  deepVeinTenderness: boolean;
  entireLegSwollen: boolean;
  calfSwelling: boolean;
  pittingEdema: boolean;
  collateralVeins: boolean;
  previousDVT: boolean;
  alternativeDiagnosis: boolean; // -2 points
};

export type WellsDVTResult = {
  score: number;
  probability: string;
  dvtRate: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateWellsDVT(input: WellsDVTInput): WellsDVTResult {
  let score = 0;
  if (input.activeCancer) score += 1;
  if (input.paralysisParesis) score += 1;
  if (input.bedridden) score += 1;
  if (input.deepVeinTenderness) score += 1;
  if (input.entireLegSwollen) score += 1;
  if (input.calfSwelling) score += 1;
  if (input.pittingEdema) score += 1;
  if (input.collateralVeins) score += 1;
  if (input.previousDVT) score += 1;
  if (input.alternativeDiagnosis) score -= 2;

  if (score <= 0) {
    return {
      score,
      probability: "Низкая вероятность",
      dvtRate: "~5%",
      recommendation: "Низкая вероятность ТГВ — D-димер для исключения диагноза",
      severity: "normal",
    };
  } else if (score <= 2) {
    return {
      score,
      probability: "Умеренная вероятность",
      dvtRate: "~17%",
      recommendation: "Умеренная вероятность — D-димер или УЗАС вен",
      severity: "warning",
    };
  } else {
    return {
      score,
      probability: "Высокая вероятность",
      dvtRate: "~53%",
      recommendation: "Высокая вероятность ТГВ — УЗАС вен, рассмотреть антикоагуляцию",
      severity: "error",
    };
  }
}
