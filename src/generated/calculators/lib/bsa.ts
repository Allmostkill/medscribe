// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/bsa.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type BSAInput = {
  height: number; // cm
  weight: number; // kg
  formula: "mosteller" | "dubois" | "haycock";
};

export type BSAResult = {
  bsa: number;
  formula: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateBSA(input: BSAInput): BSAResult {
  const { height, weight, formula } = input;
  let bsa: number;
  let formulaName: string;

  switch (formula) {
    case "dubois":
      bsa = 0.007184 * Math.pow(height, 0.725) * Math.pow(weight, 0.425);
      formulaName = "DuBois";
      break;
    case "haycock":
      bsa = 0.024265 * Math.pow(height, 0.3964) * Math.pow(weight, 0.5378);
      formulaName = "Haycock (педиатрическая)";
      break;
    default:
      bsa = Math.sqrt((height * weight) / 3600);
      formulaName = "Mosteller";
  }

  const rounded = Math.round(bsa * 100) / 100;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";

  if (rounded >= 1.5 && rounded <= 2.2) {
    interpretation = "Нормальный диапазон для взрослых (1.5–2.2 м²)";
    severity = "normal";
  } else if (rounded < 1.5) {
    interpretation = "Ниже нормального диапазона для взрослых";
    severity = "warning";
  } else {
    interpretation = "Выше нормального диапазона для взрослых";
    severity = "warning";
  }

  return { bsa: rounded, formula: formulaName, interpretation, severity };
}
