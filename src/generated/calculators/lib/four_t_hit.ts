// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/four_t_hit.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type FourTHITInput = {
  thrombocytopenia: 0 | 1 | 2;  // Degree of fall
  timing: 0 | 1 | 2;            // Onset timing
  thrombosis: 0 | 1 | 2;        // Thrombosis/skin necrosis
  otherCauses: 0 | 1 | 2;       // Other causes
};

export type FourTHITResult = {
  score: number;
  probability: string;
  hitRate: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateFourTHIT(input: FourTHITInput): FourTHITResult {
  const score = input.thrombocytopenia + input.timing + input.thrombosis + input.otherCauses;

  if (score <= 3) {
    return {
      score, probability: "Низкая", hitRate: "~1%",
      interpretation: "Низкая вероятность ГИТ",
      severity: "normal",
      recommendation: "ГИТ маловероятна; продолжить гепарин при необходимости",
    };
  } else if (score <= 5) {
    return {
      score, probability: "Умеренная", hitRate: "~14%",
      interpretation: "Умеренная вероятность ГИТ",
      severity: "warning",
      recommendation: "Отменить гепарин, перейти на альтернативный антикоагулянт; исследование на антитела к PF4",
    };
  } else {
    return {
      score, probability: "Высокая", hitRate: "~64%",
      interpretation: "Высокая вероятность ГИТ",
      severity: "error",
      recommendation: "Немедленно отменить гепарин, начать прямой ингибитор тромбина или фондапаринукс",
    };
  }
}

export const fourTOptions = {
  thrombocytopenia: [
    { value: 0 as const, label: "0 — Снижение < 30% или надир < 10 ×10⁹/л" },
    { value: 1 as const, label: "1 — Снижение 30–50% или надир 10–19 ×10⁹/л" },
    { value: 2 as const, label: "2 — Снижение > 50% или надир ≥ 20 ×10⁹/л" },
  ],
  timing: [
    { value: 0 as const, label: "0 — Снижение < 4 дней (без предшествующего гепарина)" },
    { value: 1 as const, label: "1 — > 10 дней или < 1 дня (гепарин в последние 30–100 дн.)" },
    { value: 2 as const, label: "2 — 5–10 дней или ≤ 1 дня (гепарин < 30 дн. назад)" },
  ],
  thrombosis: [
    { value: 0 as const, label: "0 — Нет" },
    { value: 1 as const, label: "1 — Прогрессирующий или подозреваемый тромбоз / некроз кожи" },
    { value: 2 as const, label: "2 — Новый подтверждённый тромбоз или некроз кожи" },
  ],
  otherCauses: [
    { value: 0 as const, label: "0 — Очевидная альтернативная причина" },
    { value: 1 as const, label: "1 — Возможная альтернативная причина" },
    { value: 2 as const, label: "2 — Нет других очевидных причин" },
  ],
};
