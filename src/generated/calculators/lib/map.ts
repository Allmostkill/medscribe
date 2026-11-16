// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/map.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MAPInput = {
  sbp: number; // mmHg
  dbp: number; // mmHg
};

export type MAPResult = {
  map: number;
  interpretation: string;
  severity: "critical" | "normal" | "warning" | "error";
  color: string;
};

export function calculateMAP(input: MAPInput): MAPResult {
  const { sbp, dbp } = input;
  const map = dbp + (sbp - dbp) / 3;
  const rounded = Math.round(map * 10) / 10;

  if (map < 65) {
    return {
      map: rounded,
      interpretation: "Критически низкое — риск органной гипоперфузии",
      severity: "critical",
      color: "error",
    };
  } else if (map <= 100) {
    return {
      map: rounded,
      interpretation: "Норма",
      severity: "normal",
      color: "success",
    };
  } else if (map <= 110) {
    return {
      map: rounded,
      interpretation: "Умеренно повышено",
      severity: "warning",
      color: "warning",
    };
  } else {
    return {
      map: rounded,
      interpretation: "Гипертензивный уровень",
      severity: "error",
      color: "error",
    };
  }
}
