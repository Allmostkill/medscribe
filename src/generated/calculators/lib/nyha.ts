// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/nyha.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type NYHAInput = {
  grade: 1 | 2 | 3 | 4;
};

export type NYHAResult = {
  grade: number;
  description: string;
  prognosis: string;
  severity: "normal" | "warning" | "error";
};

export const nyhaGrades = [
  {
    value: 1 as const,
    label: "I — Нет ограничений физической активности",
    description: "Нет ограничений физической активности. Обычная нагрузка не вызывает симптомов.",
    prognosis: "5-летняя выживаемость ~85%",
  },
  {
    value: 2 as const,
    label: "II — Незначительное ограничение",
    description: "Незначительное ограничение физической активности. В покое симптомов нет. Обычная нагрузка вызывает одышку/усталость/сердцебиение.",
    prognosis: "5-летняя выживаемость ~75%",
  },
  {
    value: 3 as const,
    label: "III — Выраженное ограничение",
    description: "Выраженное ограничение физической активности. В покое симптомов нет. Нагрузка меньше обычной вызывает симптомы.",
    prognosis: "5-летняя выживаемость ~50%",
  },
  {
    value: 4 as const,
    label: "IV — Симптомы в покое",
    description: "Любая физическая активность вызывает дискомфорт. Симптомы присутствуют в покое.",
    prognosis: "5-летняя выживаемость ~25%",
  },
];

export function calculateNYHA(input: NYHAInput): NYHAResult {
  const g = nyhaGrades[input.grade - 1];
  let severity: "normal" | "warning" | "error";
  if (input.grade === 1) severity = "normal";
  else if (input.grade === 2) severity = "warning";
  else severity = "error";

  return {
    grade: input.grade,
    description: g.description,
    prognosis: g.prognosis,
    severity,
  };
}
