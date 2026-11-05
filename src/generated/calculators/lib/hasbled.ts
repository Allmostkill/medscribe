// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/hasbled.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HASBLEDInput = {
  hypertension: boolean; // Uncontrolled HTN (SBP>160) +1
  renalLiver: 0 | 1 | 2; // Renal/liver dysfunction: 0=none, 1=one, 2=both
  stroke: boolean; // Stroke history +1
  bleedingHistory: boolean; // Prior major bleeding +1
  labileInr: boolean; // Labile INR +1
  elderly: boolean; // Age >65 +1
  drugsAlcohol: 0 | 1 | 2; // Antiplatelet/NSAID use or alcohol: 0=none, 1=one, 2=both
};

export type HASBLEDResult = {
  score: number;
  riskLevel: string;
  annualBleedingRisk: string;
  severity: "normal" | "warning" | "error";
  color: string;
  recommendation: string;
};

export function calculateHASBLED(input: HASBLEDInput): HASBLEDResult {
  let score = 0;
  if (input.hypertension) score += 1;
  score += input.renalLiver; // 0, 1, or 2
  if (input.stroke) score += 1;
  if (input.bleedingHistory) score += 1;
  if (input.labileInr) score += 1;
  if (input.elderly) score += 1;
  score += input.drugsAlcohol; // 0, 1, or 2

  if (score <= 1) {
    return {
      score,
      riskLevel: "Низкий",
      annualBleedingRisk: "≈1%",
      severity: "normal",
      color: "success",
      recommendation: "Антикоагулянты можно назначить",
    };
  } else if (score === 2) {
    return {
      score,
      riskLevel: "Умеренный",
      annualBleedingRisk: "≈1.9%",
      severity: "warning",
      color: "warning",
      recommendation: "Требуется наблюдение после назначения антикоагулянтов",
    };
  } else {
    return {
      score,
      riskLevel: "Высокий",
      annualBleedingRisk: "≈3.7%",
      severity: "error",
      color: "error",
      recommendation:
        "Высокий риск кровотечения — устранить модифицируемые факторы; не противопоказание к антикоагулянтам само по себе",
    };
  }
}
