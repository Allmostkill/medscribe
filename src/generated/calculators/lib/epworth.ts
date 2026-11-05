// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/epworth.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type EpworthInput = {
  sitting: 0 | 1 | 2 | 3;
  watching_tv: 0 | 1 | 2 | 3;
  sitting_inactive: 0 | 1 | 2 | 3;
  passenger: 0 | 1 | 2 | 3;
  lying_afternoon: 0 | 1 | 2 | 3;
  sitting_talking: 0 | 1 | 2 | 3;
  sitting_after_lunch: 0 | 1 | 2 | 3;
  in_car_traffic: 0 | 1 | 2 | 3;
};

export type EpworthResult = {
  score: number;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateEpworth(input: EpworthInput): EpworthResult {
  const score = (Object.values(input) as number[]).reduce((s, v) => s + v, 0);

  if (score <= 10) {
    return {
      score,
      interpretation: "Нормальная дневная сонливость (0–10)",
      severity: "normal",
      recommendation: "Дневная сонливость в норме",
    };
  } else if (score <= 15) {
    return {
      score,
      interpretation: "Умеренная избыточная дневная сонливость (11–15)",
      severity: "warning",
      recommendation: "Обследование на нарушения сна (СОАС, нарколепсия)",
    };
  } else {
    return {
      score,
      interpretation: "Тяжёлая избыточная дневная сонливость (> 15)",
      severity: "error",
      recommendation: "Направление на полисомнографию, исключить СОАС",
    };
  }
}

export const epworthItems = [
  { key: "sitting" as keyof EpworthInput, label: "Сидя и читая" },
  { key: "watching_tv" as keyof EpworthInput, label: "Просматривая телевизор" },
  { key: "sitting_inactive" as keyof EpworthInput, label: "Сидя в пассивной ситуации (лекция, совещание)" },
  { key: "passenger" as keyof EpworthInput, label: "В качестве пассажира в транспорте (1 час без остановок)" },
  { key: "lying_afternoon" as keyof EpworthInput, label: "Лёжа отдыхая после обеда (когда есть возможность)" },
  { key: "sitting_talking" as keyof EpworthInput, label: "Сидя и разговаривая" },
  { key: "sitting_after_lunch" as keyof EpworthInput, label: "Сидя спокойно после обеда (без алкоголя)" },
  { key: "in_car_traffic" as keyof EpworthInput, label: "За рулём, стоя в пробке (несколько минут)" },
];

export const epworthAnswerOptions = [
  { value: 0 as const, label: "0 — Никогда не засыпаю" },
  { value: 1 as const, label: "1 — Малая вероятность засыпания" },
  { value: 2 as const, label: "2 — Умеренная вероятность" },
  { value: 3 as const, label: "3 — Высокая вероятность" },
];
