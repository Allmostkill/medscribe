// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/transfusion_trigger.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type TransfusionTriggerInput = {
  hgb: number;          // g/dL
  clinicalStatus: "stable" | "acs" | "cardiac_surgery" | "icu" | "orthopedic";
  symptoms: boolean;    // Symptomatic anemia (dyspnea, chest pain, hemodynamic instability)
};

export type TransfusionTriggerResult = {
  recommendation: string;
  trigger: string;
  severity: "normal" | "warning" | "error";
  rationale: string;
};

export function calculateTransfusionTrigger(input: TransfusionTriggerInput): TransfusionTriggerResult {
  const { hgb, clinicalStatus, symptoms } = input;

  if (symptoms && hgb < 10) {
    return {
      trigger: "Симптоматическая анемия",
      recommendation: "Трансфузия показана",
      severity: "error",
      rationale: "Симптоматическая анемия требует коррекции независимо от порогового значения",
    };
  }

  if (clinicalStatus === "acs") {
    if (hgb < 10) {
      return {
        trigger: "Гемоглобин < 10 г/дл при ОКС",
        recommendation: "Трансфузия обоснована",
        severity: "error",
        rationale: "При ОКС рекомендуется более либеральная стратегия (порог ~10 г/дл)",
      };
    } else {
      return {
        trigger: `Гемоглобин ${hgb} г/дл`,
        recommendation: "Трансфузия не показана",
        severity: "normal",
        rationale: "Гемоглобин выше порога для ОКС (10 г/дл)",
      };
    }
  }

  if (hgb < 7) {
    return {
      trigger: "Гемоглобин < 7 г/дл",
      recommendation: "Трансфузия показана",
      severity: "error",
      rationale: "Рестриктивный порог: < 7 г/дл (стабильные пациенты, хирургия, ОРИТ)",
    };
  } else if (hgb < 8) {
    return {
      trigger: "Гемоглобин 7–8 г/дл",
      recommendation: "Решение индивидуально",
      severity: "warning",
      rationale: "Учитывать клинические симптомы, сопутствующую патологию, хирургический риск",
    };
  } else {
    return {
      trigger: `Гемоглобин ${hgb} г/дл`,
      recommendation: "Трансфузия не показана",
      severity: "normal",
      rationale: "Гемоглобин выше стандартного порога трансфузии (8 г/дл)",
    };
  }
}
