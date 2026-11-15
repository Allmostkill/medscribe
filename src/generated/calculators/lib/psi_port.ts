// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/psi_port.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PSIPortInput = {
  // Demographics
  age: number;
  female: boolean;
  nursingHome: boolean;
  // Comorbidities
  neoplasm: boolean;
  liverDisease: boolean;
  chf: boolean;
  cerebrovascular: boolean;
  renalDisease: boolean;
  // Physical exam
  alteredMentalStatus: boolean;
  rr30: boolean;
  sbpLt90: boolean;
  tempAbnormal: boolean; // <35 or >=40
  hr125: boolean;
  // Labs
  phLt735: boolean;
  bunHigh: boolean; // BUN >=30 mg/dL
  naLow: boolean;   // Na <130
  glucoseHigh: boolean; // >=250 mg/dL
  hctLow: boolean;  // <30%
  po2Low: boolean;  // PaO2 <60 mmHg
  pleuralEffusion: boolean;
};

export type PSIPortResult = {
  score: number;
  riskClass: string;
  mortality: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculatePSIPort(input: PSIPortInput): PSIPortResult {
  let score = 0;

  // Age (men = age pts, women = age - 10)
  score += input.female ? input.age - 10 : input.age;

  // Nursing home
  if (input.nursingHome) score += 10;

  // Comorbidities
  if (input.neoplasm) score += 30;
  if (input.liverDisease) score += 20;
  if (input.chf) score += 10;
  if (input.cerebrovascular) score += 10;
  if (input.renalDisease) score += 10;

  // Physical exam
  if (input.alteredMentalStatus) score += 20;
  if (input.rr30) score += 20;
  if (input.sbpLt90) score += 20;
  if (input.tempAbnormal) score += 15;
  if (input.hr125) score += 10;

  // Labs
  if (input.phLt735) score += 30;
  if (input.bunHigh) score += 20;
  if (input.naLow) score += 20;
  if (input.glucoseHigh) score += 10;
  if (input.hctLow) score += 10;
  if (input.po2Low) score += 10;
  if (input.pleuralEffusion) score += 10;

  const rounded = Math.max(0, score);

  if (rounded <= 70) {
    const riskClass = rounded <= 50 ? "I/II" : "III";
    const mortality = rounded <= 50 ? "0.1–0.6%" : "2.8%";
    return {
      score: rounded,
      riskClass,
      mortality,
      interpretation: `Класс риска ${riskClass} — низкий риск`,
      severity: "normal",
      recommendation: "Амбулаторное лечение (возможна госпитализация кратко при классе III)",
    };
  } else if (rounded <= 130) {
    const riskClass = rounded <= 90 ? "IV" : "IV";
    const mortality = rounded <= 90 ? "8.2%" : "8.2%";
    return {
      score: rounded,
      riskClass: "IV",
      mortality,
      interpretation: "Класс риска IV — умеренный риск",
      severity: "warning",
      recommendation: "Госпитализация",
    };
  } else {
    return {
      score: rounded,
      riskClass: "V",
      mortality: "29.2%",
      interpretation: "Класс риска V — высокий риск",
      severity: "error",
      recommendation: "Госпитализация, рассмотреть ОРИТ",
    };
  }
}
