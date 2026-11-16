// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/corrected_phenytoin.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CorrectedPhenytoinInput = {
  measured: number;   // Measured phenytoin level, mcg/mL
  albumin: number;    // Albumin, g/dL
  renalFailure: boolean; // GFR <20 mL/min
};

export type CorrectedPhenytoinResult = {
  corrected: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  formula: string;
};

export function calculateCorrectedPhenytoin(input: CorrectedPhenytoinInput): CorrectedPhenytoinResult {
  const { measured, albumin, renalFailure } = input;
  const divisor = renalFailure
    ? 0.1 * albumin + 0.1
    : 0.2 * albumin + 0.1;
  const corrected = measured / divisor;
  const rounded = Math.round(corrected * 10) / 10;

  const formula = renalFailure
    ? `${measured} / (0.1 × ${albumin} + 0.1) = ${rounded} мкг/мл (ХПН)`
    : `${measured} / (0.2 × ${albumin} + 0.1) = ${rounded} мкг/мл`;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";

  if (rounded < 10) {
    interpretation = "Субтерапевтический уровень (< 10 мкг/мл)";
    severity = "warning";
  } else if (rounded <= 20) {
    interpretation = "Терапевтический диапазон (10–20 мкг/мл)";
    severity = "normal";
  } else {
    interpretation = "Токсический уровень (> 20 мкг/мл)";
    severity = "error";
  }

  return { corrected: rounded, interpretation, severity, formula };
}
