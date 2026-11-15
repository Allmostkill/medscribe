// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ymrs.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

// YMRS: Items 1-4,6 scored 0-4; Items 5,7-11 scored 0-8
export type YMRSInput = {
  elevatedMood: 0 | 1 | 2 | 3 | 4;
  motorActivity: 0 | 1 | 2 | 3 | 4;
  sexualInterest: 0 | 1 | 2 | 3 | 4;
  sleep: 0 | 1 | 2 | 3 | 4;
  irritability: 0 | 2 | 4 | 6 | 8;   // doubled weight
  speechRate: 0 | 1 | 2 | 3 | 4;
  languageThought: 0 | 2 | 4 | 6 | 8; // doubled weight
  thoughtContent: 0 | 2 | 4 | 6 | 8;  // doubled weight
  disruptive: 0 | 2 | 4 | 6 | 8;      // doubled weight
  appearance: 0 | 2 | 4 | 6 | 8;      // doubled weight
  insight: 0 | 2 | 4 | 6 | 8;         // doubled weight
};

export type YMRSResult = {
  score: number;
  level: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateYMRS(input: YMRSInput): YMRSResult {
  const score = input.elevatedMood + input.motorActivity + input.sexualInterest + input.sleep + input.irritability + input.speechRate + input.languageThought + input.thoughtContent + input.disruptive + input.appearance + input.insight;

  let level: string;
  let interpretation: string;
  let severity: "normal" | "warning" | "error";

  if (score <= 12) {
    level = "Нет мании / Ремиссия";
    interpretation = "Нет клинически значимых маниакальных симптомов";
    severity = "normal";
  } else if (score <= 19) {
    level = "Лёгкая мания";
    interpretation = "Лёгкая маниакальная симптоматика";
    severity = "warning";
  } else if (score <= 25) {
    level = "Умеренная мания";
    interpretation = "Умеренная маниакальная симптоматика";
    severity = "warning";
  } else if (score <= 37) {
    level = "Умеренно-тяжёлая мания";
    interpretation = "Умеренно-тяжёлая маниакальная симптоматика";
    severity = "error";
  } else {
    level = "Тяжёлая мания";
    interpretation = "Тяжёлая маниакальная симптоматика";
    severity = "error";
  }

  return { score, level, interpretation, severity };
}

export const ymrsItems = [
  { key: "elevatedMood" as keyof YMRSInput, label: "1. Повышенное настроение", options: [
    { value: 0 as const, label: "0 — Нет" }, { value: 1 as const, label: "1 — Слабо повышено" },
    { value: 2 as const, label: "2 — Субъективно повышено" }, { value: 3 as const, label: "3 — Приподнято, не соответствует ситуации" },
    { value: 4 as const, label: "4 — Эйфория, смех, нецелесообразно" },
  ]},
  { key: "motorActivity" as keyof YMRSInput, label: "2. Двигательная активность", options: [
    { value: 0 as const, label: "0 — Нет" }, { value: 1 as const, label: "1 — Слегка повышена" },
    { value: 2 as const, label: "2 — Оживлён" }, { value: 3 as const, label: "3 — Гиперактивен" },
    { value: 4 as const, label: "4 — Постоянно двигается" },
  ]},
  { key: "sexualInterest" as keyof YMRSInput, label: "3. Сексуальный интерес", options: [
    { value: 0 as const, label: "0 — Норма" }, { value: 1 as const, label: "1 — Слабо повышен" },
    { value: 2 as const, label: "2 — Умеренно повышен" }, { value: 3 as const, label: "3 — Явно повышен" },
    { value: 4 as const, label: "4 — Откровенно сексуальное поведение" },
  ]},
  { key: "sleep" as keyof YMRSInput, label: "4. Сон (уменьшение потребности)", options: [
    { value: 0 as const, label: "0 — Не снижена" }, { value: 1 as const, label: "1 — Сокращён на ≤ 1 ч" },
    { value: 2 as const, label: "2 — Сокращён на > 1 ч" }, { value: 3 as const, label: "3 — Сокращён на > 3 ч" },
    { value: 4 as const, label: "4 — Нет сна" },
  ]},
  { key: "irritability" as keyof YMRSInput, label: "5. Раздражительность (×2)", options: [
    { value: 0 as const, label: "0 — Нет" }, { value: 2 as const, label: "2 — Периодически" },
    { value: 4 as const, label: "4 — Часто раздражителен" }, { value: 6 as const, label: "6 — Агрессивен" },
    { value: 8 as const, label: "8 — Нападает, невозможно провести беседу" },
  ]},
  { key: "speechRate" as keyof YMRSInput, label: "6. Темп речи", options: [
    { value: 0 as const, label: "0 — Норма" }, { value: 1 as const, label: "1 — Слегка ускорена" },
    { value: 2 as const, label: "2 — Ускорена, логоррея" }, { value: 3 as const, label: "3 — Трудно перебить" },
    { value: 4 as const, label: "4 — Невозможно перебить" },
  ]},
  { key: "languageThought" as keyof YMRSInput, label: "7. Речь и мышление (×2)", options: [
    { value: 0 as const, label: "0 — Норма" }, { value: 2 as const, label: "2 — Слабое отвлечение" },
    { value: 4 as const, label: "4 — Скачка идей" }, { value: 6 as const, label: "6 — Непоследовательность" },
    { value: 8 as const, label: "8 — Бессвязность" },
  ]},
  { key: "thoughtContent" as keyof YMRSInput, label: "8. Содержание мышления (×2)", options: [
    { value: 0 as const, label: "0 — Норма" }, { value: 2 as const, label: "2 — Слабые идеи величия" },
    { value: 4 as const, label: "4 — Грандиозные идеи" }, { value: 6 as const, label: "6 — Параноидные идеи" },
    { value: 8 as const, label: "8 — Бред" },
  ]},
  { key: "disruptive" as keyof YMRSInput, label: "9. Дезорганизованное поведение (×2)", options: [
    { value: 0 as const, label: "0 — Нет" }, { value: 2 as const, label: "2 — Шумное поведение" },
    { value: 4 as const, label: "4 — Требует ограничений" }, { value: 6 as const, label: "6 — Угрозы, требует сдерживания" },
    { value: 8 as const, label: "8 — Жестокое поведение" },
  ]},
  { key: "appearance" as keyof YMRSInput, label: "10. Внешний вид (×2)", options: [
    { value: 0 as const, label: "0 — Соответствующий ситуации" }, { value: 2 as const, label: "2 — Несколько небрежен" },
    { value: 4 as const, label: "4 — Неряшлив, яркая одежда" }, { value: 6 as const, label: "6 — Нарушен туалет" },
    { value: 8 as const, label: "8 — Полностью нарушен туалет" },
  ]},
  { key: "insight" as keyof YMRSInput, label: "11. Критика к болезни (×2)", options: [
    { value: 0 as const, label: "0 — Полная критика" }, { value: 2 as const, label: "2 — Снижена" },
    { value: 4 as const, label: "4 — Признаёт гиперактивность, отрицает болезнь" }, { value: 6 as const, label: "6 — Отрицает любые изменения" },
    { value: 8 as const, label: "8 — Полностью отрицает болезнь" },
  ]},
];
