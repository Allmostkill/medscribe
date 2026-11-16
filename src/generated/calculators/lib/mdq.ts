// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/mdq.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type MDQInput = {
  // Part 1: 13 yes/no symptom questions
  p1q1: boolean;
  p1q2: boolean;
  p1q3: boolean;
  p1q4: boolean;
  p1q5: boolean;
  p1q6: boolean;
  p1q7: boolean;
  p1q8: boolean;
  p1q9: boolean;
  p1q10: boolean;
  p1q11: boolean;
  p1q12: boolean;
  p1q13: boolean;
  // Part 2: Did several occur at same time?
  part2: boolean;
  // Part 3: How much did these cause problems?
  part3: 0 | 1 | 2 | 3; // 0=no problem, 1=minor, 2=moderate, 3=serious
};

export type MDQResult = {
  part1Count: number;
  part1Positive: boolean;
  part2Positive: boolean;
  part3Positive: boolean;
  overallPositive: boolean;
  severity: "normal" | "warning" | "error";
  level: string;
  recommendation: string;
};

export const mdqPart1Questions = [
  { key: "p1q1", text: "Вы ощущали себя настолько хорошо или «на подъёме», что другие люди считали, что вы не в себе, или вы из-за этого попадали в неприятности?" },
  { key: "p1q2", text: "Вы были настолько взбудоражены, что неприятности казались незначительными?" },
  { key: "p1q3", text: "Вы были более самоуверенны, чем обычно?" },
  { key: "p1q4", text: "Вы спали меньше обычного и не чувствовали усталости?" },
  { key: "p1q5", text: "Вы были более разговорчивы или говорили быстрее обычного?" },
  { key: "p1q6", text: "Мысли в голове роились и перескакивали одна на другую?" },
  { key: "p1q7", text: "Вы легко отвлекались на посторонние вещи?" },
  { key: "p1q8", text: "Вы были более энергичны, чем обычно?" },
  { key: "p1q9", text: "Вы были более активны или делали больше обычного?" },
  { key: "p1q10", text: "Вы были более общительны или экстравертированы, чем обычно?" },
  { key: "p1q11", text: "Вы больше, чем обычно, интересовались сексом?" },
  { key: "p1q12", text: "Вы делали вещи необычные для вас или которые другие считали чрезмерными?" },
  { key: "p1q13", text: "Вы тратили деньги, что вызывало затруднения у вас или вашей семьи?" },
];

export const mdqPart3Options = [
  { value: 0, label: "Не создавало проблем" },
  { value: 1, label: "Незначительные проблемы" },
  { value: 2, label: "Умеренные проблемы" },
  { value: 3, label: "Серьёзные проблемы" },
];

export function calculateMDQ(input: MDQInput): MDQResult {
  const part1Keys = [
    "p1q1", "p1q2", "p1q3", "p1q4", "p1q5", "p1q6", "p1q7",
    "p1q8", "p1q9", "p1q10", "p1q11", "p1q12", "p1q13",
  ] as const;

  const part1Count = part1Keys.filter((k) => input[k]).length;
  const part1Positive = part1Count >= 7;
  const part2Positive = input.part2;
  const part3Positive = input.part3 >= 2;

  const overallPositive = part1Positive && part2Positive && part3Positive;

  if (overallPositive) {
    return {
      part1Count, part1Positive, part2Positive, part3Positive, overallPositive,
      severity: "error",
      level: "Положительный скрининг на биполярное расстройство",
      recommendation: "Необходима развёрнутая психиатрическая оценка. Чувствительность ~73%, специфичность ~90% для БАР I.",
    };
  } else {
    return {
      part1Count, part1Positive, part2Positive, part3Positive, overallPositive,
      severity: "normal",
      level: "Отрицательный скрининг",
      recommendation: "Не отвечает критериям положительного скрининга MDQ",
    };
  }
}
