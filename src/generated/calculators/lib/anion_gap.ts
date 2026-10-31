// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/anion_gap.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type AnionGapInput = {
  na: number; // mEq/L
  cl: number; // mEq/L
  hco3: number; // mEq/L
  albumin?: number; // g/dL, optional for correction
};

export type AnionGapResult = {
  ag: number;
  correctedAg?: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
  hasAlbuminCorrection: boolean;
};

export function calculateAnionGap(input: AnionGapInput): AnionGapResult {
  const { na, cl, hco3, albumin } = input;
  const ag = na - (cl + hco3);
  const roundedAg = Math.round(ag * 10) / 10;

  let correctedAg: number | undefined;
  let hasAlbuminCorrection = false;

  if (albumin !== undefined && albumin > 0) {
    correctedAg = ag + 2.5 * (4.0 - albumin);
    correctedAg = Math.round(correctedAg * 10) / 10;
    hasAlbuminCorrection = true;
  }

  const agToInterpret = correctedAg ?? roundedAg;

  if (agToInterpret > 12) {
    return {
      ag: roundedAg,
      correctedAg,
      interpretation: "Высокий анионный промежуток (HAGMA)",
      severity: "error",
      color: "error",
      hasAlbuminCorrection,
    };
  } else {
    return {
      ag: roundedAg,
      correctedAg,
      interpretation: "Нормальный анионный промежуток (NAGMA)",
      severity: "normal",
      color: "success",
      hasAlbuminCorrection,
    };
  }
}
