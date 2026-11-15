// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/qtc.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type QTcInput = {
  qt: number; // ms
  hr: number; // bpm
  sex: "male" | "female";
};

export type QTcResult = {
  qtc: number;
  rr: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateQTc(input: QTcInput): QTcResult {
  const rr = 60000 / input.hr; // ms
  const qtc = input.qt / Math.sqrt(rr / 1000);
  const rounded = Math.round(qtc);

  const normalLimit = input.sex === "male" ? 440 : 460;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let color: string;

  if (qtc < normalLimit) {
    interpretation = "Норма";
    severity = "normal";
    color = "success";
  } else if (qtc < 500) {
    interpretation = `Пограничное удлинение QTc (норма <${normalLimit} мс)`;
    severity = "warning";
    color = "warning";
  } else {
    interpretation = "Значительное удлинение QTc — высокий риск torsades de pointes";
    severity = "error";
    color = "error";
  }

  return {
    qtc: rounded,
    rr: Math.round(rr),
    interpretation,
    severity,
    color,
  };
}
