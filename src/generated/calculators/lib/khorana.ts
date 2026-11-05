// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/khorana.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type KhoranaInput = {
  cancerType: "very_high" | "high" | "other"; // Very high = stomach/pancreas, High = lung/lymphoma/gyn/bladder/testicular
  plateletsHigh: boolean;   // Platelets >=350 x10^9/L: +1
  hgbLow: boolean;          // Hgb <100 g/L or ESA use: +1
  wbcHigh: boolean;         // WBC >11 x10^9/L: +1
  bmiHigh: boolean;         // BMI >=35: +1
};

export type KhoranaResult = {
  score: number;
  risk: string;
  vteRate: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateKhorana(input: KhoranaInput): KhoranaResult {
  let score = 0;
  if (input.cancerType === "very_high") score += 2;
  else if (input.cancerType === "high") score += 1;
  if (input.plateletsHigh) score += 1;
  if (input.hgbLow) score += 1;
  if (input.wbcHigh) score += 1;
  if (input.bmiHigh) score += 1;

  if (score === 0) {
    return {
      score, risk: "Низкий", vteRate: "5%",
      interpretation: "Низкий риск ВТЭ",
      severity: "normal",
      recommendation: "Рутинная профилактика не рекомендована",
    };
  } else if (score <= 2) {
    return {
      score, risk: "Умеренный", vteRate: "6.6%",
      interpretation: "Умеренный риск ВТЭ",
      severity: "warning",
      recommendation: "Рассмотреть первичную тромбопрофилактику",
    };
  } else {
    return {
      score, risk: "Высокий", vteRate: "11–13%",
      interpretation: "Высокий риск ВТЭ",
      severity: "error",
      recommendation: "Первичная тромбопрофилактика (ПОАК или НМГ) рекомендована",
    };
  }
}
