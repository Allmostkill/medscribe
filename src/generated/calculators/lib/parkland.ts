// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/parkland.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ParklandInput = {
  weight: number; // kg
  tbsa: number; // Total body surface area burned, %
  pediatric: boolean; // Use pediatric formula (3 mL instead of 4)
};

export type ParklandResult = {
  totalVolume: number; // mL
  first8h: number; // mL (first 8 hours from time of burn)
  next16h: number; // mL (next 16 hours)
  rateFirst8h: number; // mL/hr
  rateNext16h: number; // mL/hr
  formula: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateParkland(input: ParklandInput): ParklandResult {
  const { weight, tbsa, pediatric } = input;
  const multiplier = pediatric ? 3 : 4;

  const totalVolume = multiplier * weight * tbsa;
  const first8h = totalVolume / 2;
  const next16h = totalVolume / 2;
  const rateFirst8h = Math.round(first8h / 8);
  const rateNext16h = Math.round(next16h / 16);

  return {
    totalVolume: Math.round(totalVolume),
    first8h: Math.round(first8h),
    next16h: Math.round(next16h),
    rateFirst8h,
    rateNext16h,
    formula: `${multiplier} мл × ${weight} кг × ${tbsa}% ПООЖ`,
    severity: tbsa >= 20 ? "error" : "warning",
    color: tbsa >= 20 ? "error" : "warning",
  };
}
