// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/moca.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MoCAInput = {
  visuospatial: number;  // 0-5
  naming: number;        // 0-3
  attention: number;     // 0-6
  language: number;      // 0-3
  abstraction: number;   // 0-2
  delayedRecall: number; // 0-5
  orientation: number;   // 0-6
  lowEducation: boolean; // <=12 years education: +1 (max 30)
};

export type MoCAResult = {
  score: number;
  adjustedScore: number;
  interpretation: string;
  category: string;
  severity: "normal" | "warning" | "error";
};

export function calculateMoCA(input: MoCAInput): MoCAResult {
  const rawScore = input.visuospatial + input.naming + input.attention + input.language + input.abstraction + input.delayedRecall + input.orientation;
  const adjustedScore = Math.min(30, rawScore + (input.lowEducation ? 1 : 0));

  let interpretation: string;
  let category: string;
  let severity: "normal" | "warning" | "error";

  if (adjustedScore >= 26) {
    interpretation = "Норма (≥ 26)";
    category = "Когнитивные нарушения не выявлены";
    severity = "normal";
  } else if (adjustedScore >= 18) {
    interpretation = "Лёгкие когнитивные нарушения (18–25)";
    category = "МКН";
    severity = "warning";
  } else if (adjustedScore >= 10) {
    interpretation = "Умеренная деменция (10–17)";
    category = "Умеренная деменция";
    severity = "error";
  } else {
    interpretation = "Тяжёлая деменция (< 10)";
    category = "Тяжёлая деменция";
    severity = "error";
  }

  return { score: rawScore, adjustedScore, interpretation, category, severity };
}

export const mocaFields = [
  { key: "visuospatial" as keyof MoCAInput, label: "Зрительно-пространственная / исполнительная функция", max: 5, description: "Тест связи, рисование куба, часы" },
  { key: "naming" as keyof MoCAInput, label: "Называние", max: 3, description: "Назвать 3 животных" },
  { key: "attention" as keyof MoCAInput, label: "Внимание", max: 6, description: "Цифровой охват, бдительность, серийный счёт −7" },
  { key: "language" as keyof MoCAInput, label: "Речь", max: 3, description: "Повторение фраз, беглость речи" },
  { key: "abstraction" as keyof MoCAInput, label: "Абстракция", max: 2, description: "Сходство понятий" },
  { key: "delayedRecall" as keyof MoCAInput, label: "Отсроченное воспроизведение", max: 5, description: "Вспомнить 5 слов через 5 мин" },
  { key: "orientation" as keyof MoCAInput, label: "Ориентация", max: 6, description: "Дата, месяц, год, день, место, город" },
];
