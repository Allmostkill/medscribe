// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ich_score.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ICHScoreInput = {
  gcs: 0 | 1 | 2;         // GCS: 13-15=0, 5-12=1, 3-4=2
  volume30: boolean;       // Hematoma volume >=30 mL: +1
  ivh: boolean;            // Intraventricular extension: +1
  infratentorial: boolean; // Infratentorial origin: +1
  age80: boolean;          // Age >=80: +1
};

export type ICHScoreResult = {
  score: number;
  mortality: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

const mortalityTable: Record<number, string> = {
  0: "0%",
  1: "13%",
  2: "26%",
  3: "72%",
  4: "97%",
  5: "100%",
  6: "100%",
};

export function calculateICHScore(input: ICHScoreInput): ICHScoreResult {
  const score = input.gcs + (input.volume30 ? 1 : 0) + (input.ivh ? 1 : 0) + (input.infratentorial ? 1 : 0) + (input.age80 ? 1 : 0);
  const mortality = mortalityTable[score] ?? "100%";

  let severity: "normal" | "warning" | "error";
  let interpretation: string;
  if (score <= 1) {
    severity = "normal";
    interpretation = "Низкий риск 30-дневной смертности";
  } else if (score <= 2) {
    severity = "warning";
    interpretation = "Умеренный риск 30-дневной смертности";
  } else {
    severity = "error";
    interpretation = "Высокий риск 30-дневной смертности";
  }

  return { score, mortality, interpretation, severity };
}

export const ichGcsOptions = [
  { value: 0 as const, label: "ШКГ 13–15" },
  { value: 1 as const, label: "ШКГ 5–12" },
  { value: 2 as const, label: "ШКГ 3–4" },
];
