// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/calvert.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CalvertInput = {
  targetAUC: number; // Target AUC, mg/mL·min
  gfr: number;       // GFR (Cockcroft-Gault), mL/min
};

export type CalvertResult = {
  dose: number;         // mg
  effectiveGFR: number; // GFR used (capped at 125)
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateCalvert(input: CalvertInput): CalvertResult {
  const effectiveGFR = Math.min(input.gfr, 125); // FDA cap
  const dose = input.targetAUC * (effectiveGFR + 25);
  const rounded = Math.round(dose);

  let interpretation: string;
  let severity: "normal" | "warning" | "error" = "normal";

  if (input.gfr > 125) {
    interpretation = "СКФ ограничена до 125 мл/мин (рекомендация FDA). Доза карбоплатина рассчитана.";
    severity = "warning";
  } else if (input.gfr < 15) {
    interpretation = "Тяжёлое нарушение функции почек — необходима коррекция дозы и консультация специалиста";
    severity = "error";
  } else {
    interpretation = "Доза карбоплатина рассчитана по формуле Кальверта";
    severity = "normal";
  }

  return { dose: rounded, effectiveGFR, interpretation, severity };
}
