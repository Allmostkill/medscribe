// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/abc_score.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ABCScoreInput = {
  sbpLow: boolean;        // SBP <=90: +1
  hrHigh: boolean;        // HR >=120: +1
  fastPositive: boolean;  // FAST+: +1
  penetrating: boolean;   // Penetrating mechanism: +1
};

export type ABCScoreResult = {
  score: number;
  mtpProbability: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

const probabilityTable: Record<number, string> = {
  0: "1%",
  1: "10%",
  2: "41%",
  3: "48%",
  4: "100%",
};

export function calculateABCScore(input: ABCScoreInput): ABCScoreResult {
  const score = [input.sbpLow, input.hrHigh, input.fastPositive, input.penetrating].filter(Boolean).length;
  const probability = probabilityTable[score] ?? "100%";

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let recommendation: string;

  if (score < 2) {
    interpretation = "Низкая вероятность массивной трансфузии";
    severity = "normal";
    recommendation = "Стандартный мониторинг, резервировать трансфузионные среды";
  } else {
    interpretation = "Высокая вероятность массивной трансфузии (≥ 2)";
    severity = "error";
    recommendation = "Активировать протокол массивной трансфузии (ПМТ)";
  }

  return { score, mtpProbability: probability, interpretation, severity, recommendation };
}

export const abcItems = [
  { key: "sbpLow" as keyof ABCScoreInput, label: "АД ≤ 90 мм рт.ст.", points: "+1" },
  { key: "hrHigh" as keyof ABCScoreInput, label: "ЧСС ≥ 120 уд/мин", points: "+1" },
  { key: "fastPositive" as keyof ABCScoreInput, label: "FAST-ультразвук положительный", points: "+1" },
  { key: "penetrating" as keyof ABCScoreInput, label: "Проникающий механизм травмы", points: "+1" },
];
