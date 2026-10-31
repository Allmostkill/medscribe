// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/sofa.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type SOFAInput = {
  // Respiration: PaO2/FiO2
  pfRatio: 0 | 1 | 2 | 3 | 4; // 0: >400, 1: 301-400, 2: 201-300, 3: 101-200, 4: ≤100
  // Coagulation: Platelets (×10³/μL)
  platelets: 0 | 1 | 2 | 3 | 4; // 0: >150, 1: 101-150, 2: 51-100, 3: 21-50, 4: ≤20
  // Liver: Bilirubin (mg/dL)
  bilirubin: 0 | 1 | 2 | 3 | 4; // 0: <1.2, 1: 1.2-1.9, 2: 2-5.9, 3: 6-11.9, 4: ≥12
  // Cardiovascular: MAP or vasopressors
  cardiovascular: 0 | 1 | 2 | 3 | 4; // 0: no, 1: MAP<70, 2: dopa≤5/dobu, 3: dopa>5/nor≤0.1, 4: dopa>15/nor>0.1
  // CNS: GCS
  cns: 0 | 1 | 2 | 3 | 4; // 0: 15, 1: 13-14, 2: 10-12, 3: 6-9, 4: <6
  // Renal: Creatinine (mg/dL)
  renal: 0 | 1 | 2 | 3 | 4; // 0: <1.2, 1: 1.2-1.9, 2: 2-3.4, 3: 3.5-4.9/UO<500, 4: >5/UO<200
};

export type SOFAResult = {
  score: number;
  mortality: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

export function calculateSOFA(input: SOFAInput): SOFAResult {
  const score =
    input.pfRatio +
    input.platelets +
    input.bilirubin +
    input.cardiovascular +
    input.cns +
    input.renal;

  if (score < 6) {
    return {
      score,
      mortality: "<10%",
      interpretation: "Минимальная органная дисфункция",
      severity: "normal",
      color: "success",
    };
  } else if (score <= 9) {
    return {
      score,
      mortality: "15–20%",
      interpretation: "Умеренная органная дисфункция",
      severity: "warning",
      color: "warning",
    };
  } else if (score <= 12) {
    return {
      score,
      mortality: "40–50%",
      interpretation: "Выраженная органная дисфункция",
      severity: "error",
      color: "error",
    };
  } else if (score <= 14) {
    return {
      score,
      mortality: "50–60%",
      interpretation: "Тяжёлая органная дисфункция",
      severity: "error",
      color: "error",
    };
  } else {
    return {
      score,
      mortality: ">80%",
      interpretation: "Крайне тяжёлая полиорганная недостаточность",
      severity: "error",
      color: "error",
    };
  }
}

export const sofaOptions = {
  pfRatio: [
    { value: 0, label: "> 400" },
    { value: 1, label: "301–400" },
    { value: 2, label: "201–300" },
    { value: 3, label: "101–200 (с ИВЛ)" },
    { value: 4, label: "≤ 100 (с ИВЛ)" },
  ],
  platelets: [
    { value: 0, label: "> 150 ×10³/мкл" },
    { value: 1, label: "101–150" },
    { value: 2, label: "51–100" },
    { value: 3, label: "21–50" },
    { value: 4, label: "≤ 20" },
  ],
  bilirubin: [
    { value: 0, label: "< 1.2 мг/дл" },
    { value: 1, label: "1.2–1.9" },
    { value: 2, label: "2.0–5.9" },
    { value: 3, label: "6.0–11.9" },
    { value: 4, label: "≥ 12.0" },
  ],
  cardiovascular: [
    { value: 0, label: "MAP ≥ 70 мм рт.ст." },
    { value: 1, label: "MAP < 70 мм рт.ст." },
    { value: 2, label: "Допамин ≤5 или Добутамин (любая доза)" },
    { value: 3, label: "Допамин >5 или Норадреналин ≤0.1 мкг/кг/мин" },
    { value: 4, label: "Допамин >15 или Норадреналин >0.1 мкг/кг/мин" },
  ],
  cns: [
    { value: 0, label: "ШКГ 15" },
    { value: 1, label: "ШКГ 13–14" },
    { value: 2, label: "ШКГ 10–12" },
    { value: 3, label: "ШКГ 6–9" },
    { value: 4, label: "ШКГ < 6" },
  ],
  renal: [
    { value: 0, label: "Кр < 1.2 мг/дл" },
    { value: 1, label: "Кр 1.2–1.9" },
    { value: 2, label: "Кр 2.0–3.4" },
    { value: 3, label: "Кр 3.5–4.9 или диурез < 500 мл/сут" },
    { value: 4, label: "Кр ≥ 5.0 или диурез < 200 мл/сут" },
  ],
};
