// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/mdrd.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MDRDInput = {
  creatinine: number;  // mg/dL
  age: number;         // years
  female: boolean;
  black: boolean;
};

export type MDRDResult = {
  egfr: number;
  stage: string;
  stageDescription: string;
  severity: "normal" | "warning" | "error";
};

export function calculateMDRD(input: MDRDInput): MDRDResult {
  const { creatinine, age, female, black } = input;

  let egfr = 175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203);
  if (female) egfr *= 0.742;
  if (black) egfr *= 1.212;

  const egfrRounded = Math.round(egfr * 10) / 10;

  let stage: string;
  let stageDescription: string;
  let severity: "normal" | "warning" | "error";

  if (egfr >= 90) {
    stage = "G1";
    stageDescription = "Норма или высокая СКФ";
    severity = "normal";
  } else if (egfr >= 60) {
    stage = "G2";
    stageDescription = "Незначительное снижение";
    severity = "normal";
  } else if (egfr >= 45) {
    stage = "G3a";
    stageDescription = "Умеренное снижение (лёгкое)";
    severity = "warning";
  } else if (egfr >= 30) {
    stage = "G3b";
    stageDescription = "Умеренное снижение (выраженное)";
    severity = "warning";
  } else if (egfr >= 15) {
    stage = "G4";
    stageDescription = "Тяжёлое снижение";
    severity = "error";
  } else {
    stage = "G5";
    stageDescription = "Почечная недостаточность";
    severity = "error";
  }

  return { egfr: egfrRounded, stage, stageDescription, severity };
}
