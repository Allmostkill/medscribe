// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/naegele.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type NaegeleInput = {
  lmpDate: string; // ISO date string YYYY-MM-DD
};

export type NaegeleResult = {
  eddDate: Date;
  eddFormatted: string;
  gestationalWeeks: number;
  severity: "normal" | "warning" | "error";
  interpretation: string;
};

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function calculateNaegele(input: NaegeleInput): NaegeleResult {
  const lmp = new Date(input.lmpDate);
  const edd = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);

  const day = edd.getDate();
  const month = MONTHS_RU[edd.getMonth()];
  const year = edd.getFullYear();
  const eddFormatted = `${day} ${month} ${year} г.`;

  // Calculate current gestational age
  const now = new Date();
  const diffMs = now.getTime() - lmp.getTime();
  const gestationalDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const gestationalWeeks = Math.floor(gestationalDays / 7);

  return {
    eddDate: edd,
    eddFormatted,
    gestationalWeeks: Math.max(0, gestationalWeeks),
    severity: "normal",
    interpretation: gestationalWeeks >= 0 && gestationalWeeks <= 42
      ? `Текущий срок гестации: ~${gestationalWeeks} нед.`
      : "Введите дату ПМЦ",
  };
}
