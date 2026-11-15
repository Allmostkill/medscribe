// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/hamd17.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HAMD17Input = {
  q1: 0 | 1 | 2 | 3 | 4;  // Депрессивное настроение (0-4)
  q2: 0 | 1 | 2 | 3 | 4;  // Чувство вины (0-4)
  q3: 0 | 1 | 2 | 3 | 4;  // Суицид (0-4)
  q4: 0 | 1 | 2;           // Начальная инсомния (0-2)
  q5: 0 | 1 | 2;           // Средняя инсомния (0-2)
  q6: 0 | 1 | 2;           // Поздняя инсомния (0-2)
  q7: 0 | 1 | 2 | 3 | 4;  // Работа и активность (0-4)
  q8: 0 | 1 | 2 | 3 | 4;  // Психомоторная заторможенность (0-4)
  q9: 0 | 1 | 2 | 3 | 4;  // Ажитация (0-4)
  q10: 0 | 1 | 2 | 3 | 4; // Психическая тревога (0-4)
  q11: 0 | 1 | 2 | 3 | 4; // Соматическая тревога (0-4)
  q12: 0 | 1 | 2;          // Соматические симптомы — ЖКТ (0-2)
  q13: 0 | 1 | 2;          // Общие соматические симптомы (0-2)
  q14: 0 | 1 | 2;          // Генитальные симптомы (0-2)
  q15: 0 | 1 | 2 | 3 | 4; // Ипохондрия (0-4)
  q16: 0 | 1 | 2;          // Снижение веса (0-2)
  q17: 0 | 1 | 2;          // Критичность (0-2)
};

export type HAMD17Result = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
  suicidalRisk: boolean;
};

export const hamd17Items = [
  { key: "q1", text: "Депрессивное настроение", max: 4 },
  { key: "q2", text: "Чувство вины", max: 4 },
  { key: "q3", text: "Суицид", max: 4 },
  { key: "q4", text: "Начальная инсомния (трудности засыпания)", max: 2 },
  { key: "q5", text: "Средняя инсомния (пробуждения ночью)", max: 2 },
  { key: "q6", text: "Поздняя инсомния (ранние пробуждения)", max: 2 },
  { key: "q7", text: "Работа и активность", max: 4 },
  { key: "q8", text: "Психомоторная заторможенность", max: 4 },
  { key: "q9", text: "Ажитация", max: 4 },
  { key: "q10", text: "Психическая тревога", max: 4 },
  { key: "q11", text: "Соматическая тревога", max: 4 },
  { key: "q12", text: "Соматические симптомы — ЖКТ", max: 2 },
  { key: "q13", text: "Общие соматические симптомы", max: 2 },
  { key: "q14", text: "Генитальные симптомы", max: 2 },
  { key: "q15", text: "Ипохондрия", max: 4 },
  { key: "q16", text: "Снижение веса", max: 2 },
  { key: "q17", text: "Критичность к своему состоянию", max: 2 },
];

export function getHAMD17Options(max: number) {
  return Array.from({ length: max + 1 }, (_, i) => ({ value: i, label: String(i) }));
}

export function calculateHAMD17(input: HAMD17Input): HAMD17Result {
  const score = (Object.values(input) as number[]).reduce((a, b) => a + b, 0);
  const suicidalRisk = input.q3 >= 1;

  if (score <= 7) {
    return { score, severity: "normal", level: "Норма / ремиссия", recommendation: "Ремиссия (≤7 баллов)", suicidalRisk };
  } else if (score <= 13) {
    return { score, severity: "warning", level: "Лёгкая депрессия", recommendation: "Наблюдение, психотерапия", suicidalRisk };
  } else if (score <= 18) {
    return { score, severity: "warning", level: "Умеренная депрессия", recommendation: "Психотерапия и/или антидепрессанты", suicidalRisk };
  } else if (score <= 22) {
    return { score, severity: "error", level: "Тяжёлая депрессия", recommendation: "Активная фармакотерапия", suicidalRisk };
  } else {
    return { score, severity: "error", level: "Очень тяжёлая депрессия", recommendation: "Интенсивная терапия, рассмотреть госпитализацию", suicidalRisk };
  }
}
