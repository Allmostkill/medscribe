// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/acr_eular_ra.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type ACREULARRAInput = {
  joints: 0 | 2 | 3 | 5;          // Joint involvement
  serology: 0 | 2 | 3;            // RF/anti-CCP
  acutePhase: 0 | 1;              // CRP/ESR
  duration: 0 | 1;                // Duration of symptoms
};

export type ACREULARRAResult = {
  score: number;
  interpretation: string;
  diagnosis: string;
  severity: "normal" | "warning" | "error";
};

export function calculateACREULARRA(input: ACREULARRAInput): ACREULARRAResult {
  const score = input.joints + input.serology + input.acutePhase + input.duration;

  let interpretation: string;
  let diagnosis: string;
  let severity: "normal" | "warning" | "error";

  if (score >= 6) {
    interpretation = "Критерии РА выполнены (≥ 6 баллов)";
    diagnosis = "Ревматоидный артрит";
    severity = "error";
  } else if (score >= 4) {
    interpretation = "Критерии РА не выполнены, но подозрение обосновано";
    diagnosis = "Возможный РА, требует наблюдения";
    severity = "warning";
  } else {
    interpretation = "Критерии РА не выполнены";
    diagnosis = "РА маловероятен по данным критериям";
    severity = "normal";
  }

  return { score, interpretation, diagnosis, severity };
}

export const acrEularOptions = {
  joints: [
    { value: 0 as const, label: "0 — 1 крупный сустав" },
    { value: 2 as const, label: "2 — 2–10 крупных суставов" },
    { value: 3 as const, label: "3 — 1–3 мелких сустава" },
    { value: 5 as const, label: "5 — 4–10 мелких суставов или > 10 суставов" },
  ],
  serology: [
    { value: 0 as const, label: "0 — РФ и anti-CCP отрицательные" },
    { value: 2 as const, label: "2 — Слабо положительный РФ или anti-CCP" },
    { value: 3 as const, label: "3 — Высоко положительный РФ или anti-CCP" },
  ],
  acutePhase: [
    { value: 0 as const, label: "0 — CRP и СОЭ нормальные" },
    { value: 1 as const, label: "1 — Аномальный CRP или СОЭ" },
  ],
  duration: [
    { value: 0 as const, label: "0 — < 6 недель" },
    { value: 1 as const, label: "1 — ≥ 6 недель" },
  ],
};
