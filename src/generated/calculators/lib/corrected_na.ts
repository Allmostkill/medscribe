// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/corrected_na.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CorrectedNaInput = {
  measuredNa: number;  // mEq/L
  glucose: number;     // mg/dL
};

export type CorrectedNaResult = {
  correctedNa: number;
  correction: number;
  glucoseMMOL: number;
  coefficient: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateCorrectedNa(input: CorrectedNaInput): CorrectedNaResult {
  const { measuredNa, glucose } = input;

  // Use 2.4 coefficient if glucose > 400 mg/dL
  const coefficient = glucose > 400 ? 2.4 : 1.6;
  const glucoseMMOL = Math.round(glucose / 18 * 10) / 10;

  const correction = coefficient * ((glucose - 100) / 100);
  const correctedNa = Math.round((measuredNa + correction) * 10) / 10;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";

  if (correctedNa < 135) {
    interpretation = "Гипонатриемия (после коррекции)";
    severity = "warning";
  } else if (correctedNa <= 145) {
    interpretation = "Норма (после коррекции)";
    severity = "normal";
  } else if (correctedNa <= 155) {
    interpretation = "Лёгкая гипернатриемия";
    severity = "warning";
  } else {
    interpretation = "Тяжёлая гипернатриемия";
    severity = "error";
  }

  return { correctedNa, correction: Math.round(correction * 10) / 10, glucoseMMOL, coefficient, interpretation, severity };
}
