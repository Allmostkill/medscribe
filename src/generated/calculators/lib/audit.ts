// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/audit.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type AUDITInput = {
  q1: 0 | 1 | 2 | 3 | 4;  // Frequency of drinking
  q2: 0 | 1 | 2 | 3 | 4;  // Typical number of drinks
  q3: 0 | 1 | 2 | 3 | 4;  // Frequency of 6+ drinks
  q4: 0 | 1 | 2 | 3 | 4;  // Inability to stop
  q5: 0 | 1 | 2 | 3 | 4;  // Failure to meet expectations
  q6: 0 | 1 | 2 | 3 | 4;  // Morning drinking
  q7: 0 | 1 | 2 | 3 | 4;  // Guilt
  q8: 0 | 1 | 2 | 3 | 4;  // Memory blackout
  q9: 0 | 2 | 4;           // Injury (0/2/4)
  q10: 0 | 2 | 4;          // Concern from others (0/2/4)
};

export type AUDITResult = {
  score: number;
  auditC: number;
  zone: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateAUDIT(input: AUDITInput): AUDITResult {
  const score = input.q1 + input.q2 + input.q3 + input.q4 + input.q5 + input.q6 + input.q7 + input.q8 + input.q9 + input.q10;
  const auditC = input.q1 + input.q2 + input.q3;

  let zone: string;
  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let recommendation: string;

  if (score <= 7) {
    zone = "I"; interpretation = "Зона I — Низкий риск"; severity = "normal";
    recommendation = "Краткое информирование при необходимости";
  } else if (score <= 15) {
    zone = "II"; interpretation = "Зона II — Опасное употребление"; severity = "warning";
    recommendation = "Краткое консультирование и мониторинг";
  } else if (score <= 19) {
    zone = "III"; interpretation = "Зона III — Вредное употребление"; severity = "error";
    recommendation = "Краткое консультирование и направление к специалисту";
  } else {
    zone = "IV"; interpretation = "Зона IV — Возможная зависимость"; severity = "error";
    recommendation = "Направление к наркологу для диагностики и лечения";
  }

  return { score, auditC, zone, interpretation, severity, recommendation };
}

export const auditQuestions = [
  { key: "q1" as keyof AUDITInput, text: "Как часто вы употребляете алкоголь?", options: [
    { value: 0 as const, label: "Никогда" },
    { value: 1 as const, label: "Раз в месяц или реже" },
    { value: 2 as const, label: "2–4 раза в месяц" },
    { value: 3 as const, label: "2–3 раза в неделю" },
    { value: 4 as const, label: "4 раза в неделю и чаще" },
  ]},
  { key: "q2" as keyof AUDITInput, text: "Сколько доз алкоголя вы обычно выпиваете за один раз?", options: [
    { value: 0 as const, label: "1–2 дозы" },
    { value: 1 as const, label: "3–4 дозы" },
    { value: 2 as const, label: "5–6 доз" },
    { value: 3 as const, label: "7–9 доз" },
    { value: 4 as const, label: "10 доз и более" },
  ]},
  { key: "q3" as keyof AUDITInput, text: "Как часто за один раз вы выпиваете 6 или более доз?", options: [
    { value: 0 as const, label: "Никогда" },
    { value: 1 as const, label: "Реже раза в месяц" },
    { value: 2 as const, label: "Ежемесячно" },
    { value: 3 as const, label: "Еженедельно" },
    { value: 4 as const, label: "Ежедневно или почти ежедневно" },
  ]},
  { key: "q4" as keyof AUDITInput, text: "Как часто за последний год вы не могли остановиться, начав пить?", options: [
    { value: 0 as const, label: "Никогда" },
    { value: 1 as const, label: "Реже раза в месяц" },
    { value: 2 as const, label: "Ежемесячно" },
    { value: 3 as const, label: "Еженедельно" },
    { value: 4 as const, label: "Ежедневно или почти ежедневно" },
  ]},
  { key: "q5" as keyof AUDITInput, text: "Как часто из-за алкоголя вы не выполняли то, что от вас ожидалось?", options: [
    { value: 0 as const, label: "Никогда" },
    { value: 1 as const, label: "Реже раза в месяц" },
    { value: 2 as const, label: "Ежемесячно" },
    { value: 3 as const, label: "Еженедельно" },
    { value: 4 as const, label: "Ежедневно или почти ежедневно" },
  ]},
  { key: "q6" as keyof AUDITInput, text: "Как часто вам требовался алкоголь с утра, чтобы прийти в себя?", options: [
    { value: 0 as const, label: "Никогда" },
    { value: 1 as const, label: "Реже раза в месяц" },
    { value: 2 as const, label: "Ежемесячно" },
    { value: 3 as const, label: "Еженедельно" },
    { value: 4 as const, label: "Ежедневно или почти ежедневно" },
  ]},
  { key: "q7" as keyof AUDITInput, text: "Как часто вы испытывали чувство вины или раскаяния после выпивки?", options: [
    { value: 0 as const, label: "Никогда" },
    { value: 1 as const, label: "Реже раза в месяц" },
    { value: 2 as const, label: "Ежемесячно" },
    { value: 3 as const, label: "Еженедельно" },
    { value: 4 as const, label: "Ежедневно или почти ежедневно" },
  ]},
  { key: "q8" as keyof AUDITInput, text: "Как часто вы не могли вспомнить, что было накануне из-за выпивки?", options: [
    { value: 0 as const, label: "Никогда" },
    { value: 1 as const, label: "Реже раза в месяц" },
    { value: 2 as const, label: "Ежемесячно" },
    { value: 3 as const, label: "Еженедельно" },
    { value: 4 as const, label: "Ежедневно или почти ежедневно" },
  ]},
  { key: "q9" as keyof AUDITInput, text: "Случались ли травмы у вас или кого-либо из-за вашего употребления алкоголя?", options: [
    { value: 0 as const, label: "Нет" },
    { value: 2 as const, label: "Да, но не за последний год" },
    { value: 4 as const, label: "Да, за последний год" },
  ]},
  { key: "q10" as keyof AUDITInput, text: "Выражал ли кто-нибудь обеспокоенность вашим употреблением алкоголя?", options: [
    { value: 0 as const, label: "Нет" },
    { value: 2 as const, label: "Да, но не за последний год" },
    { value: 4 as const, label: "Да, за последний год" },
  ]},
];
