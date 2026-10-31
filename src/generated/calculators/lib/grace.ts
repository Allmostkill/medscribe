// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/grace.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type GRACEInput = {
  age: number;         // years
  heartRate: number;   // bpm
  sbp: number;         // mmHg
  creatinine: number;  // mg/dL
  killip: 1 | 2 | 3 | 4;
  cardiacArrest: boolean;
  stDeviation: boolean;
  elevatedEnzymes: boolean;
};

export type GRACEResult = {
  score: number;
  mortalityCategory: string;
  mortalityRange: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

function agePoints(age: number): number {
  if (age <= 35) return 0;
  if (age <= 45) return 8;
  if (age <= 55) return 25;
  if (age <= 65) return 41;
  if (age <= 75) return 58;
  if (age <= 85) return 75;
  return 91;
}

function hrPoints(hr: number): number {
  if (hr < 50) return 0;
  if (hr <= 69) return 3;
  if (hr <= 89) return 9;
  if (hr <= 109) return 15;
  if (hr <= 149) return 24;
  if (hr <= 199) return 38;
  return 46;
}

function sbpPoints(sbp: number): number {
  if (sbp < 80) return 58;
  if (sbp <= 99) return 53;
  if (sbp <= 119) return 43;
  if (sbp <= 139) return 34;
  if (sbp <= 159) return 24;
  if (sbp <= 199) return 10;
  return 0;
}

function creatininePoints(cr: number): number {
  if (cr < 0.4) return 1;
  if (cr < 0.8) return 3;
  if (cr < 1.2) return 5;
  if (cr < 1.6) return 7;
  if (cr < 2.0) return 9;
  if (cr < 4.0) return 15;
  return 20;
}

function killipPoints(killip: number): number {
  if (killip === 1) return 0;
  if (killip === 2) return 20;
  if (killip === 3) return 39;
  return 59;
}

export function calculateGRACE(input: GRACEInput): GRACEResult {
  let score = 0;
  score += agePoints(input.age);
  score += hrPoints(input.heartRate);
  score += sbpPoints(input.sbp);
  score += creatininePoints(input.creatinine);
  score += killipPoints(input.killip);
  if (input.cardiacArrest) score += 39;
  if (input.stDeviation) score += 28;
  if (input.elevatedEnzymes) score += 14;

  if (score < 109) {
    return {
      score,
      mortalityCategory: "Низкий риск",
      mortalityRange: "<1%",
      recommendation: "Низкая госпитальная смертность — консервативная тактика возможна",
      severity: "normal",
    };
  } else if (score <= 140) {
    return {
      score,
      mortalityCategory: "Умеренный риск",
      mortalityRange: "1–3%",
      recommendation: "Умеренный риск — ранняя стратификация, рассмотреть инвазивную тактику",
      severity: "warning",
    };
  } else {
    return {
      score,
      mortalityCategory: "Высокий риск",
      mortalityRange: ">3%",
      recommendation: "Высокий риск госпитальной смертности — ранняя инвазивная стратегия",
      severity: "error",
    };
  }
}
