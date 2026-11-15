// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/hads.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type HADSInput = {
  // Anxiety items (odd: 1,3,5,7,9,11,13)
  a1: 0 | 1 | 2 | 3; // Напряжение, взвинченность
  a3: 0 | 1 | 2 | 3; // Страх, ощущение надвигающегося ужаса
  a5: 0 | 1 | 2 | 3; // Тревожные мысли
  a7: 0 | 1 | 2 | 3; // Способность расслабиться (reversed)
  a9: 0 | 1 | 2 | 3; // Ощущение испуга
  a11: 0 | 1 | 2 | 3; // Беспокойство, суетливость
  a13: 0 | 1 | 2 | 3; // Внезапное ощущение паники
  // Depression items (even: 2,4,6,8,10,12,14)
  d2: 0 | 1 | 2 | 3;  // Получение удовольствия
  d4: 0 | 1 | 2 | 3;  // Способность смеяться
  d6: 0 | 1 | 2 | 3;  // Хорошее настроение (reversed)
  d8: 0 | 1 | 2 | 3;  // Замедленность
  d10: 0 | 1 | 2 | 3; // Интерес к внешнему виду
  d12: 0 | 1 | 2 | 3; // Предвкушение хорошего
  d14: 0 | 1 | 2 | 3; // Удовольствие от книг/ТВ
};

export type HADSSubscaleResult = {
  score: number;
  severity: "normal" | "warning" | "error";
  level: string;
};

export type HADSResult = {
  anxiety: HADSSubscaleResult;
  depression: HADSSubscaleResult;
};

export const hadsAnxietyQuestions = [
  {
    key: "a1",
    text: "Я испытываю напряжение, взвинченность",
    options: [
      { value: 3, label: "Всё время" },
      { value: 2, label: "Часто" },
      { value: 1, label: "Иногда" },
      { value: 0, label: "Совсем нет" },
    ],
  },
  {
    key: "a3",
    text: "Я испытываю страх, ощущение, что что-то ужасное вот-вот случится",
    options: [
      { value: 3, label: "Определённо и очень сильно" },
      { value: 2, label: "Да, но не слишком сильно" },
      { value: 1, label: "Немного и не слишком" },
      { value: 0, label: "Совсем нет" },
    ],
  },
  {
    key: "a5",
    text: "Беспокойные мысли крутятся у меня в голове",
    options: [
      { value: 3, label: "Большую часть времени" },
      { value: 2, label: "Часто" },
      { value: 1, label: "Иногда" },
      { value: 0, label: "Только иногда" },
    ],
  },
  {
    key: "a7",
    text: "Я могу легко сесть и расслабиться",
    options: [
      { value: 0, label: "Определённо да" },
      { value: 1, label: "Наверное да" },
      { value: 2, label: "Редко" },
      { value: 3, label: "Совсем не могу" },
    ],
  },
  {
    key: "a9",
    text: "Я испытываю ощущение испуга и паники",
    options: [
      { value: 3, label: "Очень часто" },
      { value: 2, label: "Довольно часто" },
      { value: 1, label: "Иногда" },
      { value: 0, label: "Совсем нет" },
    ],
  },
  {
    key: "a11",
    text: "Я чувствую беспокойство, и мне трудно усидеть на месте",
    options: [
      { value: 3, label: "Очень сильно" },
      { value: 2, label: "Довольно" },
      { value: 1, label: "Немного" },
      { value: 0, label: "Совсем нет" },
    ],
  },
  {
    key: "a13",
    text: "У меня бывает внезапное ощущение паники",
    options: [
      { value: 3, label: "Очень часто" },
      { value: 2, label: "Довольно часто" },
      { value: 1, label: "Нечасто" },
      { value: 0, label: "Совсем нет" },
    ],
  },
];

export const hadsDepressionQuestions = [
  {
    key: "d2",
    text: "То, что приносило мне большое удовольствие, и сейчас вызывает у меня такое же чувство",
    options: [
      { value: 0, label: "Определённо так" },
      { value: 1, label: "Наверное, это так" },
      { value: 2, label: "Лишь в очень малой степени" },
      { value: 3, label: "Это совсем не так" },
    ],
  },
  {
    key: "d4",
    text: "Я способен рассмеяться и увидеть в том или ином событии смешное",
    options: [
      { value: 0, label: "Как обычно" },
      { value: 1, label: "Немного меньше" },
      { value: 2, label: "Значительно меньше" },
      { value: 3, label: "Совсем нет" },
    ],
  },
  {
    key: "d6",
    text: "Я чувствую бодрость",
    options: [
      { value: 3, label: "Совсем не чувствую" },
      { value: 2, label: "Очень редко" },
      { value: 1, label: "Иногда" },
      { value: 0, label: "Большую часть времени" },
    ],
  },
  {
    key: "d8",
    text: "Мне кажется, что я стал всё делать очень медленно",
    options: [
      { value: 3, label: "Почти всегда" },
      { value: 2, label: "Часто" },
      { value: 1, label: "Иногда" },
      { value: 0, label: "Совсем нет" },
    ],
  },
  {
    key: "d10",
    text: "Я не слежу за своей внешностью",
    options: [
      { value: 3, label: "Определённо это так" },
      { value: 2, label: "Меньше, чем обычно" },
      { value: 1, label: "Возможно, я стал меньше уделять этому внимания" },
      { value: 0, label: "Я слежу столько же, что и раньше" },
    ],
  },
  {
    key: "d12",
    text: "Я с удовольствием жду предстоящих событий",
    options: [
      { value: 0, label: "Как и обычно" },
      { value: 1, label: "Немного меньше, чем обычно" },
      { value: 2, label: "Значительно меньше, чем обычно" },
      { value: 3, label: "Почти никогда" },
    ],
  },
  {
    key: "d14",
    text: "Я могу получить удовольствие от хорошей книги, радио- или телепрограммы",
    options: [
      { value: 0, label: "Часто" },
      { value: 1, label: "Иногда" },
      { value: 2, label: "Редко" },
      { value: 3, label: "Очень редко" },
    ],
  },
];

function subscaleResult(score: number): HADSSubscaleResult {
  if (score <= 7) {
    return { score, severity: "normal", level: "Норма" };
  } else if (score <= 10) {
    return { score, severity: "warning", level: "Субклинический уровень" };
  } else {
    return { score, severity: "error", level: "Клинически значимый уровень" };
  }
}

export function calculateHADS(input: HADSInput): HADSResult {
  const anxietyScore = input.a1 + input.a3 + input.a5 + input.a7 + input.a9 + input.a11 + input.a13;
  const depressionScore = input.d2 + input.d4 + input.d6 + input.d8 + input.d10 + input.d12 + input.d14;

  return {
    anxiety: subscaleResult(anxietyScore),
    depression: subscaleResult(depressionScore),
  };
}
