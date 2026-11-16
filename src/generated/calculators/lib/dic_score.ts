// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/dic_score.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type DICScoreInput = {
  platelets: 0 | 1 | 2;     // >100=0, 50-100=1, <50=2
  dDimer: 0 | 2 | 3;        // <5x=0, 5-25x=2, >=25x=3
  fibrinogen: 0 | 1;        // >=1 g/L=0, <1 g/L=1
  ptProlongation: 0 | 1 | 2; // <3s=0, 3-6s=1, >6s=2
};

export type DICScoreResult = {
  score: number;
  interpretation: string;
  diagnosis: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateDICScore(input: DICScoreInput): DICScoreResult {
  const score = input.platelets + input.dDimer + input.fibrinogen + input.ptProlongation;

  if (score >= 5) {
    return {
      score,
      interpretation: "Явный ДВС-синдром (≥ 5)",
      diagnosis: "Явный ДВС-синдром",
      severity: "error",
      recommendation: "Начать лечение ДВС; заместительная терапия (СЗП, тромбоциты, криопреципитат)",
    };
  } else {
    return {
      score,
      interpretation: "Не явный ДВС-синдром (< 5)",
      diagnosis: "Неявный ДВС или начальная стадия",
      severity: "warning",
      recommendation: "Повторить оценку через 1–2 дня; лечить основное заболевание",
    };
  }
}

export const dicOptions = {
  platelets: [
    { value: 0 as const, label: "0 — > 100 ×10⁹/л" },
    { value: 1 as const, label: "1 — 50–100 ×10⁹/л" },
    { value: 2 as const, label: "2 — < 50 ×10⁹/л" },
  ],
  dDimer: [
    { value: 0 as const, label: "0 — < 5× верхней границы нормы" },
    { value: 2 as const, label: "2 — 5–25× ВГН" },
    { value: 3 as const, label: "3 — ≥ 25× ВГН" },
  ],
  fibrinogen: [
    { value: 0 as const, label: "0 — ≥ 1 г/л" },
    { value: 1 as const, label: "1 — < 1 г/л" },
  ],
  ptProlongation: [
    { value: 0 as const, label: "0 — < 3 сек" },
    { value: 1 as const, label: "1 — 3–6 сек" },
    { value: 2 as const, label: "2 — > 6 сек" },
  ],
};
