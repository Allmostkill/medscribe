// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/hunt_hess.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HuntHessInput = {
  grade: 0 | 1 | 2 | 3 | 4 | 5;
};

export type HuntHessResult = {
  grade: number;
  description: string;
  mortality: string;
  severity: "normal" | "warning" | "error";
};

export const huntHessGrades = [
  { value: 0 as const, label: "0 — Неразорвавшаяся аневризма", description: "Неразорвавшаяся аневризма", mortality: "0%" },
  { value: 1 as const, label: "1 — Бессимптомно или лёгкая головная боль", description: "Бессимптомно или лёгкая ГБ/ригидность затылка", mortality: "~2%" },
  { value: 2 as const, label: "2 — Умеренная/тяжёлая ГБ, ригидность", description: "Умеренная/тяжёлая ГБ, ригидность затылка, нет неврологического дефицита (кроме пареза ЧН)", mortality: "~5%" },
  { value: 3 as const, label: "3 — Сонливость / лёгкий очаговый дефицит", description: "Сонливость, спутанность или лёгкий очаговый дефицит", mortality: "~19%" },
  { value: 4 as const, label: "4 — Ступор, умеренный/тяжёлый гемипарез", description: "Ступор, умеренный/тяжёлый гемипарез, начальные децеребрационные позы", mortality: "~42%" },
  { value: 5 as const, label: "5 — Глубокая кома, децеребрационные позы", description: "Глубокая кома, децеребрационные позы, моribund", mortality: "~77%" },
];

export function calculateHuntHess(input: HuntHessInput): HuntHessResult {
  const grade = huntHessGrades[input.grade];
  let severity: "normal" | "warning" | "error";
  if (input.grade <= 1) severity = "normal";
  else if (input.grade <= 2) severity = "warning";
  else severity = "error";

  return {
    grade: input.grade,
    description: grade.description,
    mortality: grade.mortality,
    severity,
  };
}
