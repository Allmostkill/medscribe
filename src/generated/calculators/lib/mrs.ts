// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/mrs.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MRSInput = {
  grade: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

export type MRSResult = {
  grade: number;
  description: string;
  category: string;
  severity: "normal" | "warning" | "error";
};

export const mrsGrades = [
  { value: 0 as const, label: "0 — Нет симптомов", description: "Нет симптомов", category: "Отличный исход" },
  { value: 1 as const, label: "1 — Незначительная инвалидизация", description: "Незначительные симптомы, но без ограничений привычной деятельности", category: "Хороший исход" },
  { value: 2 as const, label: "2 — Лёгкая инвалидизация", description: "Некоторые ограничения, но независим в повседневной деятельности", category: "Лёгкая инвалидизация" },
  { value: 3 as const, label: "3 — Умеренная инвалидизация", description: "Нуждается в помощи, но ходит самостоятельно", category: "Умеренная инвалидизация" },
  { value: 4 as const, label: "4 — Умеренно-тяжёлая инвалидизация", description: "Не может ходить/обслуживать себя без посторонней помощи", category: "Тяжёлая инвалидизация" },
  { value: 5 as const, label: "5 — Тяжёлая инвалидизация", description: "Прикован к постели, недержание, круглосуточный уход", category: "Тяжёлая инвалидизация" },
  { value: 6 as const, label: "6 — Смерть", description: "Смерть", category: "Летальный исход" },
];

export function calculateMRS(input: MRSInput): MRSResult {
  const g = mrsGrades[input.grade];
  let severity: "normal" | "warning" | "error";
  if (input.grade <= 1) severity = "normal";
  else if (input.grade <= 3) severity = "warning";
  else severity = "error";

  return {
    grade: input.grade,
    description: g.description,
    category: g.category,
    severity,
  };
}
