// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/mifflin.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MifflinInput = {
  weight: number;    // kg
  height: number;    // cm
  age: number;       // years
  female: boolean;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "veryActive";
};

export type MifflinResult = {
  bmr: number;
  tdee: number;
  activityMultiplier: number;
  activityLabel: string;
  severity: "normal";
  interpretation: string;
};

const activityMultipliers: Record<MifflinInput["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

const activityLabels: Record<MifflinInput["activityLevel"], string> = {
  sedentary: "Малоподвижный образ жизни",
  light: "Лёгкая активность (1–3 дня/нед)",
  moderate: "Умеренная активность (3–5 дней/нед)",
  active: "Высокая активность (6–7 дней/нед)",
  veryActive: "Очень высокая (тяжёлый труд/2x тренировки)",
};

export function calculateMifflin(input: MifflinInput): MifflinResult {
  const { weight, height, age, female, activityLevel } = input;

  let bmr = 10 * weight + 6.25 * height - 5 * age;
  if (female) bmr -= 161;
  else bmr += 5;

  const activityMultiplier = activityMultipliers[activityLevel];
  const tdee = bmr * activityMultiplier;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityMultiplier,
    activityLabel: activityLabels[activityLevel],
    severity: "normal",
    interpretation: `Основной обмен: ${Math.round(bmr)} ккал/сут`,
  };
}

export const activityOptions = [
  { value: "sedentary", label: "Малоподвижный (нет нагрузок)" },
  { value: "light", label: "Лёгкий (1–3 дня/нед)" },
  { value: "moderate", label: "Умеренный (3–5 дней/нед)" },
  { value: "active", label: "Высокий (6–7 дней/нед)" },
  { value: "veryActive", label: "Очень высокий (2x тренировки/день)" },
];
