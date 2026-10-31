// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/mess.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MESSInput = {
  energy: 1 | 2 | 3 | 4;              // 1=low, 2=medium, 3=high, 4=very high
  ischemia: 1 | 2 | 3;                // ischemia grade (before doubling)
  ischemiaOver6h: boolean;            // if >6h, double ischemia score
  shock: 0 | 1 | 2;                   // 0=normotensive, 1=transient, 2=persistent
  age: 0 | 1 | 2;                     // 0=<30, 1=30-50, 2=>50
};

export type MESSResult = {
  score: number;
  recommendation: string;
  severity: "normal" | "error";
};

export function calculateMESS(input: MESSInput): MESSResult {
  const ischemiaRaw = input.ischemia;
  const ischemiaScore = input.ischemiaOver6h ? ischemiaRaw * 2 : ischemiaRaw;

  const score = input.energy + ischemiaScore + input.shock + input.age;

  if (score < 7) {
    return {
      score,
      recommendation: "MESS <7 — попытка сохранения конечности оправдана",
      severity: "normal",
    };
  } else {
    return {
      score,
      recommendation: "MESS ≥7 — высокая вероятность ампутации (чувствительность ~70%)",
      severity: "error",
    };
  }
}

export const messEnergyOptions = [
  { value: 1, label: "1 — Низкая (тупая, нискоскоростная)" },
  { value: 2, label: "2 — Средняя (открытый перелом, вывих)" },
  { value: 3, label: "3 — Высокая (высокоскоростное огнестрельное, сдавление)" },
  { value: 4, label: "4 — Очень высокая (высокоскоростное + заражение)" },
];

export const messIschemiaOptions = [
  { value: 1, label: "1 — Пульс снижен или отсутствует, перфузия нормальная" },
  { value: 2, label: "2 — Пульс отсутствует, парестезии, замедл. наполнение" },
  { value: 3, label: "3 — Холодная, паралич, отсутствие капиллярного наполнения" },
];

export const messShockOptions = [
  { value: 0, label: "0 — Нормотензия (АДс >90 мм рт.ст.)" },
  { value: 1, label: "1 — Транзиторная гипотензия" },
  { value: 2, label: "2 — Стойкая гипотензия" },
];

export const messAgeOptions = [
  { value: 0, label: "0 — Младше 30 лет" },
  { value: 1, label: "1 — 30–50 лет" },
  { value: 2, label: "2 — Старше 50 лет" },
];
