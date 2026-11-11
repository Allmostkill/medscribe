// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ascvd_pce.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ASCVDInput = {
  age: number;
  female: boolean;
  africanAmerican: boolean;
  totalCholesterol: number; // mg/dL
  hdl: number;              // mg/dL
  sbp: number;              // mmHg
  treatedHypertension: boolean;
  diabetic: boolean;
  smoker: boolean;
};

export type ASCVDResult = {
  risk10Year: number; // percent
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

// Pooled Cohort Equations (simplified coefficients)
// Reference: Goff DC Jr et al. Circulation. 2014;129(25 Suppl 2):S49-73.
export function calculateASCVD(input: ASCVDInput): ASCVDResult {
  const { age, female, africanAmerican, totalCholesterol, hdl, sbp, treatedHypertension, diabetic, smoker } = input;

  const lnAge = Math.log(age);
  const lnTC = Math.log(totalCholesterol);
  const lnHDL = Math.log(hdl);
  const lnSBP = Math.log(sbp);
  const smokingVal = smoker ? 1 : 0;
  const dmVal = diabetic ? 1 : 0;
  const treatedSBP = treatedHypertension ? lnSBP : 0;
  const untreatedSBP = treatedHypertension ? 0 : lnSBP;

  let lSum: number;
  let meanCoef: number;
  let baselineSurv: number;

  if (!female && !africanAmerican) {
    // White male
    lSum = 12.344 * lnAge + 11.853 * lnTC - 2.664 * lnAge * lnTC - 7.990 * lnHDL + 1.769 * lnAge * lnHDL + 1.764 * treatedSBP + 1.797 * untreatedSBP + 7.837 * smokingVal - 1.795 * lnAge * smokingVal + 0.661 * dmVal;
    meanCoef = 61.18;
    baselineSurv = 0.9144;
  } else if (!female && africanAmerican) {
    // African American male
    lSum = 2.469 * lnAge + 0.302 * lnTC + (-0.307) * lnHDL + 1.916 * treatedSBP + 1.809 * untreatedSBP + 0.549 * smokingVal + 0.645 * dmVal;
    meanCoef = 19.54;
    baselineSurv = 0.8954;
  } else if (female && !africanAmerican) {
    // White female
    lSum = -29.799 * lnAge + 4.884 * lnAge * lnAge + 13.540 * lnTC - 3.114 * lnAge * lnTC - 13.578 * lnHDL + 3.149 * lnAge * lnHDL + 2.019 * treatedSBP + 1.957 * untreatedSBP + 7.574 * smokingVal - 1.665 * lnAge * smokingVal + 0.661 * dmVal;
    meanCoef = -29.799;
    baselineSurv = 0.9665;
  } else {
    // African American female
    lSum = 17.1141 * lnAge + 0.9396 * lnTC + (-18.9196) * lnHDL + 4.4748 * lnAge * lnHDL + 29.2907 * treatedSBP - 6.4321 * lnAge * treatedSBP + 27.8197 * untreatedSBP - 6.0873 * lnAge * untreatedSBP + 0.8738 * smokingVal + 0.8738 * dmVal;
    meanCoef = 86.61;
    baselineSurv = 0.9533;
  }

  // Simplified final calculation
  const riskFrac = 1 - Math.pow(baselineSurv, Math.exp(lSum - meanCoef));
  const risk10Year = Math.max(0, Math.min(100, Math.round(riskFrac * 1000) / 10));

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let recommendation: string;

  if (risk10Year < 5) {
    interpretation = `10-летний риск АССЗ: ${risk10Year}% — Низкий`;
    severity = "normal";
    recommendation = "Изменение образа жизни. Статины не показаны рутинно.";
  } else if (risk10Year < 7.5) {
    interpretation = `10-летний риск АССЗ: ${risk10Year}% — Пограничный`;
    severity = "normal";
    recommendation = "Обсудить терапию статинами, учитывая факторы-усилители риска.";
  } else if (risk10Year < 20) {
    interpretation = `10-летний риск АССЗ: ${risk10Year}% — Умеренно высокий`;
    severity = "warning";
    recommendation = "Терапия статинами умеренной интенсивности рекомендована.";
  } else {
    interpretation = `10-летний риск АССЗ: ${risk10Year}% — Высокий`;
    severity = "error";
    recommendation = "Терапия статинами высокой интенсивности рекомендована.";
  }

  return { risk10Year, interpretation, severity, recommendation };
}
