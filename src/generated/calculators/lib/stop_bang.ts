// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/stop_bang.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type StopBangInput = {
  snoring: boolean;
  tired: boolean;
  observed: boolean;
  pressure: boolean;
  bmi: boolean;
  age: boolean;
  neck: boolean;
  gender: boolean;
};

export type StopBangResult = {
  score: number;
  risk: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateStopBang(input: StopBangInput): StopBangResult {
  const score = Object.values(input).filter(Boolean).length;

  if (score <= 2) {
    return {
      score,
      risk: "Низкий",
      interpretation: "Низкий риск СОАС",
      severity: "normal",
      recommendation: "Дополнительное обследование не требуется",
    };
  } else if (score <= 4) {
    return {
      score,
      risk: "Умеренный",
      interpretation: "Умеренный риск СОАС",
      severity: "warning",
      recommendation: "Рассмотреть полисомнографию или домашнее мониторирование сна",
    };
  } else {
    return {
      score,
      risk: "Высокий",
      interpretation: "Высокий риск СОАС",
      severity: "error",
      recommendation: "Направить на полисомнографию",
    };
  }
}

export const stopBangItems = [
  { key: "snoring" as keyof StopBangInput, label: "S — Храп", description: "Громко храпите (слышно через закрытую дверь)?" },
  { key: "tired" as keyof StopBangInput, label: "T — Усталость", description: "Часто чувствуете усталость, утомление или сонливость днём?" },
  { key: "observed" as keyof StopBangInput, label: "O — Наблюдение", description: "Кто-либо наблюдал остановки дыхания во время вашего сна?" },
  { key: "pressure" as keyof StopBangInput, label: "P — Давление", description: "Есть или лечите артериальную гипертензию?" },
  { key: "bmi" as keyof StopBangInput, label: "B — ИМТ", description: "ИМТ > 35 кг/м²?" },
  { key: "age" as keyof StopBangInput, label: "A — Возраст", description: "Возраст > 50 лет?" },
  { key: "neck" as keyof StopBangInput, label: "N — Шея", description: "Окружность шеи > 40 см?" },
  { key: "gender" as keyof StopBangInput, label: "G — Пол", description: "Мужской пол?" },
];
