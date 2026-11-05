// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/pf_ratio.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PFRatioInput = {
  pao2: number; // mmHg
  fio2: number; // fraction 0.21-1.0
};

export type PFRatioResult = {
  ratio: number;
  category: string;
  severity: "normal" | "warning" | "error";
  color: string;
  interpretation: string;
};

export function calculatePFRatio(input: PFRatioInput): PFRatioResult {
  const ratio = Math.round((input.pao2 / input.fio2) * 10) / 10;

  if (ratio > 300) {
    return {
      ratio,
      category: "Норма",
      severity: "normal",
      color: "success",
      interpretation: "Нет ОРДС",
    };
  } else if (ratio > 200) {
    return {
      ratio,
      category: "Лёгкий ОРДС",
      severity: "warning",
      color: "warning",
      interpretation: "P/F 201–300 — лёгкая степень ОРДС (Berlin)",
    };
  } else if (ratio > 100) {
    return {
      ratio,
      category: "Умеренный ОРДС",
      severity: "error",
      color: "error",
      interpretation: "P/F 101–200 — умеренная степень ОРДС",
    };
  } else {
    return {
      ratio,
      category: "Тяжёлый ОРДС",
      severity: "error",
      color: "error",
      interpretation: "P/F ≤ 100 — тяжёлый ОРДС",
    };
  }
}
