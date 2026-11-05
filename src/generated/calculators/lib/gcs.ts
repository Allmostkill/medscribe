// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/gcs.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type GCSInput = {
  eyes: 1 | 2 | 3 | 4;
  verbal: 1 | 2 | 3 | 4 | 5;
  motor: 1 | 2 | 3 | 4 | 5 | 6;
};

export type GCSResult = {
  score: number;
  severity: "normal" | "warning" | "error";
  color: string;
  level: string;
  interpretation: string;
};

export function calculateGCS(input: GCSInput): GCSResult {
  const score = input.eyes + input.verbal + input.motor;

  if (score >= 13) {
    return {
      score,
      severity: "normal",
      color: "success",
      level: "Лёгкая ЧМТ",
      interpretation: "ШКГ 13–15 — сознание сохранено или незначительно нарушено",
    };
  } else if (score >= 9) {
    return {
      score,
      severity: "warning",
      color: "warning",
      level: "Умеренная ЧМТ",
      interpretation: "ШКГ 9–12 — нарушение сознания средней тяжести",
    };
  } else {
    return {
      score,
      severity: "error",
      color: "error",
      level: "Тяжёлая ЧМТ / Кома",
      interpretation: "ШКГ 3–8 — тяжёлое нарушение сознания",
    };
  }
}

export const gcsOptions = {
  eyes: [
    { value: 4, label: "4 — Спонтанное открывание" },
    { value: 3, label: "3 — На речевой стимул" },
    { value: 2, label: "2 — На болевой стимул" },
    { value: 1, label: "1 — Не открывает" },
  ],
  verbal: [
    { value: 5, label: "5 — Ориентирован" },
    { value: 4, label: "4 — Спутанная речь" },
    { value: 3, label: "3 — Отдельные слова" },
    { value: 2, label: "2 — Нечленораздельные звуки" },
    { value: 1, label: "1 — Нет ответа" },
  ],
  motor: [
    { value: 6, label: "6 — Выполняет команды" },
    { value: 5, label: "5 — Локализует боль" },
    { value: 4, label: "4 — Отдёргивает конечность" },
    { value: 3, label: "3 — Патологическое сгибание (декортикация)" },
    { value: 2, label: "2 — Патологическое разгибание (децеребрация)" },
    { value: 1, label: "1 — Нет ответа" },
  ],
};
