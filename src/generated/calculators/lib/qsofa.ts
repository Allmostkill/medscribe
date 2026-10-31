// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/qsofa.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type qSOFAInput = {
  rr22plus: boolean;    // RR >= 22/min
  alteredMentation: boolean; // GCS < 15
  sbp100minus: boolean; // SBP <= 100 mmHg
};

export type qSOFAResult = {
  score: number;
  risk: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateQSOFA(input: qSOFAInput): qSOFAResult {
  const score =
    (input.rr22plus ? 1 : 0) +
    (input.alteredMentation ? 1 : 0) +
    (input.sbp100minus ? 1 : 0);

  if (score === 0) {
    return {
      score,
      risk: "Низкий риск",
      recommendation: "Низкий риск сепсиса — продолжать наблюдение",
      severity: "normal",
    };
  } else if (score === 1) {
    return {
      score,
      risk: "Умеренный риск",
      recommendation: "Умеренный риск — повышенное внимание, повторная оценка",
      severity: "warning",
    };
  } else {
    return {
      score,
      risk: "Высокий риск сепсиса",
      recommendation: "qSOFA ≥2 — высокий риск сепсиса, провести полный расчёт SOFA",
      severity: "error",
    };
  }
}
