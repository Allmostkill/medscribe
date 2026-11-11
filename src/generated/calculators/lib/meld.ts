// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/meld.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MELDInput = {
  creatinine: number; // mg/dL
  bilirubin: number; // mg/dL
  inr: number;
  dialysis: boolean; // dialysis ≥ 2x/week → Cr = 4.0
};

export type MELDResult = {
  score: number;
  mortality90day: string;
  severity: "normal" | "warning" | "error";
  color: string;
  interpretation: string;
};

export function calculateMELD(input: MELDInput): MELDResult {
  let cr = input.dialysis ? 4.0 : Math.min(input.creatinine, 4.0);
  let bili = input.bilirubin;
  let inr = input.inr;

  // Minimum value = 1.0 for each variable
  cr = Math.max(cr, 1.0);
  bili = Math.max(bili, 1.0);
  inr = Math.max(inr, 1.0);

  const meld =
    (0.957 * Math.log(cr) +
      0.378 * Math.log(bili) +
      1.12 * Math.log(inr) +
      0.643) *
    10;

  const score = Math.round(meld);

  let mortality90day: string;
  let severity: "normal" | "warning" | "error";
  let color: string;
  let interpretation: string;

  if (score < 10) {
    mortality90day = "< 2%";
    severity = "normal";
    color = "success";
    interpretation = "Низкий риск — трансплантация обычно не срочная";
  } else if (score < 20) {
    mortality90day = "6–20%";
    severity = "warning";
    color = "warning";
    interpretation = "Умеренный риск";
  } else if (score < 30) {
    mortality90day = "20–50%";
    severity = "error";
    color = "error";
    interpretation = "Высокий риск — приоритетное рассмотрение трансплантации";
  } else {
    mortality90day = "> 50%";
    severity = "error";
    color = "error";
    interpretation = "Очень высокий риск — критическая необходимость трансплантации";
  }

  return { score, mortality90day, severity, color, interpretation };
}
