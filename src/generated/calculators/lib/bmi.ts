// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/bmi.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type BMIInput = {
  weight: number; // kg
  height: number; // cm
};

export type BMIResult = {
  bmi: number;
  category: string;
  severity: "normal" | "warning" | "error";
  color: string;
  details: string;
};

export function calculateBMI(input: BMIInput): BMIResult {
  const heightM = input.height / 100;
  const bmi = input.weight / (heightM * heightM);
  const rounded = Math.round(bmi * 10) / 10;

  if (bmi < 18.5) {
    return {
      bmi: rounded,
      category: "Дефицит массы тела",
      severity: "warning",
      color: "warning",
      details: "ИМТ < 18.5",
    };
  } else if (bmi < 25) {
    return {
      bmi: rounded,
      category: "Норма",
      severity: "normal",
      color: "success",
      details: "ИМТ 18.5–24.9",
    };
  } else if (bmi < 30) {
    return {
      bmi: rounded,
      category: "Избыточная масса тела",
      severity: "warning",
      color: "warning",
      details: "ИМТ 25–29.9",
    };
  } else if (bmi < 35) {
    return {
      bmi: rounded,
      category: "Ожирение I степени",
      severity: "error",
      color: "error",
      details: "ИМТ 30–34.9",
    };
  } else if (bmi < 40) {
    return {
      bmi: rounded,
      category: "Ожирение II степени",
      severity: "error",
      color: "error",
      details: "ИМТ 35–39.9",
    };
  } else {
    return {
      bmi: rounded,
      category: "Ожирение III степени (морбидное)",
      severity: "error",
      color: "error",
      details: "ИМТ ≥ 40",
    };
  }
}
