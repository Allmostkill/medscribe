// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/apgar.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ApgarInput = {
  appearance: 0 | 1 | 2; // Skin color
  pulse: 0 | 1 | 2; // Heart rate
  grimace: 0 | 1 | 2; // Reflex irritability
  activity: 0 | 1 | 2; // Muscle tone
  respiration: 0 | 1 | 2; // Breathing
};

export type ApgarResult = {
  score: number;
  severity: "normal" | "warning" | "error";
  color: string;
  level: string;
  interpretation: string;
};

export const apgarOptions = {
  appearance: [
    { value: 0, label: "0 — Синюшный/бледный (весь)" },
    { value: 1, label: "1 — Тело розовое, конечности синюшные" },
    { value: 2, label: "2 — Полностью розовый" },
  ],
  pulse: [
    { value: 0, label: "0 — Отсутствует" },
    { value: 1, label: "1 — < 100 уд/мин" },
    { value: 2, label: "2 — ≥ 100 уд/мин" },
  ],
  grimace: [
    { value: 0, label: "0 — Нет ответа" },
    { value: 1, label: "1 — Гримаса" },
    { value: 2, label: "2 — Кашель, чихание, крик" },
  ],
  activity: [
    { value: 0, label: "0 — Вялый (атония)" },
    { value: 1, label: "1 — Умеренный тонус" },
    { value: 2, label: "2 — Активные движения" },
  ],
  respiration: [
    { value: 0, label: "0 — Отсутствует" },
    { value: 1, label: "1 — Нерегулярное, слабый крик" },
    { value: 2, label: "2 — Регулярное, громкий крик" },
  ],
};

export function calculateApgar(input: ApgarInput): ApgarResult {
  const score =
    input.appearance +
    input.pulse +
    input.grimace +
    input.activity +
    input.respiration;

  if (score >= 7) {
    return {
      score,
      severity: "normal",
      color: "success",
      level: "Норма",
      interpretation: "Апгар 7–10 — удовлетворительное состояние",
    };
  } else if (score >= 4) {
    return {
      score,
      severity: "warning",
      color: "warning",
      level: "Умеренное угнетение",
      interpretation: "Апгар 4–6 — требуется стимуляция и наблюдение",
    };
  } else {
    return {
      score,
      severity: "error",
      color: "error",
      level: "Тяжёлое угнетение",
      interpretation: "Апгар 0–3 — немедленная реанимация",
    };
  }
}
