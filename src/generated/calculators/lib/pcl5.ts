// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/pcl5.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type PCL5Input = {
  // Cluster B: Intrusion (items 1-5)
  q1: 0 | 1 | 2 | 3 | 4;  // Навязчивые воспоминания
  q2: 0 | 1 | 2 | 3 | 4;  // Ночные кошмары
  q3: 0 | 1 | 2 | 3 | 4;  // Флэшбэки
  q4: 0 | 1 | 2 | 3 | 4;  // Эмоциональная реакция на напоминания
  q5: 0 | 1 | 2 | 3 | 4;  // Физическая реакция на напоминания
  // Cluster C: Avoidance (items 6-7)
  q6: 0 | 1 | 2 | 3 | 4;  // Избегание мыслей
  q7: 0 | 1 | 2 | 3 | 4;  // Избегание внешних напоминаний
  // Cluster D: Negative alterations (items 8-14)
  q8: 0 | 1 | 2 | 3 | 4;  // Амнезия
  q9: 0 | 1 | 2 | 3 | 4;  // Негативные убеждения
  q10: 0 | 1 | 2 | 3 | 4; // Обвинение себя/других
  q11: 0 | 1 | 2 | 3 | 4; // Стойкие негативные эмоции
  q12: 0 | 1 | 2 | 3 | 4; // Утрата интереса
  q13: 0 | 1 | 2 | 3 | 4; // Отчуждённость
  q14: 0 | 1 | 2 | 3 | 4; // Ограниченные позитивные эмоции
  // Cluster E: Hyperarousal (items 15-20)
  q15: 0 | 1 | 2 | 3 | 4; // Раздражительность/вспышки
  q16: 0 | 1 | 2 | 3 | 4; // Безрассудное поведение
  q17: 0 | 1 | 2 | 3 | 4; // Гипербдительность
  q18: 0 | 1 | 2 | 3 | 4; // Повышенная реакция испуга
  q19: 0 | 1 | 2 | 3 | 4; // Трудности с концентрацией
  q20: 0 | 1 | 2 | 3 | 4; // Нарушения сна
};

export type PCL5Result = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
  clusterB: number;
  clusterC: number;
  clusterD: number;
  clusterE: number;
  provisionalPTSD: boolean;
};

export const pcl5Clusters = [
  {
    name: "Кластер B — Навязчивые воспоминания",
    items: [
      { key: "q1", text: "Повторяющиеся, тягостные воспоминания о травматическом событии" },
      { key: "q2", text: "Повторяющиеся тревожные сны о событии" },
      { key: "q3", text: "Внезапное ощущение или поведение, как будто событие происходит снова (флэшбэки)" },
      { key: "q4", text: "Сильное эмоциональное расстройство при напоминании о событии" },
      { key: "q5", text: "Сильные физические реакции при напоминании о событии" },
    ],
  },
  {
    name: "Кластер C — Избегание",
    items: [
      { key: "q6", text: "Избегание воспоминаний, мыслей или чувств, связанных с событием" },
      { key: "q7", text: "Избегание внешних напоминаний о событии (людей, мест, разговоров)" },
    ],
  },
  {
    name: "Кластер D — Негативные изменения",
    items: [
      { key: "q8", text: "Нарушение памяти на важные аспекты события" },
      { key: "q9", text: "Стойкие негативные убеждения о себе, других или мире" },
      { key: "q10", text: "Обвинение себя или других в событии или его последствиях" },
      { key: "q11", text: "Стойкие негативные эмоции (страх, ужас, гнев, вина, стыд)" },
      { key: "q12", text: "Значительно сниженный интерес к значимой деятельности" },
      { key: "q13", text: "Ощущение отчуждённости или оторванности от других" },
      { key: "q14", text: "Неспособность испытывать положительные эмоции" },
    ],
  },
  {
    name: "Кластер E — Гипервозбуждение",
    items: [
      { key: "q15", text: "Раздражительность или вспышки гнева, агрессивное поведение" },
      { key: "q16", text: "Безрассудное или саморазрушительное поведение" },
      { key: "q17", text: "Гипербдительность" },
      { key: "q18", text: "Повышенная реакция испуга" },
      { key: "q19", text: "Трудности с концентрацией" },
      { key: "q20", text: "Нарушения сна" },
    ],
  },
];

export const pcl5AnswerOptions = [
  { value: 0, label: "0 — совсем нет" },
  { value: 1, label: "1 — немного" },
  { value: 2, label: "2 — умеренно" },
  { value: 3, label: "3 — значительно" },
  { value: 4, label: "4 — чрезвычайно" },
];

export function calculatePCL5(input: PCL5Input): PCL5Result {
  const score = (Object.values(input) as number[]).reduce((a, b) => a + b, 0);

  const clusterB = input.q1 + input.q2 + input.q3 + input.q4 + input.q5;
  const clusterC = input.q6 + input.q7;
  const clusterD = input.q8 + input.q9 + input.q10 + input.q11 + input.q12 + input.q13 + input.q14;
  const clusterE = input.q15 + input.q16 + input.q17 + input.q18 + input.q19 + input.q20;

  const provisionalPTSD = score >= 33;

  if (provisionalPTSD) {
    return {
      score, severity: "error", level: "Вероятное ПТСР",
      recommendation: "Направление к специалисту, психотерапия (КПТ, EMDR)",
      clusterB, clusterC, clusterD, clusterE, provisionalPTSD,
    };
  } else {
    return {
      score, severity: "warning", level: "Ниже порога ПТСР",
      recommendation: "Наблюдение, оценить наличие других расстройств",
      clusterB, clusterC, clusterD, clusterE, provisionalPTSD,
    };
  }
}
