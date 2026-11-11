// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/eag_hba1c.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type EAGHbA1cInput = {
  hba1c: number; // %
};

export type EAGHbA1cResult = {
  eagMgDl: number;
  eagMmolL: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  target: string;
};

export function calculateEAGHbA1c(input: EAGHbA1cInput): EAGHbA1cResult {
  const { hba1c } = input;
  const eagMgDl = Math.round(28.7 * hba1c - 46.7);
  const eagMmolL = Math.round((1.594 * hba1c - 2.594) * 10) / 10;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let target: string;

  if (hba1c < 5.7) {
    interpretation = "Норма (< 5.7%)";
    severity = "normal";
    target = "Норма";
  } else if (hba1c < 6.5) {
    interpretation = "Предиабет (5.7–6.4%)";
    severity = "warning";
    target = "Рекомендуется изменение образа жизни";
  } else if (hba1c < 7.0) {
    interpretation = "Хорошо компенсированный СД (< 7.0%)";
    severity = "normal";
    target = "Целевой уровень для большинства пациентов с СД";
  } else if (hba1c < 8.0) {
    interpretation = "Недостаточный контроль (7.0–7.9%)";
    severity = "warning";
    target = "Пересмотр терапии";
  } else {
    interpretation = "Плохой контроль (≥ 8.0%)";
    severity = "error";
    target = "Необходима интенсификация лечения";
  }

  return { eagMgDl, eagMmolL, interpretation, severity, target };
}
