// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/hama.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HAMAInput = {
  q1: 0 | 1 | 2 | 3 | 4;  // Тревожное настроение
  q2: 0 | 1 | 2 | 3 | 4;  // Напряжение
  q3: 0 | 1 | 2 | 3 | 4;  // Страхи
  q4: 0 | 1 | 2 | 3 | 4;  // Инсомния
  q5: 0 | 1 | 2 | 3 | 4;  // Интеллектуальные нарушения
  q6: 0 | 1 | 2 | 3 | 4;  // Депрессивное настроение
  q7: 0 | 1 | 2 | 3 | 4;  // Соматическая — мышечная
  q8: 0 | 1 | 2 | 3 | 4;  // Соматическая — сенсорная
  q9: 0 | 1 | 2 | 3 | 4;  // Сердечно-сосудистые симптомы
  q10: 0 | 1 | 2 | 3 | 4; // Дыхательные симптомы
  q11: 0 | 1 | 2 | 3 | 4; // ЖКТ симптомы
  q12: 0 | 1 | 2 | 3 | 4; // Мочеполовые симптомы
  q13: 0 | 1 | 2 | 3 | 4; // Вегетативные симптомы
  q14: 0 | 1 | 2 | 3 | 4; // Поведение при осмотре
};

export type HAMAResult = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
  psychicSubscale: number;
  somaticSubscale: number;
};

export const hamaItems = [
  { key: "q1", text: "Тревожное настроение (беспокойство, раздражительность, страх, ощущение надвигающегося несчастья)" },
  { key: "q2", text: "Напряжение (чувство усталости, дрожь, плаксивость, невозможность расслабиться)" },
  { key: "q3", text: "Страхи (темноты, незнакомых людей, транспорта, одиночества, животных)" },
  { key: "q4", text: "Инсомния (трудности засыпания, прерывистый сон, ранние пробуждения, кошмары)" },
  { key: "q5", text: "Интеллектуальные нарушения (трудности концентрации, ухудшение памяти)" },
  { key: "q6", text: "Депрессивное настроение (утрата интереса, ангедония)" },
  { key: "q7", text: "Соматические симптомы — мышечные (боли, мышечное напряжение, скрежетание зубами)" },
  { key: "q8", text: "Соматические симптомы — сенсорные (звон в ушах, нечёткость зрения, ощущение жара/холода)" },
  { key: "q9", text: "Сердечно-сосудистые симптомы (тахикардия, учащённый пульс, боль в груди)" },
  { key: "q10", text: "Дыхательные симптомы (давление в груди, одышка, ощущение сдавливания)" },
  { key: "q11", text: "ЖКТ симптомы (затруднённое глотание, тошнота, диарея, спазмы)" },
  { key: "q12", text: "Мочеполовые симптомы (учащённое мочеиспускание, импотенция/менструальные нарушения)" },
  { key: "q13", text: "Вегетативные симптомы (сухость рта, бледность/гиперемия, потливость, головокружение)" },
  { key: "q14", text: "Поведение при осмотре (двигательное возбуждение, дрожь, нахмуренность, напряжённость)" },
];

export const hamaAnswerOptions = [
  { value: 0, label: "0 — нет" },
  { value: 1, label: "1 — лёгкая" },
  { value: 2, label: "2 — умеренная" },
  { value: 3, label: "3 — тяжёлая" },
  { value: 4, label: "4 — очень тяжёлая" },
];

export function calculateHAMA(input: HAMAInput): HAMAResult {
  const score = (Object.values(input) as number[]).reduce((a, b) => a + b, 0);

  // Psychic anxiety subscale: items 1-6
  const psychicSubscale = input.q1 + input.q2 + input.q3 + input.q4 + input.q5 + input.q6;

  // Somatic anxiety subscale: items 7-14
  const somaticSubscale = input.q7 + input.q8 + input.q9 + input.q10 + input.q11 + input.q12 + input.q13 + input.q14;

  if (score <= 13) {
    return { score, severity: "normal", level: "Норма", recommendation: "Наблюдение", psychicSubscale, somaticSubscale };
  } else if (score <= 17) {
    return { score, severity: "warning", level: "Лёгкая тревога", recommendation: "Психотерапия", psychicSubscale, somaticSubscale };
  } else if (score <= 24) {
    return { score, severity: "warning", level: "Умеренная тревога", recommendation: "Психотерапия и/или фармакотерапия", psychicSubscale, somaticSubscale };
  } else if (score <= 30) {
    return { score, severity: "error", level: "Тяжёлая тревога", recommendation: "Активная фармакотерапия", psychicSubscale, somaticSubscale };
  } else {
    return { score, severity: "error", level: "Очень тяжёлая тревога", recommendation: "Интенсивное лечение", psychicSubscale, somaticSubscale };
  }
}
