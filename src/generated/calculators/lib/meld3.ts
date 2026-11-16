// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/meld3.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MELD3Input = {
  bilirubin: number; // mg/dL
  creatinine: number; // mg/dL
  inr: number;
  sodium: number;    // mEq/L
  female: boolean;
};

export type MELD3Result = {
  score: number;
  mortality90Day: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateMELD3(input: MELD3Input): MELD3Result {
  // Apply minimums/constraints
  const bili = Math.max(1.0, input.bilirubin);
  const cr = Math.min(4.0, Math.max(1.0, input.creatinine));
  const inr = Math.max(1.0, input.inr);
  const na = Math.min(137, Math.max(125, input.sodium));
  const sexPoints = input.female ? 1.85 : 0;

  const score = 4.56 * Math.log(bili) + 0.82 * (137 - na) - 0.24 * (137 - na) * Math.log(cr) + 9.09 * Math.log(inr) + 11.14 * Math.log(cr) + sexPoints + 7;
  const rounded = Math.round(score);

  let mortality90Day: string;
  let severity: "normal" | "warning" | "error";
  let interpretation: string;

  if (rounded < 10) {
    mortality90Day = "< 2%"; severity = "normal"; interpretation = "Низкий риск смертности";
  } else if (rounded < 20) {
    mortality90Day = "6–20%"; severity = "warning"; interpretation = "Умеренный риск смертности";
  } else if (rounded < 30) {
    mortality90Day = "20–50%"; severity = "error"; interpretation = "Высокий риск смертности";
  } else {
    mortality90Day = "> 50%"; severity = "error"; interpretation = "Очень высокий риск смертности";
  }

  return { score: rounded, mortality90Day, interpretation, severity };
}
