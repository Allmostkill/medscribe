// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/serum_osm.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type SerumOsmInput = {
  na: number; // mEq/L
  glucose: number; // mg/dL
  bun: number; // mg/dL
  measured?: number; // measured osmolality, mOsm/kg (optional)
};

export type SerumOsmResult = {
  calculated: number; // mOsm/kg
  osmolalGap?: number;
  interpretation: string;
  gapInterpretation?: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateSerumOsm(input: SerumOsmInput): SerumOsmResult {
  const { na, glucose, bun, measured } = input;

  const calculated = 2 * na + glucose / 18 + bun / 2.8;
  const rounded = Math.round(calculated * 10) / 10;

  let osmolalGap: number | undefined;
  let gapInterpretation: string | undefined;

  if (measured !== undefined) {
    osmolalGap = Math.round((measured - calculated) * 10) / 10;
    if (osmolalGap > 10) {
      gapInterpretation =
        "Осмолярный разрыв > 10 — возможны экзогенные осмоли (этанол, метанол, этиленгликоль, ацетон)";
    } else {
      gapInterpretation = "Осмолярный разрыв в норме (≤ 10)";
    }
  }

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let color: string;

  if (calculated < 275) {
    interpretation = "Гипоосмоляльность (< 275 мОсм/кг)";
    severity = "warning";
    color = "warning";
  } else if (calculated <= 295) {
    interpretation = "Норма (275–295 мОсм/кг)";
    severity = "normal";
    color = "success";
  } else if (calculated <= 320) {
    interpretation = "Умеренная гиперосмоляльность";
    severity = "warning";
    color = "warning";
  } else {
    interpretation = "Выраженная гиперосмоляльность (> 320 мОсм/кг)";
    severity = "error";
    color = "error";
  }

  return { calculated: rounded, osmolalGap, interpretation, gapInterpretation, severity, color };
}
