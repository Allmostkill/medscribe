// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/pgcs.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PGCSInput = {
  eye: 1 | 2 | 3 | 4;
  verbal: 1 | 2 | 3 | 4 | 5;
  motor: 1 | 2 | 3 | 4 | 5 | 6;
};

export type PGCSResult = {
  score: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculatePGCS(input: PGCSInput): PGCSResult {
  const score = input.eye + input.verbal + input.motor;

  let interpretation: string;
  let severity: "normal" | "warning" | "error";

  if (score >= 13) {
    interpretation = "Лёгкое повреждение мозга (13–15)";
    severity = "normal";
  } else if (score >= 9) {
    interpretation = "Умеренное повреждение мозга (9–12)";
    severity = "warning";
  } else {
    interpretation = "Тяжёлое повреждение мозга (≤ 8)";
    severity = "error";
  }

  return { score, interpretation, severity };
}

export const pgcsOptions = {
  eye: [
    { value: 1 as const, label: "1 — Не открывает" },
    { value: 2 as const, label: "2 — На боль" },
    { value: 3 as const, label: "3 — На голос" },
    { value: 4 as const, label: "4 — Спонтанно" },
  ],
  verbal: [
    { value: 1 as const, label: "1 — Нет ответа" },
    { value: 2 as const, label: "2 — Стоны / нечленораздельно" },
    { value: 3 as const, label: "3 — Плачет / крик (неадекватные слова)" },
    { value: 4 as const, label: "4 — Возбуждён / недостаточно ориентирован" },
    { value: 5 as const, label: "5 — Ориентирован / нормальная речь" },
  ],
  motor: [
    { value: 1 as const, label: "1 — Нет ответа" },
    { value: 2 as const, label: "2 — Разгибание (децеребрация)" },
    { value: 3 as const, label: "3 — Сгибание (декортикация)" },
    { value: 4 as const, label: "4 — Отдёргивание" },
    { value: 5 as const, label: "5 — Локализует боль" },
    { value: 6 as const, label: "6 — Выполняет команды" },
  ],
};
