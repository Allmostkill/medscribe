// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/caprini.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CapriniInput = {
  // 1-point factors
  age4160: boolean;
  minorSurgery: boolean;
  bmi25plus: boolean;
  swollenLegs: boolean;
  varicoseVeins: boolean;
  pregnantPostpartum: boolean;
  unexplainedFetalLoss: boolean;
  oralContraceptives: boolean;
  bedrestUnder72h: boolean;
  plasterCastMinor: boolean;
  centralVenousAccess: boolean;
  // 2-point factors
  age6174: boolean;
  arthroscopicSurgery: boolean;
  malignancy: boolean;
  confinedBed72hPlus: boolean;
  historyDvtPe2: boolean; // 2-point version
  // 3-point factors
  age75plus: boolean;
  historyDvtPe3: boolean; // 3-point (same criteria as 2pt in some versions — use only once)
  familyHistoryThrombosis: boolean;
  factorVLeiden: boolean;
  prothrombin20210A: boolean;
  lupusAnticoagulant: boolean;
  anticardiolipinAb: boolean;
  elevatedHomocysteine: boolean;
  hit: boolean;
  otherThrombophilia: boolean;
  // 5-point factors
  strokeLess1mo: boolean;
  electiveArthroplasty: boolean;
  hipPelvisLegFracture: boolean;
  acuteSpinalCordInjury: boolean;
};

export type CapriniResult = {
  score: number;
  riskGroup: string;
  vteRate: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateCaprini(input: CapriniInput): CapriniResult {
  let score = 0;

  // 1-point
  if (input.age4160) score += 1;
  if (input.minorSurgery) score += 1;
  if (input.bmi25plus) score += 1;
  if (input.swollenLegs) score += 1;
  if (input.varicoseVeins) score += 1;
  if (input.pregnantPostpartum) score += 1;
  if (input.unexplainedFetalLoss) score += 1;
  if (input.oralContraceptives) score += 1;
  if (input.bedrestUnder72h) score += 1;
  if (input.plasterCastMinor) score += 1;
  if (input.centralVenousAccess) score += 1;

  // 2-point
  if (input.age6174) score += 2;
  if (input.arthroscopicSurgery) score += 2;
  if (input.malignancy) score += 2;
  if (input.confinedBed72hPlus) score += 2;
  if (input.historyDvtPe2) score += 2;

  // 3-point
  if (input.age75plus) score += 3;
  if (input.historyDvtPe3) score += 3;
  if (input.familyHistoryThrombosis) score += 3;
  if (input.factorVLeiden) score += 3;
  if (input.prothrombin20210A) score += 3;
  if (input.lupusAnticoagulant) score += 3;
  if (input.anticardiolipinAb) score += 3;
  if (input.elevatedHomocysteine) score += 3;
  if (input.hit) score += 3;
  if (input.otherThrombophilia) score += 3;

  // 5-point
  if (input.strokeLess1mo) score += 5;
  if (input.electiveArthroplasty) score += 5;
  if (input.hipPelvisLegFracture) score += 5;
  if (input.acuteSpinalCordInjury) score += 5;

  let riskGroup: string;
  let vteRate: string;
  let recommendation: string;
  let severity: "normal" | "warning" | "error";

  if (score <= 1) {
    riskGroup = "Очень низкий";
    vteRate = "<0.5%";
    recommendation = "Ранняя мобилизация";
    severity = "normal";
  } else if (score === 2) {
    riskGroup = "Низкий";
    vteRate = "~1.5%";
    recommendation = "Механическая профилактика (компрессия)";
    severity = "normal";
  } else if (score <= 4) {
    riskGroup = "Умеренный";
    vteRate = "~3%";
    recommendation = "Механическая + фармакологическая профилактика";
    severity = "warning";
  } else {
    riskGroup = "Высокий";
    vteRate = "≥6%";
    recommendation = "Фармакологическая профилактика + компрессия, пролонгированная до 4 нед";
    severity = "error";
  }

  return { score, riskGroup, vteRate, recommendation, severity };
}
