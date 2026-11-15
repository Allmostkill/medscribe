// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/corrected_ca.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CorrectedCaInput = {
  ca: number; // measured calcium
  albumin: number; // albumin
  unit: "mg_dl" | "mmol_l"; // Ca unit; albumin in g/dL or g/L accordingly
};

export type CorrectedCaResult = {
  correctedCa: number;
  unit: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateCorrectedCa(input: CorrectedCaInput): CorrectedCaResult {
  const { ca, albumin, unit } = input;

  let correctedCa: number;
  let normalRange: { low: number; high: number };
  let displayUnit: string;

  if (unit === "mg_dl") {
    // Ca in mg/dL, albumin in g/dL
    correctedCa = ca + 0.8 * (4.0 - albumin);
    normalRange = { low: 8.5, high: 10.5 };
    displayUnit = "мг/дл";
  } else {
    // Ca in mmol/L, albumin in g/L
    correctedCa = ca + 0.02 * (40 - albumin);
    normalRange = { low: 2.12, high: 2.62 };
    displayUnit = "ммоль/л";
  }

  correctedCa = Math.round(correctedCa * 100) / 100;

  if (correctedCa < normalRange.low) {
    return {
      correctedCa,
      unit: displayUnit,
      interpretation: `Гипокальциемия (норма ${normalRange.low}–${normalRange.high} ${displayUnit})`,
      severity: "warning",
      color: "warning",
    };
  } else if (correctedCa > normalRange.high) {
    return {
      correctedCa,
      unit: displayUnit,
      interpretation: `Гиперкальциемия (норма ${normalRange.low}–${normalRange.high} ${displayUnit})`,
      severity: "error",
      color: "error",
    };
  } else {
    return {
      correctedCa,
      unit: displayUnit,
      interpretation: `Норма (${normalRange.low}–${normalRange.high} ${displayUnit})`,
      severity: "normal",
      color: "success",
    };
  }
}
