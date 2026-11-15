// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/cha2ds2vasc.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CHA2DS2VASCInput = {
  chf: boolean; // Congestive heart failure
  hypertension: boolean; // Hypertension
  age75plus: boolean; // Age ≥ 75 (+2)
  diabetes: boolean; // Diabetes mellitus
  strokeTia: boolean; // Stroke/TIA history (+2)
  vascular: boolean; // Vascular disease
  age65to74: boolean; // Age 65-74
  female: boolean; // Female sex category
};

export type CHA2DS2VASCResult = {
  score: number;
  riskLevel: string;
  annualRisk: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateCHA2DS2VASC(input: CHA2DS2VASCInput): CHA2DS2VASCResult {
  let score = 0;
  if (input.chf) score += 1;
  if (input.hypertension) score += 1;
  if (input.age75plus) score += 2;
  if (input.diabetes) score += 1;
  if (input.strokeTia) score += 2;
  if (input.vascular) score += 1;
  if (input.age65to74) score += 1;
  if (input.female) score += 1;

  // Male-based interpretation (subtract 1 for female sex category)
  const clinicalScore = input.female ? score - 1 : score;

  if (clinicalScore === 0) {
    return {
      score,
      riskLevel: "Низкий",
      annualRisk: "≈0%",
      recommendation: "Антикоагулянты не показаны",
      severity: "normal",
      color: "success",
    };
  } else if (clinicalScore === 1 && !input.female) {
    return {
      score,
      riskLevel: "Умеренный",
      annualRisk: "≈1.3%",
      recommendation: "Рассмотреть антикоагулянты",
      severity: "warning",
      color: "warning",
    };
  } else if (score >= 2) {
    const risks: Record<number, string> = {
      2: "≈2.2%",
      3: "≈3.2%",
      4: "≈4.0%",
      5: "≈6.7%",
      6: "≈9.8%",
      7: "≈9.6%",
      8: "≈12.5%",
      9: "≈15.2%",
    };
    return {
      score,
      riskLevel: "Высокий",
      annualRisk: risks[score] ?? ">15%",
      recommendation: "Антикоагулянты показаны (ПОАК предпочтительны)",
      severity: "error",
      color: "error",
    };
  } else {
    return {
      score,
      riskLevel: "Низкий",
      annualRisk: "≈0%",
      recommendation: "Антикоагулянты не показаны",
      severity: "normal",
      color: "success",
    };
  }
}
