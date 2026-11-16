// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/phq2.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PHQ2Input = {
  q1: 0 | 1 | 2 | 3;
  q2: 0 | 1 | 2 | 3;
};

export type PHQ2Result = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
  positiveScreen: boolean;
};

export const phq2Questions = [
  { key: "q1", text: "Подавленное настроение, депрессия, безнадёжность" },
  { key: "q2", text: "Снижение интереса или удовольствия" },
];

export const phq2AnswerOptions = [
  { value: 0, label: "Ни разу" },
  { value: 1, label: "Несколько дней" },
  { value: 2, label: "Больше половины дней" },
  { value: 3, label: "Почти каждый день" },
];

export function calculatePHQ2(input: PHQ2Input): PHQ2Result {
  const score = input.q1 + input.q2;
  const positiveScreen = score >= 3;

  if (score <= 2) {
    return {
      score,
      severity: "normal",
      level: "Маловероятна депрессия",
      recommendation: "Наблюдение при необходимости",
      positiveScreen,
    };
  } else {
    return {
      score,
      severity: "error",
      level: "Положительный скрининг",
      recommendation: "Провести полный PHQ-9 для уточнения диагноза",
      positiveScreen,
    };
  }
}
