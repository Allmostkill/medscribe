// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/nac_protocol.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type NACProtocolInput = {
  weight: number; // kg
};

export type NACPhase = {
  phase: string;
  dose: number;   // mg
  volume: string; // mL D5W
  duration: string;
  rate: number;   // mg/kg/h
};

export type NACProtocolResult = {
  phases: NACPhase[];
  totalDose: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateNACProtocol(input: NACProtocolInput): NACProtocolResult {
  const w = Math.min(input.weight, 110); // cap at 110 kg per guidelines

  // 21-hour IV Acetylcysteine protocol (FDA approved)
  const phase1Dose = Math.round(150 * w);  // 150 mg/kg over 1h
  const phase2Dose = Math.round(50 * w);   // 50 mg/kg over 4h
  const phase3Dose = Math.round(100 * w);  // 100 mg/kg over 16h
  const totalDose = phase1Dose + phase2Dose + phase3Dose;

  const phases: NACPhase[] = [
    {
      phase: "Фаза 1 (нагрузочная)",
      dose: phase1Dose,
      volume: "200 мл D5W",
      duration: "60 мин",
      rate: 150,
    },
    {
      phase: "Фаза 2",
      dose: phase2Dose,
      volume: "500 мл D5W",
      duration: "4 часа",
      rate: 12.5,
    },
    {
      phase: "Фаза 3 (поддерживающая)",
      dose: phase3Dose,
      volume: "1000 мл D5W",
      duration: "16 часов",
      rate: 6.25,
    },
  ];

  return {
    phases,
    totalDose,
    interpretation: `Общая доза NAC: ${totalDose} мг за 21 час`,
    severity: "normal",
  };
}
