// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/fena.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type FENaInput = {
  uNa: number; // urine Na, mEq/L
  pCr: number; // plasma creatinine, mg/dL
  pNa: number; // plasma Na, mEq/L
  uCr: number; // urine creatinine, mg/dL
};

export type FENaResult = {
  fena: number; // %
  interpretation: string;
  cause: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateFENa(input: FENaInput): FENaResult {
  const { uNa, pCr, pNa, uCr } = input;
  const fena = (uNa * pCr) / (pNa * uCr) * 100;
  const rounded = Math.round(fena * 100) / 100;

  if (fena < 1) {
    return {
      fena: rounded,
      interpretation: "Преренальная азотемия",
      cause: "FENa < 1% — почки активно удерживают натрий",
      severity: "warning",
      color: "warning",
    };
  } else if (fena > 2) {
    return {
      fena: rounded,
      interpretation: "Ренальная азотемия (ОКН)",
      cause: "FENa > 2% — поражение канальцев",
      severity: "error",
      color: "error",
    };
  } else {
    return {
      fena: rounded,
      interpretation: "Неопределённая зона",
      cause: "FENa 1–2% — может быть как преренальным, так и ренальным",
      severity: "warning",
      color: "warning",
    };
  }
}
