// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/bai.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type BAIInput = {
  q1: 0 | 1 | 2 | 3;  // Онемение/покалывание
  q2: 0 | 1 | 2 | 3;  // Приливы жара
  q3: 0 | 1 | 2 | 3;  // Дрожь в ногах
  q4: 0 | 1 | 2 | 3;  // Неспособность расслабиться
  q5: 0 | 1 | 2 | 3;  // Страх что случится ужасное
  q6: 0 | 1 | 2 | 3;  // Головокружение
  q7: 0 | 1 | 2 | 3;  // Учащённое сердцебиение
  q8: 0 | 1 | 2 | 3;  // Неустойчивость
  q9: 0 | 1 | 2 | 3;  // Ужас
  q10: 0 | 1 | 2 | 3; // Нервозность
  q11: 0 | 1 | 2 | 3; // Ощущение удушья
  q12: 0 | 1 | 2 | 3; // Дрожание рук
  q13: 0 | 1 | 2 | 3; // Дрожь/шаткость
  q14: 0 | 1 | 2 | 3; // Страх потерять контроль
  q15: 0 | 1 | 2 | 3; // Затруднённое дыхание
  q16: 0 | 1 | 2 | 3; // Страх смерти
  q17: 0 | 1 | 2 | 3; // Испуг
  q18: 0 | 1 | 2 | 3; // Расстройство желудка/тошнота
  q19: 0 | 1 | 2 | 3; // Обмороки/слабость
  q20: 0 | 1 | 2 | 3; // Покраснение лица
  q21: 0 | 1 | 2 | 3; // Потоотделение
};

export type BAIResult = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
};

export const baiQuestions = [
  { key: "q1", text: "Онемение или покалывание" },
  { key: "q2", text: "Приливы жара" },
  { key: "q3", text: "Дрожь в ногах" },
  { key: "q4", text: "Неспособность расслабиться" },
  { key: "q5", text: "Страх, что случится что-то ужасное" },
  { key: "q6", text: "Головокружение или дурнота" },
  { key: "q7", text: "Учащённое сердцебиение" },
  { key: "q8", text: "Неустойчивость" },
  { key: "q9", text: "Ужас" },
  { key: "q10", text: "Нервозность" },
  { key: "q11", text: "Ощущение удушья" },
  { key: "q12", text: "Дрожание рук" },
  { key: "q13", text: "Дрожь или шаткость" },
  { key: "q14", text: "Страх потерять контроль" },
  { key: "q15", text: "Затруднённое дыхание" },
  { key: "q16", text: "Страх смерти" },
  { key: "q17", text: "Испуг" },
  { key: "q18", text: "Расстройство желудка или тошнота" },
  { key: "q19", text: "Обмороки или слабость" },
  { key: "q20", text: "Покраснение лица" },
  { key: "q21", text: "Потоотделение (не связанное с жарой)" },
];

export const baiAnswerOptions = [
  { value: 0, label: "0 — совсем нет" },
  { value: 1, label: "1 — слабо" },
  { value: 2, label: "2 — умеренно" },
  { value: 3, label: "3 — сильно" },
];

export function calculateBAI(input: BAIInput): BAIResult {
  const score = (Object.values(input) as number[]).reduce((a, b) => a + b, 0);

  if (score <= 9) {
    return { score, severity: "normal", level: "Минимальная тревога", recommendation: "Наблюдение" };
  } else if (score <= 18) {
    return { score, severity: "warning", level: "Лёгкая — умеренная тревога", recommendation: "Мониторинг, психотерапия" };
  } else if (score <= 29) {
    return { score, severity: "warning", level: "Умеренная — выраженная тревога", recommendation: "Психотерапия и/или фармакотерапия" };
  } else {
    return { score, severity: "error", level: "Тяжёлая тревога", recommendation: "Активное лечение обязательно" };
  }
}
