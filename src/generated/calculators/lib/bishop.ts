// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/bishop.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type BishopInput = {
  dilation: 0 | 1 | 2 | 3;      // cm: 0=0, 1=1-2, 2=3-4, 3=5+
  effacement: 0 | 1 | 2 | 3;    // %: 0=0-30, 1=40-50, 2=60-70, 3=80+
  station: 0 | 1 | 2 | 3;       // 0=-3, 1=-2, 2=-1/0, 3=+1/+2
  consistency: 0 | 1 | 2;       // 0=firm, 1=medium, 2=soft
  position: 0 | 1 | 2;          // 0=posterior, 1=mid, 2=anterior
};

export type BishopResult = {
  score: number;
  ripeness: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateBishop(input: BishopInput): BishopResult {
  const score = input.dilation + input.effacement + input.station + input.consistency + input.position;

  if (score >= 8) {
    return {
      score,
      ripeness: "Зрелая шейка матки",
      recommendation: "Шейка зрелая — успешная индукция родов ожидаема",
      severity: "normal",
    };
  } else if (score >= 6) {
    return {
      score,
      ripeness: "Пограничное состояние",
      recommendation: "Пограничная зрелость — возможна индукция, риск неудачи умеренный",
      severity: "warning",
    };
  } else {
    return {
      score,
      ripeness: "Незрелая шейка матки",
      recommendation: "Шейка незрелая — рекомендуется созревание перед индукцией",
      severity: "error",
    };
  }
}

export const bishopOptions = {
  dilation: [
    { value: 0, label: "0 — Закрыта (0 см)" },
    { value: 1, label: "1 — 1–2 см" },
    { value: 2, label: "2 — 3–4 см" },
    { value: 3, label: "3 — 5+ см" },
  ],
  effacement: [
    { value: 0, label: "0 — 0–30%" },
    { value: 1, label: "1 — 40–50%" },
    { value: 2, label: "2 — 60–70%" },
    { value: 3, label: "3 — 80%+" },
  ],
  station: [
    { value: 0, label: "0 — −3" },
    { value: 1, label: "1 — −2" },
    { value: 2, label: "2 — −1/0" },
    { value: 3, label: "3 — +1/+2" },
  ],
  consistency: [
    { value: 0, label: "0 — Плотная" },
    { value: 1, label: "1 — Средняя" },
    { value: 2, label: "2 — Мягкая" },
  ],
  position: [
    { value: 0, label: "0 — Задняя" },
    { value: 1, label: "1 — Средняя" },
    { value: 2, label: "2 — Передняя" },
  ],
};
