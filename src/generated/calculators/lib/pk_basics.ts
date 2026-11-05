// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/pk_basics.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PKBasicsInput = {
  dose: number;        // mg
  auc: number;         // mg·h/L (area under curve)
  cmax: number;        // mg/L (peak concentration)
  cmin: number;        // mg/L (trough concentration)
  halfLife: number;    // hours
  vd: number;          // L/kg volume of distribution
  weight: number;      // kg
};

export type PKBasicsResult = {
  clearance: number;   // L/h
  vdTotal: number;     // L total
  ke: number;          // elimination rate constant h^-1
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculatePKBasics(input: PKBasicsInput): PKBasicsResult {
  const { dose, auc, halfLife, vd, weight } = input;

  const clearance = auc > 0 ? Math.round((dose / auc) * 100) / 100 : 0;
  const vdTotal = Math.round(vd * weight * 10) / 10;
  const ke = halfLife > 0 ? Math.round((0.693 / halfLife) * 1000) / 1000 : 0;

  return {
    clearance,
    vdTotal,
    ke,
    interpretation: `CL=${clearance} L/h, Vd=${vdTotal} L, ke=${ke} h⁻¹`,
    severity: "normal",
  };
}
