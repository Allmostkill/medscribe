// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/mascc.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MASCCInput = {
  burden: 0 | 3 | 5;     // Burden of illness: severe=0, moderate=3, none/mild=5
  noHypotension: boolean; // SBP >90: +5
  noCOPD: boolean;        // No COPD: +4
  solidOrNoFungal: boolean; // Solid tumor OR no prior fungal: +4
  noDehydration: boolean; // No dehydration: +3
  outpatient: boolean;    // Outpatient at onset: +3
  ageLt60: boolean;       // Age <60: +2
};

export type MASCCResult = {
  score: number;
  risk: string;
  complicationRate: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateMASCC(input: MASCCInput): MASCCResult {
  const score = input.burden + (input.noHypotension ? 5 : 0) + (input.noCOPD ? 4 : 0) + (input.solidOrNoFungal ? 4 : 0) + (input.noDehydration ? 3 : 0) + (input.outpatient ? 3 : 0) + (input.ageLt60 ? 2 : 0);

  if (score >= 21) {
    return {
      score, risk: "Низкий", complicationRate: "< 5%",
      interpretation: "Низкий риск осложнений",
      severity: "normal",
      recommendation: "Амбулаторное лечение пероральными антибиотиками возможно",
    };
  } else {
    return {
      score, risk: "Высокий", complicationRate: "≥ 26%",
      interpretation: "Высокий риск осложнений",
      severity: "error",
      recommendation: "Госпитализация, внутривенные антибиотики",
    };
  }
}
