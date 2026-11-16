// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/uag.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type UAGInput = {
  uNa: number; // Urine sodium, mEq/L
  uK: number;  // Urine potassium, mEq/L
  uCl: number; // Urine chloride, mEq/L
};

export type UAGResult = {
  uag: number;
  interpretation: string;
  diagnosis: string;
  severity: "normal" | "warning" | "error";
};

export function calculateUAG(input: UAGInput): UAGResult {
  const uag = input.uNa + input.uK - input.uCl;
  const rounded = Math.round(uag * 10) / 10;

  if (uag < 0) {
    return {
      uag: rounded,
      interpretation: "Отрицательный (< 0) — адекватный почечный ответ",
      diagnosis: "Внепочечная потеря HCO₃⁻ (диарея)",
      severity: "normal",
    };
  } else {
    return {
      uag: rounded,
      interpretation: "Положительный (> 0) — нарушена секреция NH₄⁺",
      diagnosis: "Почечный канальцевый ацидоз (РКА)",
      severity: "error",
    };
  }
}
