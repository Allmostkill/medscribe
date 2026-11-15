// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/framingham.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type FraminghamInput = {
  sex: "male" | "female";
  age: number;
  totalChol: number; // mg/dL
  hdl: number; // mg/dL
  sbp: number; // mmHg
  treatedHtn: boolean;
  smoker: boolean;
  diabetic: boolean;
};

export type FraminghamResult = {
  risk10year: number; // percentage
  heartAge: number; // years
  interpretation: string;
  severity: "normal" | "warning" | "error";
  color: string;
};

// Framingham 2008 gender-specific point scoring
function getAgePoints(age: number, sex: "male" | "female"): number {
  if (sex === "male") {
    if (age < 35) return -9;
    if (age < 40) return -4;
    if (age < 45) return 0;
    if (age < 50) return 3;
    if (age < 55) return 6;
    if (age < 60) return 8;
    if (age < 65) return 10;
    if (age < 70) return 11;
    if (age < 75) return 12;
    return 13;
  } else {
    if (age < 35) return -7;
    if (age < 40) return -3;
    if (age < 45) return 0;
    if (age < 50) return 3;
    if (age < 55) return 6;
    if (age < 60) return 8;
    if (age < 65) return 10;
    if (age < 70) return 12;
    if (age < 75) return 14;
    return 16;
  }
}

function getCholPoints(chol: number, age: number, sex: "male" | "female"): number {
  const ageGroup = age < 40 ? 0 : age < 50 ? 1 : age < 60 ? 2 : age < 70 ? 3 : 4;

  const maleTable = [
    [0, 4, 7, 9, 11], // <160, 160-199, 200-239, 240-279, ≥280
    [0, 3, 5, 6, 8],
    [0, 2, 3, 4, 5],
    [0, 1, 1, 2, 3],
    [0, 0, 0, 1, 1],
  ];

  const femaleTable = [
    [0, 4, 8, 11, 13],
    [0, 3, 6, 8, 10],
    [0, 2, 4, 5, 7],
    [0, 1, 2, 3, 4],
    [0, 1, 1, 2, 2],
  ];

  const table = sex === "male" ? maleTable : femaleTable;
  const cholIdx =
    chol < 160 ? 0 : chol < 200 ? 1 : chol < 240 ? 2 : chol < 280 ? 3 : 4;

  return table[ageGroup][cholIdx];
}

function getHDLPoints(hdl: number): number {
  if (hdl >= 60) return -1;
  if (hdl >= 50) return 0;
  if (hdl >= 40) return 1;
  return 2;
}

function getSBPPoints(sbp: number, treated: boolean, sex: "male" | "female"): number {
  if (sex === "male") {
    if (treated) {
      if (sbp < 120) return 0;
      if (sbp < 130) return 2;
      if (sbp < 140) return 3;
      if (sbp < 160) return 4;
      return 5;
    } else {
      if (sbp < 120) return -2;
      if (sbp < 130) return 0;
      if (sbp < 140) return 1;
      if (sbp < 160) return 2;
      return 3;
    }
  } else {
    if (treated) {
      if (sbp < 120) return -1;
      if (sbp < 130) return 2;
      if (sbp < 140) return 3;
      if (sbp < 150) return 5;
      if (sbp < 160) return 6;
      return 7;
    } else {
      if (sbp < 120) return -3;
      if (sbp < 130) return 0;
      if (sbp < 140) return 1;
      if (sbp < 150) return 2;
      if (sbp < 160) return 4;
      return 5;
    }
  }
}

function getSmokerPoints(smoker: boolean, age: number, sex: "male" | "female"): number {
  if (!smoker) return 0;
  if (sex === "male") {
    if (age < 40) return 9;
    if (age < 50) return 7;
    if (age < 60) return 4;
    if (age < 70) return 2;
    return 1;
  } else {
    if (age < 40) return 9;
    if (age < 50) return 7;
    if (age < 60) return 4;
    if (age < 70) return 2;
    return 1;
  }
}

function pointsToRisk(points: number, sex: "male" | "female"): number {
  const maleTable: Record<string, number> = {
    "-3": 1, "-2": 1, "-1": 2, "0": 5, "1": 5, "2": 6, "3": 8, "4": 10,
    "5": 13, "6": 16, "7": 20, "8": 25, "9": 31, "10": 37, "11": 45, "12": 53,
  };
  const femaleTable: Record<string, number> = {
    "-2": 1, "-1": 2, "0": 3, "1": 4, "2": 4, "3": 5, "4": 6, "5": 7,
    "6": 8, "7": 10, "8": 11, "9": 14, "10": 17, "11": 20, "12": 24, "13": 27,
    "14": 32, "15": 37, "16": 43, "17": 50,
  };

  const table = sex === "male" ? maleTable : femaleTable;
  const clamped = Math.max(-3, Math.min(points, sex === "male" ? 12 : 17));
  return table[String(clamped)] ?? (clamped < -3 ? 1 : 55);
}

export function calculateFramingham(input: FraminghamInput): FraminghamResult {
  const { sex, age, totalChol, hdl, sbp, treatedHtn, smoker, diabetic } = input;

  let points = 0;
  points += getAgePoints(age, sex);
  points += getCholPoints(totalChol, age, sex);
  points += getHDLPoints(hdl);
  points += getSBPPoints(sbp, treatedHtn, sex);
  points += getSmokerPoints(smoker, age, sex);
  if (diabetic) points += sex === "male" ? 3 : 4;

  const risk10year = pointsToRisk(points, sex);

  // Heart age: reverse-lookup
  const heartAge = Math.round(age + (risk10year - pointsToRisk(getAgePoints(age, sex), sex)));

  let interpretation: string;
  let severity: "normal" | "warning" | "error";
  let color: string;

  if (risk10year < 10) {
    interpretation = "Низкий 10-летний риск ССЗ";
    severity = "normal";
    color = "success";
  } else if (risk10year < 20) {
    interpretation = "Умеренный 10-летний риск ССЗ";
    severity = "warning";
    color = "warning";
  } else {
    interpretation = "Высокий 10-летний риск ССЗ";
    severity = "error";
    color = "error";
  }

  return { risk10year, heartAge, interpretation, severity, color };
}
