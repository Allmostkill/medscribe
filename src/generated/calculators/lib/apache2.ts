// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/apache2.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type APACHE2Input = {
  // APS variables (use worst value in 24h)
  temp: number;        // °C
  map: number;         // mmHg
  heartRate: number;   // bpm
  rr: number;          // breaths/min
  // Oxygenation: FiO2 >= 0.5 → use A-a gradient; < 0.5 → use PaO2
  fio2: number;        // fraction e.g. 0.21 to 1.0
  pao2: number;        // mmHg (if FiO2 < 0.5)
  aaGradient: number;  // mmHg (if FiO2 >= 0.5)
  pH: number;
  sodium: number;      // mEq/L
  potassium: number;   // mEq/L
  creatinine: number;  // mg/dL
  acuteRenalFailure: boolean;
  hematocrit: number;  // %
  wbc: number;         // x1000/mm3
  gcs: number;         // 3-15
  // Patient info
  age: number;
  chronicHealth: "none" | "electivePostop" | "nonopEmergency";
};

export type APACHE2Result = {
  aps: number;
  agePoints: number;
  chronicPoints: number;
  total: number;
  predictedMortality: string;
  severity: "normal" | "warning" | "error";
  interpretation: string;
};

function tempPoints(t: number): number {
  if (t >= 41 || t < 30) return 4;
  if (t >= 39 || t < 32) return 3;
  if (t >= 38.5 || t < 34) return 1;
  if (t >= 36 && t <= 38.4) return 0;
  if (t >= 34 || t < 36) return 1;
  return 2;
}

function mapPoints(m: number): number {
  if (m >= 160 || m < 50) return 4;
  if (m >= 130 || m < 70) return 3;
  if (m >= 110 || (m >= 50 && m < 70)) return 2;
  return 0;
}

function hrPoints(hr: number): number {
  if (hr >= 180 || hr < 40) return 4;
  if (hr >= 140 || hr < 55) return 3;
  if (hr >= 110 || hr < 70) return 2;
  return 0;
}

function rrPoints(rr: number): number {
  if (rr >= 50 || rr < 6) return 4;
  if (rr >= 35) return 3;
  if (rr < 10) return 2;
  if (rr >= 25 || rr < 12) return 1;
  return 0;
}

function oxyPoints(fio2: number, pao2: number, aaGrad: number): number {
  if (fio2 >= 0.5) {
    if (aaGrad >= 500) return 4;
    if (aaGrad >= 350) return 3;
    if (aaGrad >= 200) return 2;
    return 0;
  } else {
    if (pao2 < 55) return 4;
    if (pao2 < 61) return 3;
    if (pao2 < 71) return 1;
    return 0;
  }
}

function phPoints(ph: number): number {
  if (ph >= 7.7 || ph < 7.15) return 4;
  if (ph >= 7.6 || ph < 7.25) return 3;
  if (ph < 7.33) return 2;
  if (ph >= 7.5) return 1;
  return 0;
}

function naPoints(na: number): number {
  if (na >= 180 || na < 111) return 4;
  if (na >= 160 || na < 120) return 3;
  if (na >= 155 || na < 130) return 2;
  if (na >= 150) return 1;
  return 0;
}

function kPoints(k: number): number {
  if (k >= 7 || k < 2.5) return 4;
  if (k >= 6 || k < 3) return 3;
  if (k < 3.5) return 2;
  if (k >= 5.5) return 1;
  return 0;
}

function creatPoints(cr: number, arf: boolean): number {
  let pts: number;
  if (cr >= 3.5) pts = 4;
  else if (cr >= 2.0) pts = 3;
  else if (cr >= 1.5) pts = 2;
  else if (cr < 0.6) pts = 2;
  else pts = 0;
  return arf ? pts * 2 : pts;
}

function hctPoints(hct: number): number {
  if (hct >= 60 || hct < 20) return 4;
  if (hct >= 50 || hct < 30) return 2;
  if (hct >= 46) return 1;
  return 0;
}

function wbcPoints(wbc: number): number {
  if (wbc >= 40 || wbc < 1) return 4;
  if (wbc >= 20 || wbc < 3) return 2;
  if (wbc >= 15) return 1;
  return 0;
}

function ageScore(age: number): number {
  if (age < 44) return 0;
  if (age <= 54) return 2;
  if (age <= 64) return 3;
  if (age <= 74) return 5;
  return 6;
}

export function calculateAPACHE2(input: APACHE2Input): APACHE2Result {
  const aps =
    tempPoints(input.temp) +
    mapPoints(input.map) +
    hrPoints(input.heartRate) +
    rrPoints(input.rr) +
    oxyPoints(input.fio2, input.pao2, input.aaGradient) +
    phPoints(input.pH) +
    naPoints(input.sodium) +
    kPoints(input.potassium) +
    creatPoints(input.creatinine, input.acuteRenalFailure) +
    hctPoints(input.hematocrit) +
    wbcPoints(input.wbc) +
    (15 - input.gcs);

  const agePoints = ageScore(input.age);

  let chronicPoints = 0;
  if (input.chronicHealth === "electivePostop") chronicPoints = 2;
  else if (input.chronicHealth === "nonopEmergency") chronicPoints = 5;

  const total = aps + agePoints + chronicPoints;

  let predictedMortality: string;
  let severity: "normal" | "warning" | "error";
  let interpretation: string;

  if (total < 10) {
    predictedMortality = "~5%";
    severity = "normal";
    interpretation = "Лёгкая степень";
  } else if (total < 20) {
    predictedMortality = "~15%";
    severity = "warning";
    interpretation = "Умеренная степень";
  } else if (total < 30) {
    predictedMortality = "~40%";
    severity = "warning";
    interpretation = "Тяжёлая";
  } else if (total < 35) {
    predictedMortality = "~70%";
    severity = "error";
    interpretation = "Очень тяжёлая";
  } else {
    predictedMortality = ">80%";
    severity = "error";
    interpretation = "Крайне тяжёлая";
  }

  return { aps, agePoints, chronicPoints, total, predictedMortality, severity, interpretation };
}
