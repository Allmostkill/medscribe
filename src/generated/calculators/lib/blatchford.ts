// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/blatchford.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type BlatchfordInput = {
  bun: number;       // mmol/L
  hgb: number;       // g/dL
  female: boolean;
  sbp: number;       // mmHg
  hr100plus: boolean;
  melena: boolean;
  syncope: boolean;
  liverDisease: boolean;
  heartFailure: boolean;
};

export type BlatchfordResult = {
  score: number;
  risk: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

function bunPoints(bun: number): number {
  if (bun < 6.5) return 0;
  if (bun < 8.0) return 2;
  if (bun < 10.0) return 3;
  if (bun < 25.0) return 4;
  return 6;
}

function hgbPointsMale(hgb: number): number {
  if (hgb >= 13) return 0;
  if (hgb >= 12) return 1;
  if (hgb >= 10) return 3;
  return 6;
}

function hgbPointsFemale(hgb: number): number {
  if (hgb >= 12) return 0;
  if (hgb >= 10) return 1;
  return 6;
}

function sbpPoints(sbp: number): number {
  if (sbp >= 110) return 0;
  if (sbp >= 100) return 1;
  if (sbp >= 90) return 2;
  return 3;
}

export function calculateBlatchford(input: BlatchfordInput): BlatchfordResult {
  let score = 0;
  score += bunPoints(input.bun);
  score += input.female ? hgbPointsFemale(input.hgb) : hgbPointsMale(input.hgb);
  score += sbpPoints(input.sbp);
  if (input.hr100plus) score += 1;
  if (input.melena) score += 1;
  if (input.syncope) score += 2;
  if (input.liverDisease) score += 2;
  if (input.heartFailure) score += 2;

  if (score === 0) {
    return {
      score,
      risk: "Очень низкий риск",
      recommendation: "Score 0 — возможно амбулаторное ведение без экстренной эндоскопии",
      severity: "normal",
    };
  } else if (score < 6) {
    return {
      score,
      risk: "Низкий–умеренный риск",
      recommendation: "Госпитализация, эндоскопия в ближайшие 24 часа",
      severity: "warning",
    };
  } else {
    return {
      score,
      risk: "Высокий риск",
      recommendation: "Score ≥6 — высокий риск потребности в вмешательстве, срочная эндоскопия",
      severity: "error",
    };
  }
}
