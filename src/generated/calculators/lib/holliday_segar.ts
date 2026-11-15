// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/holliday_segar.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HollidaySegarInput = {
  weight: number; // kg
};

export type HollidaySegarResult = {
  dailyMl: number;
  hourlyMl: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  breakdown: string;
};

export function calculateHollidaySegar(input: HollidaySegarInput): HollidaySegarResult {
  const { weight } = input;
  let dailyMl: number;
  let hourlyMl: number;
  let breakdown: string;

  if (weight <= 10) {
    dailyMl = weight * 100;
    hourlyMl = weight * 4;
    breakdown = `${weight} кг × 100 мл/кг = ${dailyMl} мл/сут`;
  } else if (weight <= 20) {
    dailyMl = 1000 + (weight - 10) * 50;
    hourlyMl = 40 + (weight - 10) * 2;
    breakdown = `1000 + (${weight} − 10) × 50 = ${dailyMl} мл/сут`;
  } else {
    dailyMl = 1500 + (weight - 20) * 20;
    hourlyMl = 60 + (weight - 20) * 1;
    breakdown = `1500 + (${weight} − 20) × 20 = ${dailyMl} мл/сут`;
  }

  const hourlyRounded = Math.round(hourlyMl * 10) / 10;

  return {
    dailyMl: Math.round(dailyMl),
    hourlyMl: hourlyRounded,
    interpretation: `Поддерживающий объём: ${Math.round(dailyMl)} мл/сут (${hourlyRounded} мл/ч)`,
    severity: "normal",
    breakdown,
  };
}
