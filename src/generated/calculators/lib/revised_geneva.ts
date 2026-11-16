// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/revised_geneva.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type RevisedGenevaInput = {
  age65: boolean;        // Age >65: +1
  previousPeDvt: boolean; // Previous PE/DVT: +3
  surgeryFracture: boolean; // Surgery or fracture past month: +2
  activeMalignancy: boolean; // Active malignancy: +2
  unilateralLegPain: boolean; // Unilateral leg pain: +3
  hemoptysis: boolean;   // Hemoptysis: +2
  hr75to94: boolean;     // HR 75-94: +3
  hr95plus: boolean;     // HR >=95: +5
  legPainPalpation: boolean; // Leg pain on palpation + edema: +4
};

export type RevisedGenevaResult = {
  score: number;
  probability: string;
  prevalence: string;
  interpretation: string;
  severity: "normal" | "warning" | "error";
  recommendation: string;
};

export function calculateRevisedGeneva(input: RevisedGenevaInput): RevisedGenevaResult {
  let score = 0;
  if (input.age65) score += 1;
  if (input.previousPeDvt) score += 3;
  if (input.surgeryFracture) score += 2;
  if (input.activeMalignancy) score += 2;
  if (input.unilateralLegPain) score += 3;
  if (input.hemoptysis) score += 2;
  if (input.hr75to94) score += 3;
  if (input.hr95plus) score += 5;
  if (input.legPainPalpation) score += 4;

  if (score <= 3) {
    return {
      score,
      probability: "Низкая",
      prevalence: "8%",
      interpretation: "Низкая вероятность ТЭЛА",
      severity: "normal",
      recommendation: "D-димер. При отрицательном результате — ТЭЛА исключена",
    };
  } else if (score <= 10) {
    return {
      score,
      probability: "Умеренная",
      prevalence: "29%",
      interpretation: "Умеренная вероятность ТЭЛА",
      severity: "warning",
      recommendation: "КТ-ангиография лёгочных артерий",
    };
  } else {
    return {
      score,
      probability: "Высокая",
      prevalence: "74%",
      interpretation: "Высокая вероятность ТЭЛА",
      severity: "error",
      recommendation: "КТ-ангиография немедленно; рассмотреть антикоагуляцию до результатов",
    };
  }
}

export const revisedGenevaItems = [
  { key: "age65" as keyof RevisedGenevaInput, label: "Возраст > 65 лет", points: "+1" },
  { key: "previousPeDvt" as keyof RevisedGenevaInput, label: "Ранее ТЭЛА или ТГВ", points: "+3" },
  { key: "surgeryFracture" as keyof RevisedGenevaInput, label: "Операция или перелом за последний месяц", points: "+2" },
  { key: "activeMalignancy" as keyof RevisedGenevaInput, label: "Активное злокачественное новообразование", points: "+2" },
  { key: "unilateralLegPain" as keyof RevisedGenevaInput, label: "Односторонняя боль в ноге", points: "+3" },
  { key: "hemoptysis" as keyof RevisedGenevaInput, label: "Кровохарканье", points: "+2" },
  { key: "hr75to94" as keyof RevisedGenevaInput, label: "ЧСС 75–94 уд/мин", points: "+3" },
  { key: "hr95plus" as keyof RevisedGenevaInput, label: "ЧСС ≥ 95 уд/мин", points: "+5" },
  { key: "legPainPalpation" as keyof RevisedGenevaInput, label: "Боль при пальпации + отёк ноги", points: "+4" },
];
