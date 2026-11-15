// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/gad7.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type GAD7Input = {
  q1: 0 | 1 | 2 | 3;
  q2: 0 | 1 | 2 | 3;
  q3: 0 | 1 | 2 | 3;
  q4: 0 | 1 | 2 | 3;
  q5: 0 | 1 | 2 | 3;
  q6: 0 | 1 | 2 | 3;
  q7: 0 | 1 | 2 | 3;
};

export type GAD7Result = {
  score: number;
  level: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateGAD7(input: GAD7Input): GAD7Result {
  const score = (Object.values(input) as number[]).reduce((sum, v) => sum + v, 0);

  if (score <= 4) {
    return {
      score,
      level: "Минимальная тревога",
      interpretation: "Минимальная тревога",
      severity: "normal",
      recommendation: "Наблюдение при необходимости",
    };
  } else if (score <= 9) {
    return {
      score,
      level: "Лёгкая тревога",
      interpretation: "Лёгкая тревога",
      severity: "normal",
      recommendation: "Наблюдение, рассмотреть немедикаментозные методы",
    };
  } else if (score <= 14) {
    return {
      score,
      level: "Умеренная тревога",
      interpretation: "Умеренная тревога",
      severity: "warning",
      recommendation: "Рассмотреть лечение (КПТ, медикаментозная терапия)",
    };
  } else {
    return {
      score,
      level: "Тяжёлая тревога",
      interpretation: "Тяжёлая тревога",
      severity: "error",
      recommendation: "Активное лечение, направление к специалисту",
    };
  }
}

export const gad7Questions = [
  { key: "q1" as keyof GAD7Input, text: "Чувство тревоги, беспокойства или напряжения" },
  { key: "q2" as keyof GAD7Input, text: "Невозможность остановить беспокойство или контролировать его" },
  { key: "q3" as keyof GAD7Input, text: "Чрезмерное беспокойство по различным поводам" },
  { key: "q4" as keyof GAD7Input, text: "Трудности с расслаблением" },
  { key: "q5" as keyof GAD7Input, text: "Такое беспокойство, что трудно усидеть на месте" },
  { key: "q6" as keyof GAD7Input, text: "Легко раздражаетесь или сердитесь" },
  { key: "q7" as keyof GAD7Input, text: "Ощущение страха, как будто может случиться что-то ужасное" },
];

export const gad7AnswerOptions = [
  { value: 0 as const, label: "Ни разу" },
  { value: 1 as const, label: "Несколько дней" },
  { value: 2 as const, label: "Больше половины дней" },
  { value: 3 as const, label: "Почти каждый день" },
];
