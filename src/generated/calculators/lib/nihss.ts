// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/nihss.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type NIHSSInput = {
  consciousness: 0 | 1 | 2 | 3;
  consciousnessQuestions: 0 | 1 | 2;
  consciousnessCommands: 0 | 1 | 2;
  gazeParesis: 0 | 1 | 2;
  visual: 0 | 1 | 2 | 3;
  facialParalysis: 0 | 1 | 2 | 3;
  leftArm: 0 | 1 | 2 | 3 | 4;
  rightArm: 0 | 1 | 2 | 3 | 4;
  leftLeg: 0 | 1 | 2 | 3 | 4;
  rightLeg: 0 | 1 | 2 | 3 | 4;
  ataxia: 0 | 1 | 2;
  sensory: 0 | 1 | 2;
  aphasia: 0 | 1 | 2 | 3;
  dysarthria: 0 | 1 | 2;
  extinction: 0 | 1 | 2;
};

export type NIHSSResult = {
  score: number;
  severity: "normal" | "warning" | "error";
  color: string;
  level: string;
  interpretation: string;
};

export function calculateNIHSS(input: NIHSSInput): NIHSSResult {
  const score = (Object.values(input) as number[]).reduce((a, b) => a + b, 0);

  if (score === 0) {
    return {
      score,
      severity: "normal",
      color: "success",
      level: "Нет инсульта",
      interpretation: "Неврологический дефицит отсутствует",
    };
  } else if (score <= 4) {
    return {
      score,
      severity: "normal",
      color: "success",
      level: "Малый инсульт",
      interpretation: "NIHSS 1–4 — незначительный неврологический дефицит",
    };
  } else if (score <= 15) {
    return {
      score,
      severity: "warning",
      color: "warning",
      level: "Умеренный инсульт",
      interpretation: "NIHSS 5–15 — умеренный неврологический дефицит",
    };
  } else if (score <= 20) {
    return {
      score,
      severity: "error",
      color: "error",
      level: "Умеренно-тяжёлый инсульт",
      interpretation: "NIHSS 16–20 — умеренно-тяжёлый дефицит",
    };
  } else {
    return {
      score,
      severity: "error",
      color: "error",
      level: "Тяжёлый инсульт",
      interpretation: "NIHSS 21–42 — тяжёлый неврологический дефицит",
    };
  }
}
