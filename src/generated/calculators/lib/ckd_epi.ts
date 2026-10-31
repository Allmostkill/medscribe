// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ckd_epi.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CKDEPIInput = {
  scr: number; // mg/dL
  age: number; // years
  sex: "male" | "female";
};

export type CKDEPIResult = {
  egfr: number; // mL/min/1.73m²
  stage: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateCKDEPI(input: CKDEPIInput): CKDEPIResult {
  const { scr, age, sex } = input;

  // CKD-EPI 2021 (race-free)
  const isFemale = sex === "female";
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const sexFactor = isFemale ? 1.012 : 1.0;

  const scrKappa = scr / kappa;
  const minTerm = Math.min(scrKappa, 1);
  const maxTerm = Math.max(scrKappa, 1);

  const egfr =
    142 *
    Math.pow(minTerm, alpha) *
    Math.pow(maxTerm, -1.2) *
    Math.pow(0.9938, age) *
    sexFactor;

  const rounded = Math.round(egfr * 10) / 10;

  return {
    egfr: rounded,
    ...interpretGFRStage(rounded),
  };
}

function interpretGFRStage(gfr: number) {
  if (gfr >= 90) {
    return {
      stage: "G1 (ХБП 1)",
      interpretation: "Норма или высокая СКФ",
      severity: "normal" as const,
      color: "success",
    };
  } else if (gfr >= 60) {
    return {
      stage: "G2 (ХБП 2)",
      interpretation: "Незначительное снижение СКФ",
      severity: "normal" as const,
      color: "success",
    };
  } else if (gfr >= 45) {
    return {
      stage: "G3a (ХБП 3а)",
      interpretation: "Умеренное снижение СКФ",
      severity: "warning" as const,
      color: "warning",
    };
  } else if (gfr >= 30) {
    return {
      stage: "G3b (ХБП 3б)",
      interpretation: "Умеренно-выраженное снижение СКФ",
      severity: "warning" as const,
      color: "warning",
    };
  } else if (gfr >= 15) {
    return {
      stage: "G4 (ХБП 4)",
      interpretation: "Выраженное снижение СКФ",
      severity: "error" as const,
      color: "error",
    };
  } else {
    return {
      stage: "G5 (ХБП 5 / Диализ)",
      interpretation: "Почечная недостаточность",
      severity: "error" as const,
      color: "error",
    };
  }
}
