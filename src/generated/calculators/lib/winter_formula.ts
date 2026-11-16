// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/winter_formula.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type WinterFormulaInput = {
  hco3: number;       // Measured HCO3, mEq/L
  measuredPaCO2: number; // Measured PaCO2, mmHg
};

export type WinterFormulaResult = {
  expectedPaCO2Low: number;
  expectedPaCO2High: number;
  measuredPaCO2: number;
  interpretation: string;
  diagnosis: string;
  severity: "normal" | "warning" | "error";
};

export function calculateWinterFormula(input: WinterFormulaInput): WinterFormulaResult {
  const { hco3, measuredPaCO2 } = input;
  const expected = 1.5 * hco3 + 8;
  const low = Math.round((expected - 2) * 10) / 10;
  const high = Math.round((expected + 2) * 10) / 10;

  let interpretation: string;
  let diagnosis: string;
  let severity: "normal" | "warning" | "error";

  if (measuredPaCO2 >= low && measuredPaCO2 <= high) {
    interpretation = "PaCO₂ в пределах ожидаемого";
    diagnosis = "Чистый метаболический ацидоз с адекватной компенсацией";
    severity = "normal";
  } else if (measuredPaCO2 > high) {
    interpretation = "PaCO₂ выше ожидаемого";
    diagnosis = "Сопутствующий респираторный ацидоз";
    severity = "error";
  } else {
    interpretation = "PaCO₂ ниже ожидаемого";
    diagnosis = "Сопутствующий респираторный алкалоз";
    severity = "warning";
  }

  return {
    expectedPaCO2Low: low,
    expectedPaCO2High: high,
    measuredPaCO2,
    interpretation,
    diagnosis,
    severity,
  };
}
