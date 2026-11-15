// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/anc.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ANCInput = {
  wbc: number;         // WBC, ×10³/μL
  neutrophils: number; // % neutrophils (segmented)
  bands: number;       // % bands
};

export type ANCResult = {
  anc: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  category: string;
};

export function calculateANC(input: ANCInput): ANCResult {
  const anc = input.wbc * (input.neutrophils + input.bands) / 100;
  const rounded = Math.round(anc * 10) / 10;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let category: string;

  if (rounded >= 2000) {
    interpretation = "Норма";
    severity = "normal";
    category = "Нормальное количество нейтрофилов";
  } else if (rounded >= 1000) {
    interpretation = "Лёгкая нейтропения";
    severity = "warning";
    category = "ANC 1000–1999 /мкл";
  } else if (rounded >= 500) {
    interpretation = "Умеренная нейтропения";
    severity = "error";
    category = "ANC 500–999 /мкл";
  } else if (rounded >= 100) {
    interpretation = "Тяжёлая нейтропения";
    severity = "error";
    category = "ANC < 500 /мкл — высокий риск инфекций";
  } else {
    interpretation = "Агранулоцитоз";
    severity = "error";
    category = "ANC < 100 /мкл — критический";
  }

  return { anc: rounded, interpretation, severity, category };
}
