// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/gds15.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type GDS15Input = {
  q1: boolean;  // В целом довольны жизнью? → нет scores 1
  q2: boolean;  // Забросили занятия и интересы? → да scores 1
  q3: boolean;  // Ощущаете, что жизнь пуста? → да scores 1
  q4: boolean;  // Вам часто скучно? → да scores 1
  q5: boolean;  // В хорошем настроении? → нет scores 1
  q6: boolean;  // Боитесь, что случится плохое? → да scores 1
  q7: boolean;  // Чувствуете себя счастливым? → нет scores 1
  q8: boolean;  // Часто чувствуете беспомощность? → да scores 1
  q9: boolean;  // Предпочитаете оставаться дома? → да scores 1
  q10: boolean; // Больше проблем с памятью? → да scores 1
  q11: boolean; // Думаете, что жить — замечательно? → нет scores 1
  q12: boolean; // Чувствуете себя никчёмным? → да scores 1
  q13: boolean; // Чувствуете прилив энергии? → нет scores 1
  q14: boolean; // Ситуация безнадёжна? → да scores 1
  q15: boolean; // Большинство живут лучше вас? → да scores 1
};

export type GDS15Result = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
};

// Each question: { text, depressiveAnswer: true=да/false=нет scores 1 }
export const gds15Questions: { key: keyof GDS15Input; text: string; depressiveAnswer: boolean }[] = [
  { key: "q1", text: "В целом вы довольны своей жизнью?", depressiveAnswer: false },
  { key: "q2", text: "Вы забросили многие свои занятия и интересы?", depressiveAnswer: true },
  { key: "q3", text: "Вы ощущаете, что ваша жизнь пуста?", depressiveAnswer: true },
  { key: "q4", text: "Вам часто бывает скучно?", depressiveAnswer: true },
  { key: "q5", text: "Вы обычно в хорошем настроении?", depressiveAnswer: false },
  { key: "q6", text: "Вы боитесь, что с вами случится что-то плохое?", depressiveAnswer: true },
  { key: "q7", text: "Вы чувствуете себя счастливым большую часть времени?", depressiveAnswer: false },
  { key: "q8", text: "Вы часто чувствуете беспомощность?", depressiveAnswer: true },
  { key: "q9", text: "Вы предпочитаете оставаться дома, а не выходить и не делать что-то новое?", depressiveAnswer: true },
  { key: "q10", text: "Вы считаете, что у вас больше проблем с памятью, чем у большинства?", depressiveAnswer: true },
  { key: "q11", text: "Вы думаете, что жить — это замечательно?", depressiveAnswer: false },
  { key: "q12", text: "Вы чувствуете себя никчёмным таким, какой вы есть?", depressiveAnswer: true },
  { key: "q13", text: "Вы ощущаете прилив энергии?", depressiveAnswer: false },
  { key: "q14", text: "Вы считаете, что ваша ситуация безнадёжна?", depressiveAnswer: true },
  { key: "q15", text: "Вы думаете, что у большинства людей положение лучше, чем у вас?", depressiveAnswer: true },
];

export function calculateGDS15(input: GDS15Input): GDS15Result {
  let score = 0;
  for (const q of gds15Questions) {
    const answer = input[q.key];
    if (q.depressiveAnswer === answer) {
      score++;
    }
  }

  if (score <= 4) {
    return { score, severity: "normal", level: "Депрессия маловероятна", recommendation: "Наблюдение" };
  } else if (score <= 8) {
    return { score, severity: "warning", level: "Лёгкая депрессия", recommendation: "Дополнительная клиническая оценка" };
  } else if (score <= 11) {
    return { score, severity: "error", level: "Умеренная депрессия", recommendation: "Клиническая оценка и лечение" };
  } else {
    return { score, severity: "error", level: "Тяжёлая депрессия", recommendation: "Немедленная клиническая оценка" };
  }
}
