// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/rts.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type RTSInput = {
  gcsCoded: 0 | 1 | 2 | 3 | 4;
  sbpCoded: 0 | 1 | 2 | 3 | 4;
  rrCoded: 0 | 1 | 2 | 3 | 4;
};

export type RTSResult = {
  rts: number;
  trts: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateRTS(input: RTSInput): RTSResult {
  const { gcsCoded, sbpCoded, rrCoded } = input;
  const rts = 0.9368 * gcsCoded + 0.7326 * sbpCoded + 0.2908 * rrCoded;
  const trts = gcsCoded + sbpCoded + rrCoded;
  const rtsRounded = Math.round(rts * 100) / 100;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let recommendation: string;

  if (trts === 12 && rtsRounded >= 7) {
    interpretation = "Лёгкая травма";
    severity = "normal";
    recommendation = "Стандартная оценка травмы";
  } else if (trts >= 11) {
    interpretation = "Умеренная травма";
    severity = "warning";
    recommendation = "Рассмотреть направление в травматологический центр";
  } else {
    interpretation = "Тяжёлая травма (T-RTS ≤ 11)";
    severity = "error";
    recommendation = "Направление в травматологический центр уровня I–II";
  }

  return { rts: rtsRounded, trts, interpretation, severity, recommendation };
}

export const rtsOptions = {
  gcsCoded: [
    { value: 4 as const, label: "4 — ШКГ 13–15" },
    { value: 3 as const, label: "3 — ШКГ 9–12" },
    { value: 2 as const, label: "2 — ШКГ 6–8" },
    { value: 1 as const, label: "1 — ШКГ 4–5" },
    { value: 0 as const, label: "0 — ШКГ 3" },
  ],
  sbpCoded: [
    { value: 4 as const, label: "4 — АД > 89 мм рт.ст." },
    { value: 3 as const, label: "3 — АД 76–89" },
    { value: 2 as const, label: "2 — АД 50–75" },
    { value: 1 as const, label: "1 — АД 1–49" },
    { value: 0 as const, label: "0 — АД 0" },
  ],
  rrCoded: [
    { value: 4 as const, label: "4 — ЧДД 10–29 /мин" },
    { value: 3 as const, label: "3 — ЧДД > 29" },
    { value: 2 as const, label: "2 — ЧДД 6–9" },
    { value: 1 as const, label: "1 — ЧДД 1–5" },
    { value: 0 as const, label: "0 — ЧДД 0" },
  ],
};
