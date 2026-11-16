// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/delta_delta.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type DeltaDeltaInput = {
  ag: number;   // Measured anion gap, mEq/L
  hco3: number; // Measured HCO3, mEq/L
};

export type DeltaDeltaResult = {
  ratio: number;
  interpretation: string;
  diagnosis: string;
  severity: "normal" | "warning" | "error";
};

export function calculateDeltaDelta(input: DeltaDeltaInput): DeltaDeltaResult {
  const { ag, hco3 } = input;
  const deltaAG = ag - 12;
  const deltaBicarb = 24 - hco3;
  const ratio = deltaAG / deltaBicarb;
  const rounded = Math.round(ratio * 100) / 100;

  let interpretation: string;
  let diagnosis: string;
  let severity: "normal" | "warning" | "error";

  if (ratio < 0.4) {
    interpretation = "δ/δ < 0.4";
    diagnosis = "Чистый нормальный АП МА (без высокоанионного компонента)";
    severity = "warning";
  } else if (ratio <= 1.0) {
    interpretation = "δ/δ 0.4–1.0";
    diagnosis = "Высокоанионный МА + нормальноанионный МА (смешанный)";
    severity = "warning";
  } else if (ratio <= 2.0) {
    interpretation = "δ/δ 1.0–2.0";
    diagnosis = "Чистый высокоанионный метаболический ацидоз";
    severity = "normal";
  } else {
    interpretation = "δ/δ > 2.0";
    diagnosis = "Высокоанионный МА + метаболический алкалоз";
    severity = "error";
  }

  return { ratio: rounded, interpretation, diagnosis, severity };
}
