// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/pediatric_bsa.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PediatricBSAInput = {
  height: number; // cm
  weight: number; // kg
};

export type PediatricBSAResult = {
  bsa: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculatePediatricBSA(input: PediatricBSAInput): PediatricBSAResult {
  // Haycock formula: BSA = 0.024265 × height^0.3964 × weight^0.5378
  const bsa = 0.024265 * Math.pow(input.height, 0.3964) * Math.pow(input.weight, 0.5378);
  const rounded = Math.round(bsa * 100) / 100;

  return {
    bsa: rounded,
    interpretation: `ППТ по формуле Хейкока: ${rounded} м²`,
    severity: "normal",
  };
}
