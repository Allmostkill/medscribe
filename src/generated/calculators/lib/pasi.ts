// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/pasi.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PASIRegionInput = {
  erythema: 0 | 1 | 2 | 3 | 4;
  induration: 0 | 1 | 2 | 3 | 4;
  desquamation: 0 | 1 | 2 | 3 | 4;
  area: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

export type PASIInput = {
  head: PASIRegionInput;
  upperLimbs: PASIRegionInput;
  trunk: PASIRegionInput;
  lowerLimbs: PASIRegionInput;
};

export type PASIResult = {
  score: number;
  severity: "normal" | "warning" | "error";
  interpretation: string;
  category: string;
};

function regionScore(r: PASIRegionInput, weight: number): number {
  return weight * (r.erythema + r.induration + r.desquamation) * r.area;
}

export function calculatePASI(input: PASIInput): PASIResult {
  const score = regionScore(input.head, 0.1) + regionScore(input.upperLimbs, 0.2) + regionScore(input.trunk, 0.3) + regionScore(input.lowerLimbs, 0.4);
  const rounded = Math.round(score * 10) / 10;

  let severity: "normal" | "warning" | "error";
  let interpretation: string;
  let category: string;

  if (rounded === 0) {
    interpretation = "Очищение"; category = "PASI 0"; severity = "normal";
  } else if (rounded <= 5) {
    interpretation = "Лёгкий псориаз (PASI 1–5)"; category = "Лёгкий"; severity = "normal";
  } else if (rounded <= 10) {
    interpretation = "Умеренный псориаз (PASI 6–10)"; category = "Умеренный"; severity = "warning";
  } else {
    interpretation = "Тяжёлый псориаз (PASI > 10)"; category = "Тяжёлый"; severity = "error";
  }

  return { score: rounded, severity, interpretation, category };
}

export const pasiAreaOptions = [
  { value: 0 as const, label: "0 — 0%" },
  { value: 1 as const, label: "1 — < 10%" },
  { value: 2 as const, label: "2 — 10–29%" },
  { value: 3 as const, label: "3 — 30–49%" },
  { value: 4 as const, label: "4 — 50–69%" },
  { value: 5 as const, label: "5 — 70–89%" },
  { value: 6 as const, label: "6 — 90–100%" },
];

export const pasiSeverityOptions = [
  { value: 0 as const, label: "0 — Нет" },
  { value: 1 as const, label: "1 — Лёгкая" },
  { value: 2 as const, label: "2 — Умеренная" },
  { value: 3 as const, label: "3 — Тяжёлая" },
  { value: 4 as const, label: "4 — Очень тяжёлая" },
];
