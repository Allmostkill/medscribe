// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/ipss.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type IPSSInput = {
  incomplete: 0 | 1 | 2 | 3 | 4 | 5;
  frequency: 0 | 1 | 2 | 3 | 4 | 5;
  intermittency: 0 | 1 | 2 | 3 | 4 | 5;
  urgency: 0 | 1 | 2 | 3 | 4 | 5;
  weakStream: 0 | 1 | 2 | 3 | 4 | 5;
  straining: 0 | 1 | 2 | 3 | 4 | 5;
  nocturia: 0 | 1 | 2 | 3 | 4 | 5;
  qol: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // Quality of life (not added to IPSS)
};

export type IPSSResult = {
  score: number;
  qol: number;
  severity: "normal" | "warning" | "error";
  category: string;
  interpretation: string;
};

export function calculateIPSS(input: IPSSInput): IPSSResult {
  const score = input.incomplete + input.frequency + input.intermittency + input.urgency + input.weakStream + input.straining + input.nocturia;
  const qol = input.qol;

  let category: string;
  let severity: "normal" | "warning" | "error";
  let interpretation: string;

  if (score <= 7) {
    category = "Лёгкие симптомы (0–7)"; severity = "normal"; interpretation = "Лёгкие симптомы СНМП";
  } else if (score <= 19) {
    category = "Умеренные симптомы (8–19)"; severity = "warning"; interpretation = "Умеренные симптомы СНМП";
  } else {
    category = "Тяжёлые симптомы (20–35)"; severity = "error"; interpretation = "Тяжёлые симптомы СНМП";
  }

  return { score, qol, category, severity, interpretation };
}

export const ipssQuestions = [
  { key: "incomplete" as keyof IPSSInput, label: "1. Неполное опорожнение", description: "Как часто за последний месяц у вас оставалось ощущение неполного опорожнения мочевого пузыря после мочеиспускания?" },
  { key: "frequency" as keyof IPSSInput, label: "2. Частота", description: "Как часто вам приходилось мочиться снова менее чем через 2 часа после последнего мочеиспускания?" },
  { key: "intermittency" as keyof IPSSInput, label: "3. Прерывистость", description: "Как часто у вас прерывалась струя мочи?" },
  { key: "urgency" as keyof IPSSInput, label: "4. Ургентность", description: "Как часто вам было трудно удерживать мочеиспускание?" },
  { key: "weakStream" as keyof IPSSInput, label: "5. Слабая струя", description: "Как часто у вас была слабая струя мочи?" },
  { key: "straining" as keyof IPSSInput, label: "6. Натуживание", description: "Как часто вам приходилось натуживаться, чтобы начать мочеиспускание?" },
  { key: "nocturia" as keyof IPSSInput, label: "7. Ноктурия", description: "Сколько раз обычно вы вставали ночью для мочеиспускания?" },
];

export const ipssFreqOptions = [
  { value: 0 as const, label: "0 — Ни разу" },
  { value: 1 as const, label: "1 — Менее 1 раза из 5" },
  { value: 2 as const, label: "2 — Менее 1 раза из 2" },
  { value: 3 as const, label: "3 — Примерно 1 раз из 2" },
  { value: 4 as const, label: "4 — Более 1 раза из 2" },
  { value: 5 as const, label: "5 — Почти всегда" },
];

export const ipssNocturiaOptions = [
  { value: 0 as const, label: "0 — Ни разу" },
  { value: 1 as const, label: "1 — 1 раз" },
  { value: 2 as const, label: "2 — 2 раза" },
  { value: 3 as const, label: "3 — 3 раза" },
  { value: 4 as const, label: "4 — 4 раза" },
  { value: 5 as const, label: "5 — 5 раз и более" },
];

export const ipssQoLOptions = [
  { value: 0 as const, label: "0 — Отлично" },
  { value: 1 as const, label: "1 — Хорошо" },
  { value: 2 as const, label: "2 — В основном удовлетворён" },
  { value: 3 as const, label: "3 — Смешанное чувство" },
  { value: 4 as const, label: "4 — В основном неудовлетворён" },
  { value: 5 as const, label: "5 — Плохо" },
  { value: 6 as const, label: "6 — Ужасно" },
];
