// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/fick_co.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type FickCOInput = {
  sao2: number;    // Arterial O2 saturation, %
  svo2: number;    // Mixed venous O2 sat, %
  hgb: number;     // Hemoglobin, g/dL
  bsa: number;     // Body surface area, m²
  vo2measured: number | null; // If measured VO2 (mL/min), otherwise estimated
};

export type FickCOResult = {
  vo2: number;    // mL/min
  co: number;     // L/min
  ci: number;     // L/min/m²
  interpretation: string;
  ciInterpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateFickCO(input: FickCOInput): FickCOResult {
  const { sao2, svo2, hgb, bsa, vo2measured } = input;
  const vo2 = vo2measured !== null ? vo2measured : 125 * bsa;
  const avdo2 = (sao2 - svo2) / 100 * hgb * 1.36 * 10;
  const co = vo2 / avdo2;
  const ci = co / bsa;

  const coRounded = Math.round(co * 100) / 100;
  const ciRounded = Math.round(ci * 100) / 100;
  const vo2Rounded = Math.round(vo2);

  let severity: "normal" | "warning" | "error";
  let ciInterpretation: string;
  let interpretation: string;

  if (ci >= 2.5 && ci <= 4.0) {
    severity = "normal";
    ciInterpretation = "Нормальный сердечный индекс (2.5–4.0 л/мин/м²)";
    interpretation = "Нормальная сердечная функция";
  } else if (ci >= 2.2) {
    severity = "warning";
    ciInterpretation = "Пограничный сердечный индекс";
    interpretation = "Незначительное снижение сердечного выброса";
  } else {
    severity = "error";
    ciInterpretation = "Сниженный сердечный индекс (< 2.2)";
    interpretation = "Низкий сердечный выброс — кардиогенный шок возможен";
  }

  return { vo2: vo2Rounded, co: coRounded, ci: ciRounded, interpretation, ciInterpretation, severity };
}
