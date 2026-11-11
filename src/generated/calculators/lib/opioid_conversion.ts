// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/opioid_conversion.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type OpioidConversionInput = {
  drug: string;
  dose: number;
  route: "oral" | "iv";
};

export type OpioidConversionResult = {
  morphineEquivalent: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

// Morphine Milligram Equivalents (MME) conversion factors (to oral morphine mg)
export const opioidTable = [
  { drug: "morphine_oral", name: "Морфин (пероральный)", oralFactor: 1, ivFactor: 3 },
  { drug: "morphine_iv", name: "Морфин (в/в)", oralFactor: 3, ivFactor: 3 },
  { drug: "codeine", name: "Кодеин (пероральный)", oralFactor: 0.15, ivFactor: null },
  { drug: "tramadol", name: "Трамадол (пероральный)", oralFactor: 0.1, ivFactor: 0.1 },
  { drug: "oxycodone", name: "Оксикодон (пероральный)", oralFactor: 1.5, ivFactor: null },
  { drug: "hydromorphone_iv", name: "Гидроморфон (в/в)", oralFactor: 20, ivFactor: 20 },
  { drug: "fentanyl_iv", name: "Фентанил (в/в, мкг/ч → мг/сут)", oralFactor: 100, ivFactor: 100 },
  { drug: "buprenorphine_sl", name: "Бупренорфин (сублингв., мкг)", oralFactor: 0.075, ivFactor: null },
];

export function calculateOpioidConversion(input: OpioidConversionInput): OpioidConversionResult {
  const entry = opioidTable.find((o) => o.drug === input.drug);
  if (!entry) {
    return {
      morphineEquivalent: 0,
      interpretation: "Препарат не найден",
      severity: "warning",
    };
  }

  const factor = input.route === "iv" && entry.ivFactor !== null ? entry.ivFactor : entry.oralFactor;
  const mme = input.dose * factor;
  const rounded = Math.round(mme * 10) / 10;

  let severity: "normal" | "warning" | "error" = "normal";
  let interpretation = `${rounded} мг МЭ/сут (морфиновый эквивалент)`;

  if (rounded > 90) {
    severity = "error";
    interpretation += " — Высокая доза: повышенный риск передозировки";
  } else if (rounded > 50) {
    severity = "warning";
    interpretation += " — Умеренно высокая доза";
  }

  return { morphineEquivalent: rounded, interpretation, severity };
}
