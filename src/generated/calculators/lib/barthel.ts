// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/barthel.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type BarthelInput = {
  feeding: 0 | 5 | 10;
  bathing: 0 | 5;
  grooming: 0 | 5;
  dressing: 0 | 5 | 10;
  bowel: 0 | 5 | 10;
  bladder: 0 | 5 | 10;
  toilet: 0 | 5 | 10;
  transfers: 0 | 5 | 10 | 15;
  mobility: 0 | 5 | 10 | 15;
  stairs: 0 | 5 | 10;
};

export type BarthelResult = {
  score: number;
  category: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateBarthel(input: BarthelInput): BarthelResult {
  const score = (Object.values(input) as number[]).reduce((sum, v) => sum + v, 0);

  let category: string;
  let severity: "normal" | "warning" | "error";
  let interpretation: string;

  if (score === 100) {
    category = "Независимый";
    severity = "normal";
    interpretation = "Полная независимость";
  } else if (score >= 91) {
    category = "Незначительная зависимость";
    severity = "normal";
    interpretation = "Незначительная зависимость";
  } else if (score >= 61) {
    category = "Умеренная зависимость";
    severity = "warning";
    interpretation = "Умеренная зависимость";
  } else if (score >= 21) {
    category = "Выраженная зависимость";
    severity = "error";
    interpretation = "Выраженная зависимость";
  } else {
    category = "Полная зависимость";
    severity = "error";
    interpretation = "Полная зависимость";
  }

  return { score, category, interpretation, severity };
}

export const barthelItems = [
  {
    key: "feeding" as keyof BarthelInput,
    label: "Приём пищи",
    options: [
      { value: 0 as const, label: "0 — Не может самостоятельно" },
      { value: 5 as const, label: "5 — Нужна помощь" },
      { value: 10 as const, label: "10 — Независим" },
    ],
  },
  {
    key: "bathing" as keyof BarthelInput,
    label: "Купание/душ",
    options: [
      { value: 0 as const, label: "0 — Зависим" },
      { value: 5 as const, label: "5 — Независим" },
    ],
  },
  {
    key: "grooming" as keyof BarthelInput,
    label: "Личная гигиена",
    options: [
      { value: 0 as const, label: "0 — Нужна помощь" },
      { value: 5 as const, label: "5 — Независим" },
    ],
  },
  {
    key: "dressing" as keyof BarthelInput,
    label: "Одевание",
    options: [
      { value: 0 as const, label: "0 — Зависим" },
      { value: 5 as const, label: "5 — Нужна помощь" },
      { value: 10 as const, label: "10 — Независим" },
    ],
  },
  {
    key: "bowel" as keyof BarthelInput,
    label: "Контроль кишечника",
    options: [
      { value: 0 as const, label: "0 — Недержание" },
      { value: 5 as const, label: "5 — Случайные эпизоды" },
      { value: 10 as const, label: "10 — Удерживает" },
    ],
  },
  {
    key: "bladder" as keyof BarthelInput,
    label: "Контроль мочевого пузыря",
    options: [
      { value: 0 as const, label: "0 — Недержание" },
      { value: 5 as const, label: "5 — Случайные эпизоды" },
      { value: 10 as const, label: "10 — Удерживает" },
    ],
  },
  {
    key: "toilet" as keyof BarthelInput,
    label: "Пользование туалетом",
    options: [
      { value: 0 as const, label: "0 — Зависим" },
      { value: 5 as const, label: "5 — Нужна помощь" },
      { value: 10 as const, label: "10 — Независим" },
    ],
  },
  {
    key: "transfers" as keyof BarthelInput,
    label: "Перемещение кровать-кресло",
    options: [
      { value: 0 as const, label: "0 — Невозможно (нет баланса сидя)" },
      { value: 5 as const, label: "5 — Требует значительной помощи" },
      { value: 10 as const, label: "10 — Требует небольшой помощи" },
      { value: 15 as const, label: "15 — Независим" },
    ],
  },
  {
    key: "mobility" as keyof BarthelInput,
    label: "Передвижение",
    options: [
      { value: 0 as const, label: "0 — Неподвижен" },
      { value: 5 as const, label: "5 — Независим в кресле-коляске" },
      { value: 10 as const, label: "10 — Ходит с помощью" },
      { value: 15 as const, label: "15 — Независим > 50 м" },
    ],
  },
  {
    key: "stairs" as keyof BarthelInput,
    label: "Подъём по лестнице",
    options: [
      { value: 0 as const, label: "0 — Не может" },
      { value: 5 as const, label: "5 — Нужна помощь" },
      { value: 10 as const, label: "10 — Независим" },
    ],
  },
];
