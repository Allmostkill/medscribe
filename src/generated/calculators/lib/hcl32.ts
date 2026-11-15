// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/hcl32.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

// HCL-32: Hypomania Checklist-32 (Angst et al., 2005)
// Patient self-report — 32 yes/no items
// Positive screen: ≥14 "yes" answers

export type HCL32Input = {
  q1:boolean; q2:boolean; q3:boolean; q4:boolean; q5:boolean; q6:boolean; q7:boolean; q8:boolean;
  q9:boolean; q10:boolean; q11:boolean; q12:boolean; q13:boolean; q14:boolean; q15:boolean; q16:boolean;
  q17:boolean; q18:boolean; q19:boolean; q20:boolean; q21:boolean; q22:boolean; q23:boolean; q24:boolean;
  q25:boolean; q26:boolean; q27:boolean; q28:boolean; q29:boolean; q30:boolean; q31:boolean; q32:boolean;
};

export type HCL32Result = {
  score: number;
  positive: boolean;
  severity: "normal" | "warning" | "error";
  level: string;
  description: string;
  activatingCount: number;
  inhibitingCount: number;
};

// Activating symptoms (1–16): energy, creativity, sociability
export const HCL32_ACTIVATING = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
// Inhibiting/risk symptoms (17–32): impulsivity, irritability, negative consequences
export const HCL32_INHIBITING = [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32];

export const hcl32Questions: { key: keyof HCL32Input; text: string }[] = [
  { key: "q1",  text: "Мне нужно меньше сна" },
  { key: "q2",  text: "Я чувствую себя более энергичным и активным" },
  { key: "q3",  text: "Я более уверен в себе" },
  { key: "q4",  text: "Мне больше нравится моя работа" },
  { key: "q5",  text: "Я более общителен: больше звоню, чаще выхожу из дома" },
  { key: "q6",  text: "Я хочу путешествовать и/или на самом деле путешествую больше" },
  { key: "q7",  text: "Я склонен ездить быстрее или рисковать за рулём" },
  { key: "q8",  text: "Я трачу больше денег или слишком много денег" },
  { key: "q9",  text: "Я больше рискую в повседневной жизни — на работе или в других делах" },
  { key: "q10", text: "Я физически более активен: спорт и т.д." },
  { key: "q11", text: "Я строю больше планов и проектов" },
  { key: "q12", text: "У меня больше идей, я более творческий" },
  { key: "q13", text: "Я менее стеснительный или скованный" },
  { key: "q14", text: "Я ношу более яркую и экстравагантную одежду или делаю более заметный макияж" },
  { key: "q15", text: "Я хочу знакомиться и/или на самом деле знакомлюсь с большим числом людей" },
  { key: "q16", text: "У меня повышен интерес к сексу или сексуальное влечение" },
  { key: "q17", text: "Я более кокетлив или сексуально более активен" },
  { key: "q18", text: "Я говорю больше, чем обычно" },
  { key: "q19", text: "Я думаю быстрее" },
  { key: "q20", text: "Я больше шучу или каламбурю в разговоре" },
  { key: "q21", text: "Я легко отвлекаюсь" },
  { key: "q22", text: "Я берусь за несколько проектов одновременно" },
  { key: "q23", text: "Я сплю меньше и при этом не чувствую нехватки сна" },
  { key: "q24", text: "Моё настроение ненормальное: другие замечают, что я не похож на себя" },
  { key: "q25", text: "Я ем больше" },
  { key: "q26", text: "Я более нетерпелив или легче раздражаюсь" },
  { key: "q27", text: "Я могу быть утомительным или раздражающим для окружающих" },
  { key: "q28", text: "Я берусь за слишком много проектов и не всегда успеваю их завершить" },
  { key: "q29", text: "У меня возникают трудности с концентрацией" },
  { key: "q30", text: "Мне бывает стыдно за своё поведение" },
  { key: "q31", text: "Я пью больше алкоголя" },
  { key: "q32", text: "Я принимаю больше лекарств: успокоительных, анксиолитиков, стимуляторов" },
];

export function calculateHCL32(input: HCL32Input): HCL32Result {
  const keys = Object.keys(input) as (keyof HCL32Input)[];
  const score = keys.filter((k) => input[k]).length;

  const activatingCount = HCL32_ACTIVATING.filter((n) => input[`q${n}` as keyof HCL32Input]).length;
  const inhibitingCount = HCL32_INHIBITING.filter((n) => input[`q${n}` as keyof HCL32Input]).length;

  const positive = score >= 14;

  if (score < 14) {
    return {
      score,
      positive: false,
      severity: "normal",
      level: "Скрининг отрицательный",
      description: `${score} из 32 — ниже порога гипомании (порог ≥14)`,
      activatingCount,
      inhibitingCount,
    };
  } else if (score <= 20) {
    return {
      score,
      positive: true,
      severity: "warning",
      level: "Вероятный биполярный спектр",
      description: `${score} из 32 — выше диагностического порога (≥14)`,
      activatingCount,
      inhibitingCount,
    };
  } else {
    return {
      score,
      positive: true,
      severity: "error",
      level: "Высокая вероятность биполярного спектра",
      description: `${score} из 32 — значительно выше порога (≥14)`,
      activatingCount,
      inhibitingCount,
    };
  }
}
