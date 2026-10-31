// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/harris_benedict.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HarrisBenedictInput = {
  weight: number; // kg
  height: number; // cm
  age: number; // years
  sex: "male" | "female";
  activity: "sedentary" | "light" | "moderate" | "active" | "very_active";
};

export type HarrisBenedictResult = {
  bmr: number; // kcal/day
  tdee: number; // kcal/day
  activityLabel: string;
  severity: "normal";
  color: string;
};

const activityFactors: Record<string, { factor: number; label: string }> = {
  sedentary: { factor: 1.2, label: "Сидячий образ жизни (нет нагрузок)" },
  light: { factor: 1.375, label: "Лёгкая активность (1–3 тр/нед)" },
  moderate: { factor: 1.55, label: "Умеренная активность (3–5 тр/нед)" },
  active: { factor: 1.725, label: "Высокая активность (6–7 тр/нед)" },
  very_active: { factor: 1.9, label: "Очень высокая активность (2 тр/день)" },
};

export function calculateHarrisBenedict(input: HarrisBenedictInput): HarrisBenedictResult {
  const { weight, height, age, sex, activity } = input;

  let bmr: number;
  if (sex === "male") {
    bmr = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  } else {
    bmr = 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
  }

  const { factor, label } = activityFactors[activity];
  const tdee = bmr * factor;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityLabel: label,
    severity: "normal",
    color: "success",
  };
}
