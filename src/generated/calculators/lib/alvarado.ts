// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/alvarado.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type AlvaradoInput = {
  migrationPain: boolean;   // Migration to RLQ: +1
  anorexia: boolean;        // Anorexia: +1
  nausea: boolean;          // Nausea/vomiting: +1
  rlqTenderness: boolean;   // RLQ tenderness: +2
  rebound: boolean;         // Rebound tenderness: +1
  fever: boolean;           // Temp >37.3°C: +1
  leukocytosis: boolean;    // WBC >10,000: +2
  leftShift: boolean;       // >75% neutrophils: +1
};

export type AlvaradoResult = {
  score: number;
  probability: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateAlvarado(input: AlvaradoInput): AlvaradoResult {
  let score = 0;
  if (input.migrationPain) score += 1;
  if (input.anorexia) score += 1;
  if (input.nausea) score += 1;
  if (input.rlqTenderness) score += 2;
  if (input.rebound) score += 1;
  if (input.fever) score += 1;
  if (input.leukocytosis) score += 2;
  if (input.leftShift) score += 1;

  if (score <= 4) {
    return {
      score,
      probability: "~5%",
      interpretation: "Аппендицит маловероятен",
      severity: "normal",
      recommendation: "Выписка, наблюдение в амбулаторных условиях",
    };
  } else if (score <= 6) {
    return {
      score,
      probability: "~30%",
      interpretation: "Аппендицит возможен",
      severity: "warning",
      recommendation: "КТ брюшной полости или наблюдение в стационаре",
    };
  } else if (score <= 8) {
    return {
      score,
      probability: "~65%",
      interpretation: "Аппендицит вероятен",
      severity: "error",
      recommendation: "Хирургическая консультация, рассмотреть операцию",
    };
  } else {
    return {
      score,
      probability: "~95%",
      interpretation: "Аппендицит высоко вероятен",
      severity: "error",
      recommendation: "Экстренная аппендэктомия",
    };
  }
}

export const alvaradoItems = [
  { key: "migrationPain" as keyof AlvaradoInput, label: "М — Миграция боли в правую подвздошную область", points: "+1" },
  { key: "anorexia" as keyof AlvaradoInput, label: "A — Анорексия", points: "+1" },
  { key: "nausea" as keyof AlvaradoInput, label: "N — Тошнота/рвота", points: "+1" },
  { key: "rlqTenderness" as keyof AlvaradoInput, label: "T — Болезненность в правой подвздошной области", points: "+2" },
  { key: "rebound" as keyof AlvaradoInput, label: "R — Симптом отдачи", points: "+1" },
  { key: "fever" as keyof AlvaradoInput, label: "E — Температура > 37.3°C", points: "+1" },
  { key: "leukocytosis" as keyof AlvaradoInput, label: "L — Лейкоцитоз > 10 000", points: "+2" },
  { key: "leftShift" as keyof AlvaradoInput, label: "S — Сдвиг формулы влево (> 75% нейтрофилов)", points: "+1" },
];
