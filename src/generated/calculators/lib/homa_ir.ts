// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/homa_ir.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HOMAIRInput = {
  insulin: number; // μIU/mL
  glucose: number; // mmol/L
};

export type HOMAIRResult = {
  homa: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateHOMAIR(input: HOMAIRInput): HOMAIRResult {
  const { insulin, glucose } = input;
  const homa = (insulin * glucose) / 22.5;
  const rounded = Math.round(homa * 100) / 100;

  if (homa < 1) {
    return {
      homa: rounded,
      interpretation: "Высокая чувствительность к инсулину",
      severity: "normal",
      color: "success",
    };
  } else if (homa <= 2.5) {
    return {
      homa: rounded,
      interpretation: "Норма",
      severity: "normal",
      color: "success",
    };
  } else if (homa <= 5) {
    return {
      homa: rounded,
      interpretation: "Инсулинорезистентность",
      severity: "warning",
      color: "warning",
    };
  } else {
    return {
      homa: rounded,
      interpretation: "Выраженная инсулинорезистентность",
      severity: "error",
      color: "error",
    };
  }
}
