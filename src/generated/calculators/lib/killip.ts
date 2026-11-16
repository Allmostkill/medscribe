// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/killip.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type KillipInput = {
  grade: 1 | 2 | 3 | 4;
};

export type KillipResult = {
  grade: number;
  description: string;
  mortality: string;
  severity: "normal" | "warning" | "error";
};

export const killipGrades = [
  {
    value: 1 as const,
    label: "I — Нет признаков СН",
    description: "Нет признаков сердечной недостаточности",
    mortality: "~6%",
  },
  {
    value: 2 as const,
    label: "II — Лёгкая СН (хрипы < 50%, S3, набухание яремных вен)",
    description: "Лёгкая СН: хрипы в < 50% лёгочных полей, III тон, набухание яремных вен",
    mortality: "~17%",
  },
  {
    value: 3 as const,
    label: "III — Отёк лёгких (хрипы > 50%)",
    description: "Отёк лёгких: хрипы в > 50% лёгочных полей",
    mortality: "~38%",
  },
  {
    value: 4 as const,
    label: "IV — Кардиогенный шок",
    description: "Кардиогенный шок: гипотензия (АД < 90), вазоконстрикция, цианоз, олигурия",
    mortality: "~81%",
  },
];

export function calculateKillip(input: KillipInput): KillipResult {
  const g = killipGrades[input.grade - 1];
  let severity: "normal" | "warning" | "error";
  if (input.grade === 1) severity = "normal";
  else if (input.grade === 2) severity = "warning";
  else severity = "error";

  return {
    grade: input.grade,
    description: g.description,
    mortality: g.mortality,
    severity,
  };
}
