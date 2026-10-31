// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ldl_friedewald.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type LDLFriedewaldInput = {
  totalChol: number;
  hdl: number;
  tg: number;
  unit: "mg_dl" | "mmol_l";
};

export type LDLFriedewaldResult = {
  ldl: number;
  unit: string;
  valid: boolean;
  invalidReason?: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateLDLFriedewald(input: LDLFriedewaldInput): LDLFriedewaldResult {
  const { totalChol, hdl, tg, unit } = input;

  const displayUnit = unit === "mg_dl" ? "мг/дл" : "ммоль/л";
  const tgLimit = unit === "mg_dl" ? 400 : 4.52;

  if (tg > tgLimit) {
    return {
      ldl: 0,
      unit: displayUnit,
      valid: false,
      invalidReason: `TG > ${tgLimit} ${displayUnit} — формула Фридвальда недействительна`,
      interpretation: "Невозможно рассчитать",
      severity: "warning",
      color: "warning",
    };
  }

  const divisor = unit === "mg_dl" ? 5 : 2.2;
  const ldl = totalChol - hdl - tg / divisor;
  const rounded = Math.round(ldl * 100) / 100;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let color: string;

  if (unit === "mg_dl") {
    if (ldl < 100) {
      interpretation = "Оптимальный (< 100 мг/дл)";
      severity = "normal";
      color = "success";
    } else if (ldl < 130) {
      interpretation = "Близко к оптимальному (100–129 мг/дл)";
      severity = "normal";
      color = "success";
    } else if (ldl < 160) {
      interpretation = "Погранично высокий (130–159 мг/дл)";
      severity = "warning";
      color = "warning";
    } else if (ldl < 190) {
      interpretation = "Высокий (160–189 мг/дл)";
      severity = "error";
      color = "error";
    } else {
      interpretation = "Очень высокий (≥ 190 мг/дл)";
      severity = "error";
      color = "error";
    }
  } else {
    if (ldl < 2.6) {
      interpretation = "Оптимальный (< 2.6 ммоль/л)";
      severity = "normal";
      color = "success";
    } else if (ldl < 3.4) {
      interpretation = "Близко к оптимальному";
      severity = "normal";
      color = "success";
    } else if (ldl < 4.1) {
      interpretation = "Погранично высокий";
      severity = "warning";
      color = "warning";
    } else if (ldl < 4.9) {
      interpretation = "Высокий";
      severity = "error";
      color = "error";
    } else {
      interpretation = "Очень высокий (≥ 4.9 ммоль/л)";
      severity = "error";
      color = "error";
    }
  }

  return { ldl: rounded, unit: displayUnit, valid: true, interpretation, severity, color };
}
