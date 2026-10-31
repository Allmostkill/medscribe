// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ecog.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ECOGInput = {
  grade: 0 | 1 | 2 | 3 | 4 | 5;
};

export type ECOGResult = {
  grade: number;
  description: string;
  karnofsky: string;
  severity: "normal" | "warning" | "error";
};

export const ecogGrades = [
  {
    value: 0 as const,
    label: "0 — Полностью активен",
    description: "Полностью активен, без ограничений",
    karnofsky: "100%",
  },
  {
    value: 1 as const,
    label: "1 — Ограничена тяжёлая физическая активность",
    description: "Ограничена тяжёлая физическая активность, но способен выполнять лёгкую работу",
    karnofsky: "80–90%",
  },
  {
    value: 2 as const,
    label: "2 — Амбулаторный > 50% времени бодрствования",
    description: "Амбулаторный пациент, способен к самообслуживанию, не может работать; > 50% времени бодрствования",
    karnofsky: "60–70%",
  },
  {
    value: 3 as const,
    label: "3 — Ограниченное самообслуживание",
    description: "Самообслуживание ограничено; > 50% времени в постели или кресле",
    karnofsky: "40–50%",
  },
  {
    value: 4 as const,
    label: "4 — Полностью нетрудоспособен",
    description: "Полностью нетрудоспособен; прикован к постели или к инвалидной коляске",
    karnofsky: "20–30%",
  },
  {
    value: 5 as const,
    label: "5 — Смерть",
    description: "Смерть",
    karnofsky: "0%",
  },
];

export function calculateECOG(input: ECOGInput): ECOGResult {
  const g = ecogGrades[input.grade];
  let severity: "normal" | "warning" | "error";
  if (input.grade <= 1) severity = "normal";
  else if (input.grade <= 2) severity = "warning";
  else severity = "error";

  return {
    grade: input.grade,
    description: g.description,
    karnofsky: g.karnofsky,
    severity,
  };
}
