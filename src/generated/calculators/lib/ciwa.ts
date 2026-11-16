// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ciwa.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CIWAInput = {
  nausea: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  tremor: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  sweats: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  anxiety: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  agitation: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  tactile: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  auditory: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  visual: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  headache: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  orientation: 0 | 1 | 2 | 3 | 4;
};

export type CIWAResult = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
};

export function calculateCIWA(input: CIWAInput): CIWAResult {
  const score =
    input.nausea +
    input.tremor +
    input.sweats +
    input.anxiety +
    input.agitation +
    input.tactile +
    input.auditory +
    input.visual +
    input.headache +
    input.orientation;

  if (score < 8) {
    return { score, severity: "normal", level: "Лёгкий", recommendation: "Симптоматическое лечение, наблюдение" };
  } else if (score <= 15) {
    return { score, severity: "warning", level: "Умеренный", recommendation: "Рассмотреть назначение бензодиазепинов" };
  } else {
    return { score, severity: "error", level: "Тяжёлый", recommendation: "Бензодиазепины обязательны, интенсивное наблюдение" };
  }
}

export const ciwaOptions07 = Array.from({ length: 8 }, (_, i) => ({ value: i, label: String(i) }));
export const ciwaOptions04 = Array.from({ length: 5 }, (_, i) => ({ value: i, label: String(i) }));
