// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ibw.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type IBWInput = {
  height: number; // cm
  weight: number; // kg (actual body weight)
  sex: "male" | "female";
};

export type IBWResult = {
  ibw: number; // kg
  abw: number; // kg (input)
  adjBW?: number; // kg, if obese (ABW > 130% IBW)
  isObese: boolean;
  bmi: number;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateIBW(input: IBWInput): IBWResult {
  const { height, weight, sex } = input;

  // Convert cm to inches
  const heightInches = height / 2.54;
  const inchesOver5ft = heightInches - 60;

  let ibw: number;
  if (sex === "male") {
    ibw = 50 + 2.3 * inchesOver5ft;
  } else {
    ibw = 45.5 + 2.3 * inchesOver5ft;
  }

  ibw = Math.round(ibw * 10) / 10;
  const bmi = Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10;
  const isObese = weight > ibw * 1.3;

  let adjBW: number | undefined;
  if (isObese) {
    adjBW = Math.round((ibw + 0.4 * (weight - ibw)) * 10) / 10;
  }

  return {
    ibw,
    abw: weight,
    adjBW,
    isObese,
    bmi,
    severity: isObese ? "warning" : "normal",
    color: isObese ? "warning" : "success",
  };
}
