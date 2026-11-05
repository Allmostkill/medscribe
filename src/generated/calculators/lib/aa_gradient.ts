// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/aa_gradient.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type AaGradientInput = {
  age: number; // years
  fio2: number; // fraction 0.21–1.0
  paco2: number; // mmHg, arterial
  pao2: number; // mmHg, arterial (from ABG)
};

export type AaGradientResult = {
  pao2Alveolar: number; // calculated alveolar PAO2
  aaGradient: number; // A-a gradient value
  normalGradient: number; // expected normal A-a gradient for age (at FiO2=0.21)
  category: string;
  severity: "normal" | "warning" | "error";
  color: string;
  interpretation: string;
};

export function calculateAaGradient(input: AaGradientInput): AaGradientResult {
  // PAO2 = FiO2 × 713 - PaCO2 / 0.8
  const pao2Alveolar = Math.round((input.fio2 * 713 - input.paco2 / 0.8) * 10) / 10;

  // A-a gradient = PAO2 (alveolar) - PaO2 (arterial)
  const aaGradient = Math.round((pao2Alveolar - input.pao2) * 10) / 10;

  // Normal A-a gradient = Age/4 + 4 (at room air FiO2=0.21)
  const normalGradient = Math.round((input.age / 4 + 4) * 10) / 10;

  if (aaGradient <= normalGradient) {
    return {
      pao2Alveolar,
      aaGradient,
      normalGradient,
      category: "Норма",
      severity: "normal",
      color: "success",
      interpretation: "Нормальный газообмен",
    };
  } else if (aaGradient <= 20) {
    return {
      pao2Alveolar,
      aaGradient,
      normalGradient,
      category: "Лёгкое нарушение",
      severity: "warning",
      color: "warning",
      interpretation: "Незначительное нарушение газообмена",
    };
  } else if (aaGradient <= 40) {
    return {
      pao2Alveolar,
      aaGradient,
      normalGradient,
      category: "Умеренное нарушение",
      severity: "error",
      color: "error",
      interpretation: "Умеренное нарушение — рассмотрите ТЭЛА, пневмонию, отёк лёгких",
    };
  } else {
    return {
      pao2Alveolar,
      aaGradient,
      normalGradient,
      category: "Тяжёлое нарушение",
      severity: "error",
      color: "error",
      interpretation: "Тяжёлое нарушение газообмена",
    };
  }
}
