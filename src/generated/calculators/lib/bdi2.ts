// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/bdi2.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type BDI2Input = {
  q1: 0 | 1 | 2 | 3;  // Грусть
  q2: 0 | 1 | 2 | 3;  // Пессимизм
  q3: 0 | 1 | 2 | 3;  // Прошлые неудачи
  q4: 0 | 1 | 2 | 3;  // Потеря удовольствия
  q5: 0 | 1 | 2 | 3;  // Чувство вины
  q6: 0 | 1 | 2 | 3;  // Чувство наказания
  q7: 0 | 1 | 2 | 3;  // Недовольство собой
  q8: 0 | 1 | 2 | 3;  // Самокритика
  q9: 0 | 1 | 2 | 3;  // Суицидальные мысли
  q10: 0 | 1 | 2 | 3; // Плаксивость
  q11: 0 | 1 | 2 | 3; // Возбуждение
  q12: 0 | 1 | 2 | 3; // Потеря интереса
  q13: 0 | 1 | 2 | 3; // Нерешительность
  q14: 0 | 1 | 2 | 3; // Ощущение бесполезности
  q15: 0 | 1 | 2 | 3; // Потеря энергии
  q16: 0 | 1 | 2 | 3; // Изменения сна
  q17: 0 | 1 | 2 | 3; // Раздражительность
  q18: 0 | 1 | 2 | 3; // Изменения аппетита
  q19: 0 | 1 | 2 | 3; // Трудности с концентрацией
  q20: 0 | 1 | 2 | 3; // Усталость
  q21: 0 | 1 | 2 | 3; // Потеря интереса к сексу
};

export type BDI2Result = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
  cognitiveAffective: number;
  somatic: number;
  suicidalIdeation: boolean;
};

export const bdi2Questions = [
  { key: "q1", text: "Грусть" },
  { key: "q2", text: "Пессимизм" },
  { key: "q3", text: "Прошлые неудачи" },
  { key: "q4", text: "Потеря удовольствия" },
  { key: "q5", text: "Чувство вины" },
  { key: "q6", text: "Чувство наказания" },
  { key: "q7", text: "Недовольство собой" },
  { key: "q8", text: "Самокритика" },
  { key: "q9", text: "Суицидальные мысли или желание причинить себе вред" },
  { key: "q10", text: "Плаксивость" },
  { key: "q11", text: "Возбуждение" },
  { key: "q12", text: "Потеря интереса" },
  { key: "q13", text: "Нерешительность" },
  { key: "q14", text: "Ощущение бесполезности" },
  { key: "q15", text: "Потеря энергии" },
  { key: "q16", text: "Изменения режима сна" },
  { key: "q17", text: "Раздражительность" },
  { key: "q18", text: "Изменения аппетита" },
  { key: "q19", text: "Трудности с концентрацией" },
  { key: "q20", text: "Усталость или утомляемость" },
  { key: "q21", text: "Потеря интереса к сексу" },
];

export const bdi2AnswerOptions = [
  { value: 0, label: "0 — отсутствует" },
  { value: 1, label: "1 — лёгкая степень" },
  { value: 2, label: "2 — умеренная степень" },
  { value: 3, label: "3 — выраженная степень" },
];

export function calculateBDI2(input: BDI2Input): BDI2Result {
  const values = Object.values(input) as number[];
  const score = values.reduce((a, b) => a + b, 0);

  // Cognitive-affective subscale: items 1-13
  const cognitiveAffective =
    input.q1 + input.q2 + input.q3 + input.q4 + input.q5 +
    input.q6 + input.q7 + input.q8 + input.q9 + input.q10 +
    input.q11 + input.q12 + input.q13;

  // Somatic subscale: items 14-21
  const somatic =
    input.q14 + input.q15 + input.q16 + input.q17 + input.q18 +
    input.q19 + input.q20 + input.q21;

  const suicidalIdeation = input.q9 >= 1;

  if (score <= 13) {
    return { score, severity: "normal", level: "Минимальная депрессия", recommendation: "Наблюдение", cognitiveAffective, somatic, suicidalIdeation };
  } else if (score <= 19) {
    return { score, severity: "warning", level: "Лёгкая депрессия", recommendation: "Мониторинг, психотерапия", cognitiveAffective, somatic, suicidalIdeation };
  } else if (score <= 28) {
    return { score, severity: "warning", level: "Умеренная депрессия", recommendation: "Психотерапия и/или фармакотерапия", cognitiveAffective, somatic, suicidalIdeation };
  } else {
    return { score, severity: "error", level: "Тяжёлая депрессия", recommendation: "Активное лечение, возможна госпитализация", cognitiveAffective, somatic, suicidalIdeation };
  }
}
