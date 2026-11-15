// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/timi.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type TIMIInput = {
  age65plus: boolean;
  riskFactors3plus: boolean;
  priorStenosis: boolean;
  stDeviation: boolean;
  anginalEvents: boolean;
  aspirinUse: boolean;
  elevatedMarkers: boolean;
};

export type TIMIResult = {
  score: number;
  risk: string;
  eventRate: string;
  recommendation: string;
  severity: "normal" | "warning" | "error";
};

export function calculateTIMI(input: TIMIInput): TIMIResult {
  const score =
    (input.age65plus ? 1 : 0) +
    (input.riskFactors3plus ? 1 : 0) +
    (input.priorStenosis ? 1 : 0) +
    (input.stDeviation ? 1 : 0) +
    (input.anginalEvents ? 1 : 0) +
    (input.aspirinUse ? 1 : 0) +
    (input.elevatedMarkers ? 1 : 0);

  if (score <= 2) {
    return {
      score,
      risk: "Низкий",
      eventRate: "4.7–8.3%",
      recommendation: "Низкий риск — возможна консервативная тактика",
      severity: "normal",
    };
  } else if (score <= 4) {
    return {
      score,
      risk: "Умеренный",
      eventRate: "13.2–19.9%",
      recommendation: "Умеренный риск — рассмотреть ранний инвазивный подход",
      severity: "warning",
    };
  } else {
    return {
      score,
      risk: "Высокий",
      eventRate: "26.2–40.9%",
      recommendation: "Высокий риск — ранняя инвазивная стратегия показана",
      severity: "error",
    };
  }
}
