// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ktv.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type KtVInput = {
  preBUN: number;   // Pre-dialysis BUN, mg/dL
  postBUN: number;  // Post-dialysis BUN, mg/dL
  duration: number; // Dialysis duration, hours
  uf: number;       // Ultrafiltration volume, liters
  postWeight: number; // Post-dialysis weight, kg
};

export type KtVResult = {
  ktv: number;
  urr: number;
  ktvInterpretation: string;
  urrInterpretation: string;
  severity: "normal" | "warning" | "error";
  interpretation: string;
};

export function calculateKtV(input: KtVInput): KtVResult {
  const { preBUN, postBUN, duration, uf, postWeight } = input;
  const R = postBUN / preBUN;
  const t = duration;
  const UF = uf;
  const W = postWeight;

  const ktv = -Math.log(R - 0.008 * t) + (4 - 3.5 * R) * (UF / W);
  const urr = (1 - R) * 100;

  const ktvRounded = Math.round(ktv * 100) / 100;
  const urrRounded = Math.round(urr * 10) / 10;

  const ktvAdequate = ktvRounded >= 1.2;
  const urrAdequate = urrRounded >= 65;

  const ktvInterpretation = ktvAdequate ? `Kt/V ${ktvRounded} — Адекватный (≥ 1.2)` : `Kt/V ${ktvRounded} — Недостаточный (< 1.2)`;
  const urrInterpretation = urrAdequate ? `URR ${urrRounded}% — Адекватный (≥ 65%)` : `URR ${urrRounded}% — Недостаточный (< 65%)`;

  const severity = ktvAdequate && urrAdequate ? "normal" : !ktvAdequate && !urrAdequate ? "error" : "warning";
  const interpretation = ktvAdequate ? "Адекватный диализ" : "Недостаточная адекватность диализа";

  return { ktv: ktvRounded, urr: urrRounded, ktvInterpretation, urrInterpretation, severity, interpretation };
}
