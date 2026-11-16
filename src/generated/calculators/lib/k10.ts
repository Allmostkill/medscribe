// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/k10.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type K10Input = {
  q1: 1 | 2 | 3 | 4 | 5;  // Ощущение усталости без причины
  q2: 1 | 2 | 3 | 4 | 5;  // Нервозность
  q3: 1 | 2 | 3 | 4 | 5;  // Нервозность, что ничто не успокаивало
  q4: 1 | 2 | 3 | 4 | 5;  // Безнадёжность
  q5: 1 | 2 | 3 | 4 | 5;  // Беспокойство
  q6: 1 | 2 | 3 | 4 | 5;  // Беспокойство, которое мешало
  q7: 1 | 2 | 3 | 4 | 5;  // Депрессия
  q8: 1 | 2 | 3 | 4 | 5;  // Трудности с подъёмом настроения
  q9: 1 | 2 | 3 | 4 | 5;  // Ощущение, что всё — усилие
  q10: 1 | 2 | 3 | 4 | 5; // Ощущение собственной никчёмности
};

export type K10Result = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
};

export const k10Questions = [
  { key: "q1", text: "Вы чувствовали усталость без видимой причины?" },
  { key: "q2", text: "Вы были нервозны?" },
  { key: "q3", text: "Вы были так нервозны, что ничто не могло вас успокоить?" },
  { key: "q4", text: "Вы чувствовали безнадёжность?" },
  { key: "q5", text: "Вы были беспокойны или взволнованны?" },
  { key: "q6", text: "Вы были так беспокойны, что не могли усидеть на месте?" },
  { key: "q7", text: "Вы чувствовали себя подавленным или в депрессии?" },
  { key: "q8", text: "Вы чувствовали, что вам трудно поднять настроение?" },
  { key: "q9", text: "Вы чувствовали, что любое дело требует огромных усилий?" },
  { key: "q10", text: "Вы чувствовали собственную никчёмность?" },
];

export const k10AnswerOptions = [
  { value: 1, label: "1 — никогда" },
  { value: 2, label: "2 — иногда" },
  { value: 3, label: "3 — часть времени" },
  { value: 4, label: "4 — большую часть" },
  { value: 5, label: "5 — всё время" },
];

export function calculateK10(input: K10Input): K10Result {
  const score = (Object.values(input) as number[]).reduce((a, b) => a + b, 0);

  if (score <= 15) {
    return { score, severity: "normal", level: "Вероятно здоров", recommendation: "Клиническое вмешательство не требуется" };
  } else if (score <= 21) {
    return { score, severity: "warning", level: "Лёгкий дистресс", recommendation: "Консультация специалиста" };
  } else if (score <= 29) {
    return { score, severity: "warning", level: "Умеренный дистресс", recommendation: "Направление к специалисту по психическому здоровью" };
  } else {
    return { score, severity: "error", level: "Тяжёлый дистресс", recommendation: "Немедленное направление к специалисту" };
  }
}
