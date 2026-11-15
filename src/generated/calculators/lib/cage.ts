// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/cage.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CAGEInput = {
  cutDown: boolean;  // C: Cut down
  annoyed: boolean;  // A: Annoyed
  guilty: boolean;   // G: Guilty
  eyeOpener: boolean; // E: Eye-opener
};

export type CAGEResult = {
  score: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateCAGE(input: CAGEInput): CAGEResult {
  const score = [input.cutDown, input.annoyed, input.guilty, input.eyeOpener].filter(Boolean).length;

  if (score <= 1) {
    return {
      score,
      interpretation: "Отрицательный скрининг",
      severity: "normal",
      recommendation: "Скрининг на алкогольную зависимость отрицательный",
    };
  } else {
    return {
      score,
      interpretation: "Положительный скрининг (≥ 2)",
      severity: score >= 3 ? "error" : "warning",
      recommendation: "Рекомендуется дальнейшая оценка на алкогольную зависимость (AUDIT, клиническое интервью)",
    };
  }
}

export const cageItems = [
  { key: "cutDown" as keyof CAGEInput, label: "C — Сокращение", description: "Вы когда-либо чувствовали, что вам следует сократить употребление алкоголя?" },
  { key: "annoyed" as keyof CAGEInput, label: "A — Раздражение", description: "Вас когда-либо раздражала критика вашего употребления алкоголя?" },
  { key: "guilty" as keyof CAGEInput, label: "G — Вина", description: "Вы когда-либо чувствовали вину из-за употребления алкоголя?" },
  { key: "eyeOpener" as keyof CAGEInput, label: "E — Утренняя доза", description: "Вы когда-либо нуждались в алкоголе с утра, чтобы «открыть глаза» и прийти в норму?" },
];
