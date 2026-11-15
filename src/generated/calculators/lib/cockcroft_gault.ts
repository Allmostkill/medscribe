// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/cockcroft_gault.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CockcroftGaultInput = {
  age: number; // years
  weight: number; // kg
  scr: number; // mg/dL
  sex: "male" | "female";
};

export type CockcroftGaultResult = {
  crcl: number; // mL/min
  stage: string;
  stageNumber: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateCockcroftGault(input: CockcroftGaultInput): CockcroftGaultResult {
  const { age, weight, scr, sex } = input;
  let crcl = ((140 - age) * weight) / (72 * scr);
  if (sex === "female") crcl *= 0.85;
  const rounded = Math.round(crcl * 10) / 10;

  return {
    crcl: rounded,
    ...interpretGFR(rounded),
  };
}

function interpretGFR(gfr: number) {
  if (gfr >= 90) {
    return {
      stage: "G1",
      stageNumber: 1,
      interpretation: "Норма или высокая СКФ",
      severity: "normal" as const,
      color: "success",
    };
  } else if (gfr >= 60) {
    return {
      stage: "G2",
      stageNumber: 2,
      interpretation: "Незначительное снижение СКФ",
      severity: "normal" as const,
      color: "success",
    };
  } else if (gfr >= 45) {
    return {
      stage: "G3a",
      stageNumber: 3,
      interpretation: "Умеренное снижение СКФ",
      severity: "warning" as const,
      color: "warning",
    };
  } else if (gfr >= 30) {
    return {
      stage: "G3b",
      stageNumber: 3,
      interpretation: "Умеренно-выраженное снижение СКФ",
      severity: "warning" as const,
      color: "warning",
    };
  } else if (gfr >= 15) {
    return {
      stage: "G4",
      stageNumber: 4,
      interpretation: "Выраженное снижение СКФ",
      severity: "error" as const,
      color: "error",
    };
  } else {
    return {
      stage: "G5",
      stageNumber: 5,
      interpretation: "Почечная недостаточность",
      severity: "error" as const,
      color: "error",
    };
  }
}
