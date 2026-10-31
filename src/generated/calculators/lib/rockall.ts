// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/rockall.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type RockallInput = {
  age: 0 | 1 | 2;           // <60=0, 60-79=1, >=80=2
  shock: 0 | 1 | 2;         // No shock=0, Tachycardia=1, Hypotension=2
  comorbidity: 0 | 2 | 3;   // None=0, CHF/IHD=2, Renal/Liver/Cancer=3
  diagnosis: 0 | 1 | 2;     // Mallory-Weiss/no lesion=0, Other=1, Malignancy=2
  bleedingSigns: 0 | 2;     // None/dark spot=0, Blood/clot/vessel=2
};

export type RockallResult = {
  score: number;
  mortality: string;
  rebleed: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateRockall(input: RockallInput): RockallResult {
  const score = input.age + input.shock + input.comorbidity + input.diagnosis + input.bleedingSigns;

  if (score === 0) {
    return { score, mortality: "0.2%", rebleed: "4.9%", interpretation: "Очень низкий риск", severity: "normal" };
  } else if (score <= 2) {
    return { score, mortality: "2.4%", rebleed: "5.3%", interpretation: "Низкий риск", severity: "normal" };
  } else if (score <= 4) {
    return { score, mortality: "5.6%", rebleed: "14.1%", interpretation: "Умеренный риск", severity: "warning" };
  } else if (score <= 6) {
    return { score, mortality: "11%", rebleed: "24.1%", interpretation: "Высокий риск", severity: "error" };
  } else {
    return { score, mortality: "25–41%", rebleed: "41.8%", interpretation: "Очень высокий риск", severity: "error" };
  }
}

export const rockallOptions = {
  age: [
    { value: 0 as const, label: "< 60 лет" },
    { value: 1 as const, label: "60–79 лет" },
    { value: 2 as const, label: "≥ 80 лет" },
  ],
  shock: [
    { value: 0 as const, label: "Нет — АД ≥ 100, ЧСС < 100" },
    { value: 1 as const, label: "Тахикардия — АД ≥ 100, ЧСС ≥ 100" },
    { value: 2 as const, label: "Гипотензия — АД < 90" },
  ],
  comorbidity: [
    { value: 0 as const, label: "Нет" },
    { value: 2 as const, label: "СН / ИБС / другие тяжёлые" },
    { value: 3 as const, label: "Почечная/печёночная недостаточность / метастазы" },
  ],
  diagnosis: [
    { value: 0 as const, label: "Разрыв Мэллори-Вейсса / нет поражения" },
    { value: 1 as const, label: "Другой диагноз" },
    { value: 2 as const, label: "Злокачественное новообразование" },
  ],
  bleedingSigns: [
    { value: 0 as const, label: "Нет / тёмное пятно" },
    { value: 2 as const, label: "Кровь в желудке / сгусток / видимый сосуд / активное кровотечение" },
  ],
};
