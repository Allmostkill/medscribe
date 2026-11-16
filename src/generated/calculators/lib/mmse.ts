// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/mmse.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MMSEInput = {
  orientationTime: number;   // 0-5
  orientationPlace: number;  // 0-5
  registration: number;      // 0-3
  attention: number;         // 0-5
  recall: number;            // 0-3
  language: number;          // 0-9
};

export type MMSEResult = {
  score: number;
  interpretation: string;
  category: string;
  severity: "normal" | "warning" | "error";
};

export function calculateMMSE(input: MMSEInput): MMSEResult {
  const score = input.orientationTime + input.orientationPlace + input.registration + input.attention + input.recall + input.language;

  let interpretation: string;
  let category: string;
  let severity: "normal" | "warning" | "error";

  if (score >= 27) {
    interpretation = "Норма (27–30)";
    category = "Когнитивные нарушения не выявлены";
    severity = "normal";
  } else if (score >= 24) {
    interpretation = "Возможные нарушения (24–26)";
    category = "Лёгкие когнитивные нарушения";
    severity = "warning";
  } else if (score >= 18) {
    interpretation = "Лёгкая/умеренная деменция (18–23)";
    category = "Умеренные когнитивные нарушения";
    severity = "error";
  } else if (score >= 10) {
    interpretation = "Умеренная деменция (10–17)";
    category = "Выраженные когнитивные нарушения";
    severity = "error";
  } else {
    interpretation = "Тяжёлая деменция (< 10)";
    category = "Тяжёлые когнитивные нарушения";
    severity = "error";
  }

  return { score, interpretation, category, severity };
}

export const mmseFields = [
  { key: "orientationTime" as keyof MMSEInput, label: "Ориентация во времени", max: 5, description: "Год, сезон, месяц, дата, день недели" },
  { key: "orientationPlace" as keyof MMSEInput, label: "Ориентация в месте", max: 5, description: "Страна, регион, город, больница, этаж" },
  { key: "registration" as keyof MMSEInput, label: "Запоминание", max: 3, description: "Повторение 3 слов" },
  { key: "attention" as keyof MMSEInput, label: "Внимание и счёт", max: 5, description: "Серийный счёт (100−7) или слово ЗЕМЛЯ в обратном порядке" },
  { key: "recall" as keyof MMSEInput, label: "Воспроизведение", max: 3, description: "Вспомнить 3 слова" },
  { key: "language" as keyof MMSEInput, label: "Речь", max: 9, description: "Называние, повторение, команды, чтение, письмо, рисование" },
];
