// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/phq9.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PHQ9Input = {
  q1: 0 | 1 | 2 | 3; // Anhedonia
  q2: 0 | 1 | 2 | 3; // Depressed mood
  q3: 0 | 1 | 2 | 3; // Sleep problems
  q4: 0 | 1 | 2 | 3; // Fatigue
  q5: 0 | 1 | 2 | 3; // Appetite
  q6: 0 | 1 | 2 | 3; // Feeling bad about self
  q7: 0 | 1 | 2 | 3; // Concentration
  q8: 0 | 1 | 2 | 3; // Psychomotor
  q9: 0 | 1 | 2 | 3; // Suicidal ideation
};

export type PHQ9Result = {
  score: number;
  severity: "normal" | "warning" | "error";
  color: string;
  level: string;
  recommendation: string;
  suicidalRisk: boolean;
};

const answerOptions = [
  { value: 0, label: "Ни разу" },
  { value: 1, label: "Несколько дней" },
  { value: 2, label: "Больше половины дней" },
  { value: 3, label: "Почти каждый день" },
];

export const phq9Questions = [
  { key: "q1", text: "Слабый интерес или удовольствие от дел" },
  { key: "q2", text: "Чувство подавленности, безнадёжности" },
  { key: "q3", text: "Нарушения сна (бессонница или избыточная сонливость)" },
  { key: "q4", text: "Усталость или упадок сил" },
  { key: "q5", text: "Плохой аппетит или переедание" },
  { key: "q6", text: "Чувство никчёмности или вины" },
  { key: "q7", text: "Трудности с концентрацией" },
  { key: "q8", text: "Замедленность или беспокойство (по наблюдению других)" },
  { key: "q9", text: "Мысли о причинении себе вреда или смерти" },
];

export { answerOptions as phq9AnswerOptions };

export function calculatePHQ9(input: PHQ9Input): PHQ9Result {
  const score = (Object.values(input) as number[]).reduce((a, b) => a + b, 0);
  const suicidalRisk = input.q9 > 0;

  if (score <= 4) {
    return {
      score,
      severity: "normal",
      color: "success",
      level: "Минимальная депрессия",
      recommendation: "Наблюдение, поддержка",
      suicidalRisk,
    };
  } else if (score <= 9) {
    return {
      score,
      severity: "warning",
      color: "warning",
      level: "Лёгкая депрессия",
      recommendation: "Повторная оценка через 1 месяц",
      suicidalRisk,
    };
  } else if (score <= 14) {
    return {
      score,
      severity: "warning",
      color: "warning",
      level: "Умеренная депрессия",
      recommendation: "Разработка плана лечения, психотерапия или фармакотерапия",
      suicidalRisk,
    };
  } else if (score <= 19) {
    return {
      score,
      severity: "error",
      color: "error",
      level: "Умеренно-тяжёлая депрессия",
      recommendation: "Активное лечение — психотерапия, антидепрессанты",
      suicidalRisk,
    };
  } else {
    return {
      score,
      severity: "error",
      color: "error",
      level: "Тяжёлая депрессия",
      recommendation: "Немедленное начало лечения, рассмотреть госпитализацию",
      suicidalRisk,
    };
  }
}
