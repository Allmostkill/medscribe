// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/data.ts + обёртки
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export type CalcFieldKind = "number" | "boolean" | "select" | "text" | "date";

export interface CalcField {
  key: string;
  label: string;
  kind: CalcFieldKind;
  unit?: string;
  placeholder?: string;
  /** Норма или уточнение под полем. */
  hint?: string;
  /** Вклад в балл, как показано в MedCalc («+1», «+2»). */
  points?: string;
  step?: number;
  optional?: boolean;
  /** Заголовок группы: у PASI поля сгруппированы по областям тела. */
  group?: string;
  /** Значение, зафиксированное в MedCalc: врач его не вводит. */
  fixedValue?: number | boolean;
  options?: { value: string | number; label: string }[];
}

export interface CalcCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface CalcEntry {
  id: string;
  /** Основной раздел — по нему калькулятор показывается, если разделов один. */
  categoryId: string;
  /** Все разделы, включая пришедшие из записей-дубликатов каталога. */
  categories: string[];
  name: string;
  shortName?: string;
  type: "formula" | "scale" | "risk";
  description: string;
  featured?: boolean;
  /** Имя файла в ./lib без расширения. */
  module: string;
  /** Имя экспортированной функции расчёта в этом файле. */
  fn: string;
  citation?: string;
  /** Функция принимает одно число, а не объект (номограмма Купера). */
  scalarArg?: boolean;
  fields: CalcField[];
  /** Поля результата в порядке объявления; label — там, где он есть в MedCalc. */
  result: {
    key: string;
    label?: string;
    /** Заголовок подраздела: у вложенного результата (HADS) их два. */
    group?: string;
    /** Имя поля внутри подраздела. */
    subKey?: string;
    optional?: boolean;
    /** Значение-объект (Date, подшкала): блок такие поля не выводит. */
    nested?: boolean;
  }[];
}

export const calcCategories: CalcCategory[] = [
  {
    "id": "cardiology",
    "name": "Кардиология",
    "icon": "❤️",
    "description": "Риски, шкалы и расчёты в кардиологии"
  },
  {
    "id": "nephrology",
    "name": "Нефрология",
    "icon": "🫘",
    "description": "СКФ, электролиты, почечная функция"
  },
  {
    "id": "pulmonology",
    "name": "Пульмонология",
    "icon": "🫁",
    "description": "Дыхательная функция, ТЭЛА, пневмония"
  },
  {
    "id": "critical_care",
    "name": "ОРИТ",
    "icon": "🏥",
    "description": "Шкалы тяжести, сепсис, интенсивная терапия"
  },
  {
    "id": "gastro",
    "name": "Гастроэнтерология",
    "icon": "🫀",
    "description": "Печень, ЖКК, цирроз"
  },
  {
    "id": "endocrinology",
    "name": "Эндокринология",
    "icon": "⚗️",
    "description": "Метаболизм, питание, гормоны"
  },
  {
    "id": "neurology",
    "name": "Неврология",
    "icon": "🧠",
    "description": "Инсульт, кома, ТИА"
  },
  {
    "id": "trauma",
    "name": "Травматология",
    "icon": "🩹",
    "description": "Ожоги, травмы, ВТЭ"
  },
  {
    "id": "psychiatry",
    "name": "Психиатрия",
    "icon": "🧩",
    "description": "Депрессия, синдром отмены"
  },
  {
    "id": "obstetrics",
    "name": "Акушерство",
    "icon": "👶",
    "description": "Новорождённые, роды"
  },
  {
    "id": "oncology",
    "name": "Онкология",
    "icon": "🎗️",
    "description": "Дозирование, стадирование, прогноз в онкологии"
  },
  {
    "id": "rheumatology",
    "name": "Ревматология",
    "icon": "🦴",
    "description": "Активность заболеваний, диагностические критерии"
  },
  {
    "id": "dermatology",
    "name": "Дерматология",
    "icon": "🩹",
    "description": "Оценка тяжести кожных заболеваний"
  },
  {
    "id": "urology",
    "name": "Урология",
    "icon": "💧",
    "description": "Симптомы нижних мочевыводящих путей, ДГПЖ"
  },
  {
    "id": "pharmacology",
    "name": "Фармакология",
    "icon": "💊",
    "description": "Дозирование, мониторинг, конверсия препаратов"
  },
  {
    "id": "hematology",
    "name": "Гематология",
    "icon": "🩸",
    "description": "ДВС, ГИТ, показания к трансфузии"
  },
  {
    "id": "pediatrics",
    "name": "Педиатрия",
    "icon": "👶",
    "description": "Педиатрические дозы, жидкости, развитие"
  },
  {
    "id": "lab",
    "name": "Лабораторная диагностика",
    "icon": "🧪",
    "description": "КЩС, компенсации, коррекция лабораторных параметров"
  }
];

export const calcEntries: CalcEntry[] = [
  {
    "id": "cha2ds2vasc",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "CHA₂DS₂-VASc",
    "shortName": "CHA2DS2-VASc",
    "type": "scale",
    "description": "Риск инсульта при ФП",
    "featured": true,
    "module": "cha2ds2vasc",
    "fn": "calculateCHA2DS2VASC",
    "citation": "Lip GY, et al. Chest. 2010;137(2):263-272.",
    "fields": [
      {
        "key": "chf",
        "label": "ХСН / дисфункция ЛЖ",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "hypertension",
        "label": "Артериальная гипертензия",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "age75plus",
        "label": "Возраст ≥ 75 лет",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "diabetes",
        "label": "Сахарный диабет",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "strokeTia",
        "label": "Инсульт / ТИА / тромбоэмболия в анамнезе",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "vascular",
        "label": "Заболевания сосудов",
        "kind": "boolean",
        "hint": "ИМ, периферический атеросклероз, бляшки аорты",
        "points": "+1"
      },
      {
        "key": "age65to74",
        "label": "Возраст 65–74 года",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "female",
        "label": "Женский пол",
        "kind": "boolean",
        "points": "+1"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Счёт CHA₂DS₂-VASc"
      },
      {
        "key": "riskLevel"
      },
      {
        "key": "annualRisk",
        "label": "Годовой риск инсульта"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "hasbled",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "HAS-BLED",
    "type": "risk",
    "description": "Риск кровотечения на антикоагулянтах",
    "module": "hasbled",
    "fn": "calculateHASBLED",
    "citation": "Pisters R, et al. Chest. 2010;138(5):1093-1100.",
    "fields": [
      {
        "key": "hypertension",
        "label": "H — Гипертензия неконтролируемая (САД > 160)",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "renalLiver",
        "label": "A — Нарушение функции почек/печени",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "+1 — Одно нарушение"
          },
          {
            "value": 2,
            "label": "+2 — Оба нарушения"
          }
        ]
      },
      {
        "key": "stroke",
        "label": "S — Инсульт в анамнезе",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "bleedingHistory",
        "label": "B — Кровотечение в анамнезе или предрасположенность",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "labileInr",
        "label": "L — Лабильное МНО",
        "kind": "boolean",
        "hint": "Нестабильное, высокое или недостаточное время в терапевтическом диапазоне",
        "points": "+1"
      },
      {
        "key": "elderly",
        "label": "E — Пожилой возраст (> 65 лет)",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "drugsAlcohol",
        "label": "D — Препараты/алкоголь",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "+1 — Антиагреганты/НПВС или алкоголь"
          },
          {
            "value": 2,
            "label": "+2 — Оба фактора"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "HAS-BLED"
      },
      {
        "key": "riskLevel"
      },
      {
        "key": "annualBleedingRisk"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "heart_score",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "HEART Score",
    "type": "scale",
    "description": "Риск MACE при боли в груди",
    "module": "heart_score",
    "fn": "calculateHEARTScore",
    "citation": "Six AJ, et al. Neth Heart J. 2008;16(6):191-196.",
    "fields": [
      {
        "key": "history",
        "label": "H — History (Анамнез)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Слабо подозрительный (нетипичный)"
          },
          {
            "value": 1,
            "label": "1 — Умеренно подозрительный"
          },
          {
            "value": 2,
            "label": "2 — Высоко подозрительный (типичный)"
          }
        ]
      },
      {
        "key": "ecg",
        "label": "E — ECG (ЭКГ)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Норма"
          },
          {
            "value": 1,
            "label": "1 — Неспецифические изменения реполяризации"
          },
          {
            "value": 2,
            "label": "2 — Значимая девиация ST"
          }
        ]
      },
      {
        "key": "age",
        "label": "A — Age (Возраст)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Младше 45 лет"
          },
          {
            "value": 1,
            "label": "1 — 45–64 года"
          },
          {
            "value": 2,
            "label": "2 — 65 лет и старше"
          }
        ]
      },
      {
        "key": "riskFactors",
        "label": "R — Risk factors (Факторы риска)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет известных факторов риска"
          },
          {
            "value": 1,
            "label": "1 — 1–2 ФР или СД/АГ/дислипидемия"
          },
          {
            "value": 2,
            "label": "2 — ≥3 ФР или атеросклеротическое заболевание"
          }
        ]
      },
      {
        "key": "troponin",
        "label": "T — Troponin (Тропонин)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — ≤ верхней границы нормы"
          },
          {
            "value": 1,
            "label": "1 — 1–3× верхней границы нормы"
          },
          {
            "value": 2,
            "label": "2 — >3× верхней границы нормы"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "HEART Score"
      },
      {
        "key": "risk"
      },
      {
        "key": "maceRate",
        "label": "Риск MACE (30 дней)"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "grace",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "GRACE",
    "type": "scale",
    "description": "Прогноз при остром коронарном синдроме",
    "module": "grace",
    "fn": "calculateGRACE",
    "citation": "Fox KA, et al. Eur Heart J. 2006;27(24):2931-2937.",
    "fields": [
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "60",
        "hint": "18–110"
      },
      {
        "key": "heartRate",
        "label": "ЧСС",
        "kind": "number",
        "unit": "уд/мин",
        "placeholder": "80",
        "hint": "20–250"
      },
      {
        "key": "sbp",
        "label": "Систолическое АД",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "120",
        "hint": "40–250"
      },
      {
        "key": "creatinine",
        "label": "Креатинин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "1.0",
        "hint": "0.6–1.2",
        "step": 0.1
      },
      {
        "key": "killip",
        "label": "Класс Killip",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "I — Нет признаков СН"
          },
          {
            "value": 2,
            "label": "II — Хрипы, ритм галопа, венозная гипертензия"
          },
          {
            "value": 3,
            "label": "III — Отёк лёгких"
          },
          {
            "value": 4,
            "label": "IV — Кардиогенный шок"
          }
        ]
      },
      {
        "key": "cardiacArrest",
        "label": "Остановка сердца при поступлении",
        "kind": "boolean",
        "points": "+39"
      },
      {
        "key": "stDeviation",
        "label": "Девиация сегмента ST",
        "kind": "boolean",
        "points": "+28"
      },
      {
        "key": "elevatedEnzymes",
        "label": "Повышение кардиальных ферментов",
        "kind": "boolean",
        "points": "+14"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "GRACE Score"
      },
      {
        "key": "mortalityCategory"
      },
      {
        "key": "mortalityRange",
        "label": "Госпитальная смертность"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "map",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "Среднее АД",
    "shortName": "MAP",
    "type": "formula",
    "description": "Среднее артериальное давление",
    "featured": true,
    "module": "map",
    "fn": "calculateMAP",
    "citation": "Definition: Diastolic BP + (Systolic BP − Diastolic BP) / 3",
    "fields": [
      {
        "key": "sbp",
        "label": "Систолическое АД",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "120",
        "hint": "60–300"
      },
      {
        "key": "dbp",
        "label": "Диастолическое АД",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "80",
        "hint": "40–180"
      }
    ],
    "result": [
      {
        "key": "map",
        "label": "Среднее АД (MAP)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "qtc",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "QTc (Bazett)",
    "type": "formula",
    "description": "Корригированный интервал QT",
    "module": "qtc",
    "fn": "calculateQTc",
    "citation": "Bazett HC. Heart. 1920;7:353-370.",
    "fields": [
      {
        "key": "qt",
        "label": "Интервал QT",
        "kind": "number",
        "unit": "мс",
        "placeholder": "400",
        "hint": "350–450 мс"
      },
      {
        "key": "hr",
        "label": "ЧСС",
        "kind": "number",
        "unit": "уд/мин",
        "placeholder": "70",
        "hint": "20–300"
      },
      {
        "key": "sex",
        "label": "Пол",
        "kind": "select",
        "options": [
          {
            "value": "male",
            "label": "Мужской"
          },
          {
            "value": "female",
            "label": "Женский"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "qtc",
        "label": "QTc (Bazett)"
      },
      {
        "key": "rr",
        "label": "Интервал RR"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "framingham",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "Framingham",
    "type": "risk",
    "description": "10-летний риск ССЗ",
    "module": "framingham",
    "fn": "calculateFramingham",
    "citation": "D'Agostino RB, et al. Circulation. 2008;117(6):743-753.",
    "fields": [
      {
        "key": "sex",
        "label": "Пол",
        "kind": "select",
        "options": [
          {
            "value": "male",
            "label": "Мужской"
          },
          {
            "value": "female",
            "label": "Женский"
          }
        ]
      },
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "50",
        "hint": "30–79"
      },
      {
        "key": "totalChol",
        "label": "Общий холестерин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "200",
        "hint": "< 200"
      },
      {
        "key": "hdl",
        "label": "ХС-ЛПВП",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "50",
        "hint": "> 40 (м) / > 50 (ж)"
      },
      {
        "key": "sbp",
        "label": "Систолическое АД",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "130"
      },
      {
        "key": "treatedHtn",
        "label": "Леченная АГ",
        "kind": "boolean"
      },
      {
        "key": "smoker",
        "label": "Курение",
        "kind": "boolean"
      },
      {
        "key": "diabetic",
        "label": "Сахарный диабет",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "risk10year",
        "label": "10-летний риск ССЗ"
      },
      {
        "key": "heartAge",
        "label": "Сосудистый возраст"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "timi",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "TIMI",
    "type": "scale",
    "description": "Риск при ОКС без подъёма ST",
    "module": "timi",
    "fn": "calculateTIMI",
    "citation": "Antman EM, et al. JAMA. 2000;284(7):835-842.",
    "fields": [
      {
        "key": "age65plus",
        "label": "Возраст ≥ 65 лет",
        "kind": "boolean"
      },
      {
        "key": "riskFactors3plus",
        "label": "≥3 факторов риска ИБС",
        "kind": "boolean",
        "hint": "АГ, СД, дислипидемия, курение, семейный анамнез"
      },
      {
        "key": "priorStenosis",
        "label": "Стеноз коронарных артерий ≥50% ранее",
        "kind": "boolean"
      },
      {
        "key": "stDeviation",
        "label": "Девиация сегмента ST на ЭКГ",
        "kind": "boolean"
      },
      {
        "key": "anginalEvents",
        "label": "≥2 эпизодов стенокардии за 24 часа",
        "kind": "boolean"
      },
      {
        "key": "aspirinUse",
        "label": "Приём аспирина в последние 7 дней",
        "kind": "boolean"
      },
      {
        "key": "elevatedMarkers",
        "label": "Повышение кардиальных маркёров",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "TIMI Score UA/NSTEMI"
      },
      {
        "key": "risk"
      },
      {
        "key": "eventRate",
        "label": "14-дневный риск событий"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "cockcroft_gault",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "Cockcroft-Gault",
    "type": "formula",
    "description": "Клиренс креатинина",
    "module": "cockcroft_gault",
    "fn": "calculateCockcroftGault",
    "citation": "Cockcroft DW, Gault MH. Nephron. 1976;16(1):31-41.",
    "fields": [
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "55",
        "hint": "18–120"
      },
      {
        "key": "weight",
        "label": "Масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70",
        "hint": "3–300 кг"
      },
      {
        "key": "scr",
        "label": "Креатинин сыворотки",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "1.0",
        "hint": "0.5–15"
      },
      {
        "key": "sex",
        "label": "Пол",
        "kind": "select",
        "options": [
          {
            "value": "male",
            "label": "Мужской"
          },
          {
            "value": "female",
            "label": "Женский"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "crcl",
        "label": "Клиренс креатинина"
      },
      {
        "key": "stage"
      },
      {
        "key": "stageNumber"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "ckd_epi",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "CKD-EPI 2021",
    "type": "formula",
    "description": "СКФ (расчётная)",
    "module": "ckd_epi",
    "fn": "calculateCKDEPI",
    "citation": "Inker LA, et al. N Engl J Med. 2021;385(19):1737-1749.",
    "fields": [
      {
        "key": "scr",
        "label": "Креатинин сыворотки",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "1.0",
        "hint": "0.5–15"
      },
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "55"
      },
      {
        "key": "sex",
        "label": "Пол",
        "kind": "select",
        "options": [
          {
            "value": "male",
            "label": "Мужской"
          },
          {
            "value": "female",
            "label": "Женский"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "egfr",
        "label": "рСКФ (CKD-EPI 2021)"
      },
      {
        "key": "stage"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "mdrd",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "MDRD",
    "type": "formula",
    "description": "СКФ (упрощённая формула)",
    "module": "mdrd",
    "fn": "calculateMDRD",
    "citation": "Levey AS, et al. Ann Intern Med. 1999;130(6):461-470.",
    "fields": [
      {
        "key": "creatinine",
        "label": "Креатинин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "1.0",
        "hint": "0.6–1.2",
        "step": 0.01
      },
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "55",
        "hint": "18–110"
      },
      {
        "key": "female",
        "label": "Женский пол (×0.742)",
        "kind": "boolean"
      },
      {
        "key": "black",
        "label": "Афроамериканец (×1.212)",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "egfr",
        "label": "СКФ (MDRD)"
      },
      {
        "key": "stage",
        "label": "Стадия ХБП"
      },
      {
        "key": "stageDescription"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "anion_gap",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "Анионный промежуток",
    "shortName": "Anion Gap",
    "type": "formula",
    "description": "Анионный промежуток ± коррекция на альбумин",
    "module": "anion_gap",
    "fn": "calculateAnionGap",
    "citation": "Seifter JL. N Engl J Med. 2014;371:1434-1445.",
    "fields": [
      {
        "key": "na",
        "label": "Натрий (Na⁺)",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "140",
        "hint": "136–145"
      },
      {
        "key": "cl",
        "label": "Хлор (Cl⁻)",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "103",
        "hint": "98–106"
      },
      {
        "key": "hco3",
        "label": "Бикарбонат (HCO₃⁻)",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "24",
        "hint": "22–29"
      },
      {
        "key": "albumin",
        "label": "Альбумин (для коррекции)",
        "kind": "number",
        "unit": "г/дл",
        "placeholder": "4.0 (необязательно)",
        "hint": "3.5–5.0",
        "optional": true
      }
    ],
    "result": [
      {
        "key": "ag",
        "label": "Анионный промежуток"
      },
      {
        "key": "correctedAg",
        "label": "Скорректированный AP",
        "optional": true
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "hasAlbuminCorrection"
      }
    ]
  },
  {
    "id": "fena",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "FENa",
    "type": "formula",
    "description": "Фракционная экскреция натрия",
    "module": "fena",
    "fn": "calculateFENa",
    "citation": "Miller TR, et al. Ann Intern Med. 1978;89:47-50.",
    "fields": [
      {
        "key": "uNa",
        "label": "Na⁺ мочи",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "20"
      },
      {
        "key": "pCr",
        "label": "Креатинин плазмы",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "2.0"
      },
      {
        "key": "pNa",
        "label": "Na⁺ плазмы",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "140",
        "hint": "136–145"
      },
      {
        "key": "uCr",
        "label": "Креатинин мочи",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "80"
      }
    ],
    "result": [
      {
        "key": "fena",
        "label": "FENa"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "cause"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "serum_osm",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "Осмоляльность сыворотки",
    "shortName": "Serum Osm",
    "type": "formula",
    "description": "Расчётная осмоляльность и осмолярный разрыв",
    "module": "serum_osm",
    "fn": "calculateSerumOsm",
    "citation": "Bhagat CI, et al. Clin Chem. 1984;30(7):1268-1269.",
    "fields": [
      {
        "key": "na",
        "label": "Натрий (Na⁺)",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "140",
        "hint": "136–145"
      },
      {
        "key": "glucose",
        "label": "Глюкоза",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "90",
        "hint": "70–100 мг/дл"
      },
      {
        "key": "bun",
        "label": "Мочевина (BUN)",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "14",
        "hint": "7–20 мг/дл"
      },
      {
        "key": "measured",
        "label": "Измеренная осмоляльность (опционально)",
        "kind": "number",
        "unit": "мОсм/кг",
        "placeholder": "290",
        "hint": "275–295",
        "optional": true
      }
    ],
    "result": [
      {
        "key": "calculated",
        "label": "Расчётная осмоляльность"
      },
      {
        "key": "osmolalGap",
        "label": "Осмолярный разрыв",
        "optional": true
      },
      {
        "key": "interpretation"
      },
      {
        "key": "gapInterpretation",
        "optional": true
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "corrected_na",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "Корригированный Na⁺",
    "shortName": "Corrected Na",
    "type": "formula",
    "description": "Коррекция натрия при гипергликемии",
    "module": "corrected_na",
    "fn": "calculateCorrectedNa",
    "citation": "Katz MA. N Engl J Med. 1973;289(16):843-844. (коэф. 2.4 при глюкозе >400)",
    "fields": [
      {
        "key": "measuredNa",
        "label": "Измеренный натрий",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "138",
        "hint": "135–145"
      },
      {
        "key": "glucose",
        "label": "Глюкоза",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "200",
        "hint": ">100 мг/дл вызывает гипонатриемию"
      }
    ],
    "result": [
      {
        "key": "correctedNa",
        "label": "Корригированный Na⁺"
      },
      {
        "key": "correction",
        "label": "Поправка"
      },
      {
        "key": "glucoseMMOL",
        "label": "Глюкоза"
      },
      {
        "key": "coefficient"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "wells_pe",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "Wells (ТЭЛА)",
    "shortName": "Wells PE",
    "type": "scale",
    "description": "Вероятность тромбоэмболии лёгочной артерии",
    "module": "wells_pe",
    "fn": "calculateWellsPE",
    "citation": "Wells PS, et al. Thromb Haemost. 2000;83(3):416-420.",
    "fields": [
      {
        "key": "dvtSigns",
        "label": "Клинические признаки ТГВ",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "altDxLikely",
        "label": "ТЭЛА вероятнее альтернативного диагноза",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "hr100plus",
        "label": "ЧСС > 100 уд/мин",
        "kind": "boolean",
        "points": "+1.5"
      },
      {
        "key": "immobilization",
        "label": "Иммобилизация ≥ 3 дней или операция в последние 4 недели",
        "kind": "boolean",
        "points": "+1.5"
      },
      {
        "key": "priorDvtPe",
        "label": "ТЭЛА или ТГВ в анамнезе",
        "kind": "boolean",
        "points": "+1.5"
      },
      {
        "key": "hemoptysis",
        "label": "Кровохарканье",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "malignancy",
        "label": "Онкологическое заболевание (активное или лечение в течение 6 мес)",
        "kind": "boolean",
        "points": "+1"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Шкала Wells (ТЭЛА)"
      },
      {
        "key": "probabilityClassic"
      },
      {
        "key": "probabilityBinary",
        "label": "Двухуровневая шкала"
      },
      {
        "key": "percentRiskClassic"
      },
      {
        "key": "percentRiskBinary"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "wells_dvt",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "Wells (ТГВ)",
    "shortName": "Wells DVT",
    "type": "scale",
    "description": "Вероятность тромбоза глубоких вен",
    "module": "wells_dvt",
    "fn": "calculateWellsDVT",
    "citation": "Wells PS, et al. Lancet. 1997;350(9094):1795-1798.",
    "fields": [
      {
        "key": "activeCancer",
        "label": "Активное онкологическое заболевание",
        "kind": "boolean",
        "hint": "Лечение или паллиатив в течение 6 мес",
        "points": "+1"
      },
      {
        "key": "paralysisParesis",
        "label": "Паралич, парез, иммобилизация ноги",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "bedridden",
        "label": "Постельный режим >3 дней или операция в 12 нед",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "deepVeinTenderness",
        "label": "Болезненность по ходу глубоких вен",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "entireLegSwollen",
        "label": "Отёк всей ноги",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "calfSwelling",
        "label": "Голень >3 см больше контралатеральной",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "pittingEdema",
        "label": "Ямочный отёк на поражённой ноге",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "collateralVeins",
        "label": "Коллатеральные поверхностные вены",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "previousDVT",
        "label": "Документированный ТГВ ранее",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "alternativeDiagnosis",
        "label": "Альтернативный диагноз не менее вероятен",
        "kind": "boolean",
        "points": "−2"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Wells Score DVT"
      },
      {
        "key": "probability"
      },
      {
        "key": "dvtRate",
        "label": "Вероятность ТГВ"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "curb65",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "CURB-65",
    "type": "scale",
    "description": "Тяжесть внебольничной пневмонии",
    "module": "curb65",
    "fn": "calculateCURB65",
    "citation": "Lim WS, et al. Thorax. 2003;58(5):377-382.",
    "fields": [
      {
        "key": "confusion",
        "label": "Дезориентация (новая)",
        "kind": "boolean"
      },
      {
        "key": "urea",
        "label": "Мочевина > 7 ммоль/л (BUN > 19 мг/дл)",
        "kind": "boolean"
      },
      {
        "key": "rr",
        "label": "ЧДД ≥ 30 /мин",
        "kind": "boolean"
      },
      {
        "key": "bp",
        "label": "АД: сист. < 90 или диаст. ≤ 60 мм рт.ст.",
        "kind": "boolean"
      },
      {
        "key": "age65",
        "label": "Возраст ≥ 65 лет",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "CURB-65"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "riskLevel"
      },
      {
        "key": "mortality"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "aa_gradient",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "А-а градиент",
    "shortName": "A-a gradient",
    "type": "formula",
    "description": "Альвеолярно-артериальный градиент O₂",
    "module": "aa_gradient",
    "fn": "calculateAaGradient",
    "citation": "West JB. Respiratory Physiology. 9th ed. Kanber GJ et al. Respiration. 1968.",
    "fields": [
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "40",
        "hint": "18–100"
      },
      {
        "key": "fio2",
        "label": "FiO₂ (фракция O₂ во вдыхаемой смеси)",
        "kind": "number",
        "unit": "0.21–1.0",
        "placeholder": "0.21",
        "hint": "0.21 = комнатный воздух",
        "step": 0.01
      },
      {
        "key": "paco2",
        "label": "PaCO₂ (парциальное давление CO₂ в артерии)",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "40",
        "hint": "35–45"
      },
      {
        "key": "pao2",
        "label": "PaO₂ (парциальное давление O₂ в артерии)",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "90",
        "hint": "75–100"
      }
    ],
    "result": [
      {
        "key": "pao2Alveolar",
        "label": "PAO₂ (альвеолярный)"
      },
      {
        "key": "aaGradient",
        "label": "A-a градиент"
      },
      {
        "key": "normalGradient"
      },
      {
        "key": "category"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "pf_ratio",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "P/F Ratio",
    "type": "formula",
    "description": "Индекс оксигенации при ОРДС",
    "module": "pf_ratio",
    "fn": "calculatePFRatio",
    "citation": "ARDS Definition Task Force. JAMA. 2012;307(23):2526-2533.",
    "fields": [
      {
        "key": "pao2",
        "label": "PaO₂ (парциальное давление O₂)",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "80",
        "hint": "75–100"
      },
      {
        "key": "fio2",
        "label": "FiO₂ (фракция O₂ во вдыхаемой смеси)",
        "kind": "number",
        "unit": "0.21–1.0",
        "placeholder": "0.21",
        "hint": "0.21–1.0",
        "step": 0.01
      }
    ],
    "result": [
      {
        "key": "ratio",
        "label": "P/F Ratio (Индекс оксигенации)"
      },
      {
        "key": "category"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "bode",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "BODE Index",
    "type": "scale",
    "description": "Прогноз при ХОБЛ",
    "module": "bode",
    "fn": "calculateBODE",
    "citation": "Celli BR, et al. N Engl J Med. 2004;350(10):1005-1012.",
    "fields": [
      {
        "key": "bmi",
        "label": "ИМТ",
        "kind": "number",
        "unit": "кг/м²",
        "placeholder": "24",
        "hint": "≤21: +1 балл",
        "step": 0.1
      },
      {
        "key": "fev1Percent",
        "label": "ОФВ₁",
        "kind": "number",
        "unit": "% от должного",
        "placeholder": "70",
        "hint": "≥65=0, 50-64=1, 36-49=2, ≤35=3"
      },
      {
        "key": "mmrc",
        "label": "Шкала одышки mMRC",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Одышка только при тяжёлой нагрузке"
          },
          {
            "value": 1,
            "label": "1 — Одышка при быстрой ходьбе или подъёме на холм"
          },
          {
            "value": 2,
            "label": "2 — Идёт медленнее сверстников, останавливается"
          },
          {
            "value": 3,
            "label": "3 — Останавливается после 100 м на ровном месте"
          },
          {
            "value": 4,
            "label": "4 — Одышка при одевании, не выходит из дома"
          }
        ]
      },
      {
        "key": "walk6min",
        "label": "Тест 6-минутной ходьбы",
        "kind": "number",
        "unit": "м",
        "placeholder": "400",
        "hint": "≥350=0, <150=3"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "BODE Index"
      },
      {
        "key": "bmiPoints",
        "label": "ИМТ (баллы)"
      },
      {
        "key": "fev1Points",
        "label": "ОФВ₁ (баллы)"
      },
      {
        "key": "mmrcPoints",
        "label": "mMRC (баллы)"
      },
      {
        "key": "walkPoints",
        "label": "Ходьба (баллы)"
      },
      {
        "key": "mortality4yr",
        "label": "4-летняя смертность"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "sofa",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "SOFA",
    "type": "scale",
    "description": "Органная недостаточность / сепсис",
    "featured": true,
    "module": "sofa",
    "fn": "calculateSOFA",
    "citation": "Vincent JL, et al. Intensive Care Med. 1996;22(7):707-710.",
    "fields": [
      {
        "key": "pfRatio",
        "label": "Дыхание (PaO₂/FiO₂)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "> 400"
          },
          {
            "value": 1,
            "label": "301–400"
          },
          {
            "value": 2,
            "label": "201–300"
          },
          {
            "value": 3,
            "label": "101–200 (с ИВЛ)"
          },
          {
            "value": 4,
            "label": "≤ 100 (с ИВЛ)"
          }
        ]
      },
      {
        "key": "platelets",
        "label": "Коагуляция (тромбоциты)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "> 150 ×10³/мкл"
          },
          {
            "value": 1,
            "label": "101–150"
          },
          {
            "value": 2,
            "label": "51–100"
          },
          {
            "value": 3,
            "label": "21–50"
          },
          {
            "value": 4,
            "label": "≤ 20"
          }
        ]
      },
      {
        "key": "bilirubin",
        "label": "Печень (билирубин)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "< 1.2 мг/дл"
          },
          {
            "value": 1,
            "label": "1.2–1.9"
          },
          {
            "value": 2,
            "label": "2.0–5.9"
          },
          {
            "value": 3,
            "label": "6.0–11.9"
          },
          {
            "value": 4,
            "label": "≥ 12.0"
          }
        ]
      },
      {
        "key": "cardiovascular",
        "label": "ССС (АД / вазопрессоры)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "MAP ≥ 70 мм рт.ст."
          },
          {
            "value": 1,
            "label": "MAP < 70 мм рт.ст."
          },
          {
            "value": 2,
            "label": "Допамин ≤5 или Добутамин (любая доза)"
          },
          {
            "value": 3,
            "label": "Допамин >5 или Норадреналин ≤0.1 мкг/кг/мин"
          },
          {
            "value": 4,
            "label": "Допамин >15 или Норадреналин >0.1 мкг/кг/мин"
          }
        ]
      },
      {
        "key": "cns",
        "label": "ЦНС (ШКГ)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "ШКГ 15"
          },
          {
            "value": 1,
            "label": "ШКГ 13–14"
          },
          {
            "value": 2,
            "label": "ШКГ 10–12"
          },
          {
            "value": 3,
            "label": "ШКГ 6–9"
          },
          {
            "value": 4,
            "label": "ШКГ < 6"
          }
        ]
      },
      {
        "key": "renal",
        "label": "Почки (креатинин / диурез)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Кр < 1.2 мг/дл"
          },
          {
            "value": 1,
            "label": "Кр 1.2–1.9"
          },
          {
            "value": 2,
            "label": "Кр 2.0–3.4"
          },
          {
            "value": 3,
            "label": "Кр 3.5–4.9 или диурез < 500 мл/сут"
          },
          {
            "value": 4,
            "label": "Кр ≥ 5.0 или диурез < 200 мл/сут"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Шкала SOFA"
      },
      {
        "key": "mortality"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "qsofa",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "qSOFA",
    "type": "scale",
    "description": "Быстрый скрининг сепсиса",
    "module": "qsofa",
    "fn": "calculateQSOFA",
    "citation": "Seymour CW, et al. JAMA. 2016;315(8):762-774.",
    "fields": [
      {
        "key": "rr22plus",
        "label": "ЧД ≥ 22 дыхания/мин",
        "kind": "boolean"
      },
      {
        "key": "alteredMentation",
        "label": "Нарушение сознания",
        "kind": "boolean",
        "hint": "ШКГ < 15 (изменение психического статуса)"
      },
      {
        "key": "sbp100minus",
        "label": "АДс ≤ 100 мм рт.ст.",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "qSOFA Score"
      },
      {
        "key": "risk"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "apache2",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "APACHE II",
    "type": "scale",
    "description": "Тяжесть состояния в ОРИТ",
    "module": "apache2",
    "fn": "calculateAPACHE2",
    "citation": "Knaus WA, et al. Crit Care Med. 1985;13(10):818-829.",
    "fields": [
      {
        "key": "temp",
        "label": "Температура тела",
        "kind": "number",
        "unit": "°C",
        "placeholder": "37",
        "hint": "36–38.4",
        "step": 0.1
      },
      {
        "key": "map",
        "label": "Среднее АД (MAP)",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "80",
        "hint": "70–109"
      },
      {
        "key": "heartRate",
        "label": "ЧСС",
        "kind": "number",
        "unit": "уд/мин",
        "placeholder": "80",
        "hint": "70–109"
      },
      {
        "key": "rr",
        "label": "ЧД",
        "kind": "number",
        "unit": "вд/мин",
        "placeholder": "16",
        "hint": "12–24"
      },
      {
        "key": "fio2",
        "label": "FiO₂",
        "kind": "number",
        "unit": "(0.21–1.0)",
        "placeholder": "0.21",
        "hint": "0.21=комнатный воздух",
        "step": 0.01
      },
      {
        "key": "pao2",
        "label": "PaO₂",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "90",
        "hint": "используется при FiO₂ <0.5"
      },
      {
        "key": "aaGradient",
        "label": "А-а градиент",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "0",
        "hint": "используется при FiO₂ ≥0.5"
      },
      {
        "key": "pH",
        "label": "pH артериальной крови",
        "kind": "number",
        "placeholder": "7.40",
        "hint": "7.35–7.45",
        "step": 0.01
      },
      {
        "key": "sodium",
        "label": "Натрий",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "140",
        "hint": "130–149"
      },
      {
        "key": "potassium",
        "label": "Калий",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "4.0",
        "hint": "3.5–5.4",
        "step": 0.1
      },
      {
        "key": "creatinine",
        "label": "Креатинин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "1.0",
        "hint": "0.6–1.4",
        "step": 0.1
      },
      {
        "key": "acuteRenalFailure",
        "label": "Острая почечная недостаточность (×2 к баллу за креатинин)",
        "kind": "boolean"
      },
      {
        "key": "hematocrit",
        "label": "Гематокрит",
        "kind": "number",
        "unit": "%",
        "placeholder": "42",
        "hint": "30–45.9"
      },
      {
        "key": "wbc",
        "label": "Лейкоциты",
        "kind": "number",
        "unit": "×10³/мкл",
        "placeholder": "8",
        "hint": "3–14.9",
        "step": 0.1
      },
      {
        "key": "gcs",
        "label": "ШКГ (GCS)",
        "kind": "number",
        "unit": "баллов",
        "placeholder": "15",
        "hint": "15=ясное сознание"
      },
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "50",
        "hint": "18–110"
      },
      {
        "key": "chronicHealth",
        "label": "Хронические заболевания",
        "kind": "select",
        "options": [
          {
            "value": "none",
            "label": "Нет / плановая послеоперационная (+0)"
          },
          {
            "value": "electivePostop",
            "label": "Плановая послеоперационная с хр. патологией (+2)"
          },
          {
            "value": "nonopEmergency",
            "label": "Экстренная операция / нехирургический (+5)"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "aps",
        "label": "APS"
      },
      {
        "key": "agePoints",
        "label": "Возраст"
      },
      {
        "key": "chronicPoints",
        "label": "Хр. здоровье"
      },
      {
        "key": "total",
        "label": "APACHE II Score"
      },
      {
        "key": "predictedMortality",
        "label": "Предсказанная смертность"
      },
      {
        "key": "severity"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "gcs",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "ШКГ (GCS)",
    "shortName": "GCS",
    "type": "scale",
    "description": "Шкала комы Глазго",
    "module": "gcs",
    "fn": "calculateGCS",
    "citation": "Teasdale G, Jennett B. Lancet. 1974;304(7872):81-84.",
    "fields": [
      {
        "key": "eyes",
        "label": "Открывание глаз (E)",
        "kind": "select",
        "options": [
          {
            "value": 4,
            "label": "4 — Спонтанное открывание"
          },
          {
            "value": 3,
            "label": "3 — На речевой стимул"
          },
          {
            "value": 2,
            "label": "2 — На болевой стимул"
          },
          {
            "value": 1,
            "label": "1 — Не открывает"
          }
        ]
      },
      {
        "key": "verbal",
        "label": "Речевая реакция (V)",
        "kind": "select",
        "options": [
          {
            "value": 5,
            "label": "5 — Ориентирован"
          },
          {
            "value": 4,
            "label": "4 — Спутанная речь"
          },
          {
            "value": 3,
            "label": "3 — Отдельные слова"
          },
          {
            "value": 2,
            "label": "2 — Нечленораздельные звуки"
          },
          {
            "value": 1,
            "label": "1 — Нет ответа"
          }
        ]
      },
      {
        "key": "motor",
        "label": "Двигательная реакция (M)",
        "kind": "select",
        "options": [
          {
            "value": 6,
            "label": "6 — Выполняет команды"
          },
          {
            "value": 5,
            "label": "5 — Локализует боль"
          },
          {
            "value": 4,
            "label": "4 — Отдёргивает конечность"
          },
          {
            "value": 3,
            "label": "3 — Патологическое сгибание (декортикация)"
          },
          {
            "value": 2,
            "label": "2 — Патологическое разгибание (децеребрация)"
          },
          {
            "value": 1,
            "label": "1 — Нет ответа"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "ШКГ (Glasgow Coma Scale)"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "level"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "parkland",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "Паркленд",
    "shortName": "Parkland",
    "type": "formula",
    "description": "Инфузия при ожогах",
    "module": "parkland",
    "fn": "calculateParkland",
    "citation": "Baxter CR. Surg Clin North Am. 1978;58(6):1313-1322.",
    "fields": [
      {
        "key": "weight",
        "label": "Масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70"
      },
      {
        "key": "tbsa",
        "label": "Площадь ожога (ПООЖ)",
        "kind": "number",
        "unit": "%",
        "placeholder": "30",
        "hint": "0–100%"
      },
      {
        "key": "pediatric",
        "label": "Педиатрическая формула (3 мл/кг/%)",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "totalVolume",
        "label": "Общий объём инфузии (24 ч)"
      },
      {
        "key": "first8h",
        "label": "Первые 8 часов"
      },
      {
        "key": "next16h",
        "label": "Следующие 16 часов"
      },
      {
        "key": "rateFirst8h"
      },
      {
        "key": "rateNext16h"
      },
      {
        "key": "formula"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "child_pugh",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Child-Pugh",
    "type": "scale",
    "description": "Тяжесть цирроза печени",
    "module": "child_pugh",
    "fn": "calculateChildPugh",
    "citation": "Child CG, Turcotte JG. Surgery and portal hypertension. Major Probl Clin Surg. 1964;1:1-85.",
    "fields": [
      {
        "key": "bilirubin",
        "label": "Билирубин",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "< 2 мг/дл"
          },
          {
            "value": 2,
            "label": "2–3 мг/дл"
          },
          {
            "value": 3,
            "label": "> 3 мг/дл"
          }
        ]
      },
      {
        "key": "albumin",
        "label": "Альбумин",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "> 3.5 г/дл"
          },
          {
            "value": 2,
            "label": "2.8–3.5 г/дл"
          },
          {
            "value": 3,
            "label": "< 2.8 г/дл"
          }
        ]
      },
      {
        "key": "inr",
        "label": "МНО (протромбиновое время)",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "< 1.7"
          },
          {
            "value": 2,
            "label": "1.7–2.3"
          },
          {
            "value": 3,
            "label": "> 2.3"
          }
        ]
      },
      {
        "key": "ascites",
        "label": "Асцит",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "Нет"
          },
          {
            "value": 2,
            "label": "Умеренный (контролируемый)"
          },
          {
            "value": 3,
            "label": "Напряжённый (рефрактерный)"
          }
        ]
      },
      {
        "key": "encephalopathy",
        "label": "Печёночная энцефалопатия",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "Нет"
          },
          {
            "value": 2,
            "label": "1–2 степень"
          },
          {
            "value": 3,
            "label": "3–4 степень"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Child-Pugh"
      },
      {
        "key": "grade"
      },
      {
        "key": "oneYearSurvival",
        "label": "Выживаемость 1 год"
      },
      {
        "key": "twoYearSurvival",
        "label": "Выживаемость 2 года"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "meld",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "MELD",
    "type": "formula",
    "description": "Смертность при болезнях печени",
    "module": "meld",
    "fn": "calculateMELD",
    "citation": "Kamath PS, et al. Hepatology. 2001;33(2):464-470.",
    "fields": [
      {
        "key": "creatinine",
        "label": "Креатинин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "1.0",
        "hint": "0.5–4.0 (макс.)"
      },
      {
        "key": "bilirubin",
        "label": "Билирубин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "1.0"
      },
      {
        "key": "inr",
        "label": "МНО",
        "kind": "number",
        "placeholder": "1.0"
      },
      {
        "key": "dialysis",
        "label": "Диализ ≥ 2 раза в неделю",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "MELD Score"
      },
      {
        "key": "mortality90day"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "blatchford",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Blatchford",
    "type": "scale",
    "description": "Риск при ЖКК",
    "module": "blatchford",
    "fn": "calculateBlatchford",
    "citation": "Blatchford O, et al. Lancet. 2000;356(9238):1318-1321.",
    "fields": [
      {
        "key": "bun",
        "label": "Мочевина (BUN)",
        "kind": "number",
        "unit": "ммоль/л",
        "placeholder": "5",
        "hint": "<6.5=0 б",
        "step": 0.1
      },
      {
        "key": "hgb",
        "label": "Гемоглобин",
        "kind": "number",
        "unit": "г/дл",
        "placeholder": "13",
        "hint": "м: ≥13=0, ж: ≥12=0",
        "step": 0.1
      },
      {
        "key": "female",
        "label": "Женский пол",
        "kind": "boolean"
      },
      {
        "key": "sbp",
        "label": "Систолическое АД",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "120",
        "hint": "≥110=0 б"
      },
      {
        "key": "hr100plus",
        "label": "ЧСС ≥ 100 уд/мин",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "melena",
        "label": "Мелена",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "syncope",
        "label": "Синкопе",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "liverDisease",
        "label": "Заболевание печени",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "heartFailure",
        "label": "Сердечная недостаточность",
        "kind": "boolean",
        "points": "+2"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Glasgow-Blatchford Score"
      },
      {
        "key": "risk",
        "label": "Риск"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "bmi",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "ИМТ",
    "shortName": "BMI",
    "type": "formula",
    "description": "Индекс массы тела",
    "featured": true,
    "module": "bmi",
    "fn": "calculateBMI",
    "citation": "WHO Expert Consultation. Appropriate body-mass index for Asian populations. Lancet 2004.",
    "fields": [
      {
        "key": "weight",
        "label": "Масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70",
        "hint": "3–300 кг"
      },
      {
        "key": "height",
        "label": "Рост",
        "kind": "number",
        "unit": "см",
        "placeholder": "175",
        "hint": "50–250 см"
      }
    ],
    "result": [
      {
        "key": "bmi",
        "label": "ИМТ"
      },
      {
        "key": "category"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "details"
      }
    ]
  },
  {
    "id": "ibw",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "Идеальный вес",
    "shortName": "IBW",
    "type": "formula",
    "description": "Идеальная и скорректированная масса тела",
    "module": "ibw",
    "fn": "calculateIBW",
    "citation": "Devine BJ. Drug Intell Clin Pharm. 1974;8:650-655.",
    "fields": [
      {
        "key": "height",
        "label": "Рост",
        "kind": "number",
        "unit": "см",
        "placeholder": "175"
      },
      {
        "key": "weight",
        "label": "Фактическая масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "85"
      },
      {
        "key": "sex",
        "label": "Пол",
        "kind": "select",
        "options": [
          {
            "value": "male",
            "label": "Мужской"
          },
          {
            "value": "female",
            "label": "Женский"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "ibw",
        "label": "Идеальная масса тела (IBW)"
      },
      {
        "key": "abw"
      },
      {
        "key": "adjBW",
        "label": "Скорр. масса (AdjBW)",
        "optional": true
      },
      {
        "key": "isObese"
      },
      {
        "key": "bmi",
        "label": "ИМТ"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "harris_benedict",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "Harris-Benedict",
    "type": "formula",
    "description": "Основной обмен и суточные калории",
    "module": "harris_benedict",
    "fn": "calculateHarrisBenedict",
    "citation": "Harris JA, Benedict FG. Proc Natl Acad Sci USA. 1918;4(12):370-373.",
    "fields": [
      {
        "key": "weight",
        "label": "Масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70"
      },
      {
        "key": "height",
        "label": "Рост",
        "kind": "number",
        "unit": "см",
        "placeholder": "175"
      },
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "35"
      },
      {
        "key": "sex",
        "label": "Пол",
        "kind": "select",
        "options": [
          {
            "value": "male",
            "label": "Мужской"
          },
          {
            "value": "female",
            "label": "Женский"
          }
        ]
      },
      {
        "key": "activity",
        "label": "Уровень физической активности",
        "kind": "select",
        "options": [
          {
            "value": "sedentary",
            "label": "Сидячий (×1.2)"
          },
          {
            "value": "light",
            "label": "Лёгкая активность 1–3 тр/нед (×1.375)"
          },
          {
            "value": "moderate",
            "label": "Умеренная 3–5 тр/нед (×1.55)"
          },
          {
            "value": "active",
            "label": "Высокая 6–7 тр/нед (×1.725)"
          },
          {
            "value": "very_active",
            "label": "Очень высокая (×1.9)"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "bmr",
        "label": "Основной обмен (BMR)"
      },
      {
        "key": "tdee",
        "label": "Суточная потребность (TDEE)"
      },
      {
        "key": "activityLabel"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "mifflin",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "Mifflin-St Jeor",
    "type": "formula",
    "description": "Основной обмен (современная формула)",
    "module": "mifflin",
    "fn": "calculateMifflin",
    "citation": "Mifflin MD, et al. Am J Clin Nutr. 1990;51(2):241-247.",
    "fields": [
      {
        "key": "weight",
        "label": "Масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70",
        "hint": "20–300",
        "step": 0.1
      },
      {
        "key": "height",
        "label": "Рост",
        "kind": "number",
        "unit": "см",
        "placeholder": "170",
        "hint": "100–250"
      },
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "35",
        "hint": "15–110"
      },
      {
        "key": "female",
        "label": "Женский пол (−161 ккал к ОО)",
        "kind": "boolean"
      },
      {
        "key": "activityLevel",
        "label": "Уровень физической активности",
        "kind": "select",
        "options": [
          {
            "value": "sedentary",
            "label": "Малоподвижный (нет нагрузок)"
          },
          {
            "value": "light",
            "label": "Лёгкий (1–3 дня/нед)"
          },
          {
            "value": "moderate",
            "label": "Умеренный (3–5 дней/нед)"
          },
          {
            "value": "active",
            "label": "Высокий (6–7 дней/нед)"
          },
          {
            "value": "veryActive",
            "label": "Очень высокий (2x тренировки/день)"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "bmr",
        "label": "Основной обмен (BMR)"
      },
      {
        "key": "tdee",
        "label": "TDEE (суточные ккал)"
      },
      {
        "key": "activityMultiplier"
      },
      {
        "key": "activityLabel"
      },
      {
        "key": "severity"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "corrected_ca",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "Корригированный Ca²⁺",
    "shortName": "Corrected Ca",
    "type": "formula",
    "description": "Коррекция кальция на альбумин",
    "module": "corrected_ca",
    "fn": "calculateCorrectedCa",
    "citation": "Payne RB, et al. Lancet. 1973;1(7815):1461-1463.",
    "fields": [
      {
        "key": "ca",
        "label": "Кальций (измеренный)",
        "kind": "number",
        "unit": "caUnit",
        "placeholder": "unit === \"mg_dl\" ? \"9.0\" : \"2.25\"",
        "hint": "caRange"
      },
      {
        "key": "albumin",
        "label": "Альбумин",
        "kind": "number",
        "unit": "albUnit",
        "placeholder": "unit === \"mg_dl\" ? \"4.0\" : \"40\"",
        "hint": "albRange"
      },
      {
        "key": "unit",
        "label": "Единицы измерения",
        "kind": "select",
        "options": [
          {
            "value": "mg_dl",
            "label": "мг/дл (Ca) / г/дл (альбумин)"
          },
          {
            "value": "mmol_l",
            "label": "ммоль/л (Ca) / г/л (альбумин)"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "correctedCa",
        "label": "Корригированный кальций"
      },
      {
        "key": "unit"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "ldl_friedewald",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "LDL (Friedewald)",
    "type": "formula",
    "description": "Расчётный ЛПНП",
    "module": "ldl_friedewald",
    "fn": "calculateLDLFriedewald",
    "citation": "Friedewald WT, et al. Clin Chem. 1972;18(6):499-502.",
    "fields": [
      {
        "key": "totalChol",
        "label": "Общий холестерин",
        "kind": "number",
        "unit": "displayUnit",
        "placeholder": "unit === \"mg_dl\" ? \"200\" : \"5.2\""
      },
      {
        "key": "hdl",
        "label": "ХС-ЛПВП",
        "kind": "number",
        "unit": "displayUnit",
        "placeholder": "unit === \"mg_dl\" ? \"50\" : \"1.3\""
      },
      {
        "key": "tg",
        "label": "Триглицериды",
        "kind": "number",
        "unit": "displayUnit",
        "placeholder": "unit === \"mg_dl\" ? \"150\" : \"1.7\"",
        "hint": "unit === \"mg_dl\" ? \"< 400 мг/дл\" : \"< 4.52 ммоль/л\""
      },
      {
        "key": "unit",
        "label": "Единицы измерения",
        "kind": "select",
        "options": [
          {
            "value": "mg_dl",
            "label": "мг/дл"
          },
          {
            "value": "mmol_l",
            "label": "ммоль/л"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "ldl",
        "label": "ЛПНП (расчётный)"
      },
      {
        "key": "unit"
      },
      {
        "key": "valid"
      },
      {
        "key": "invalidReason",
        "optional": true
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "homa_ir",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "HOMA-IR",
    "type": "formula",
    "description": "Индекс инсулинорезистентности",
    "module": "homa_ir",
    "fn": "calculateHOMAIR",
    "citation": "Matthews DR, et al. Diabetologia. 1985;28(7):412-419.",
    "fields": [
      {
        "key": "insulin",
        "label": "Инсулин натощак",
        "kind": "number",
        "unit": "мкМЕ/мл",
        "placeholder": "10",
        "hint": "2–25 мкМЕ/мл"
      },
      {
        "key": "glucose",
        "label": "Глюкоза натощак",
        "kind": "number",
        "unit": "ммоль/л",
        "placeholder": "5.0",
        "hint": "3.9–6.1"
      }
    ],
    "result": [
      {
        "key": "homa",
        "label": "HOMA-IR"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      }
    ]
  },
  {
    "id": "nihss",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "NIHSS",
    "type": "scale",
    "description": "Тяжесть инсульта",
    "module": "nihss",
    "fn": "calculateNIHSS",
    "citation": "Brott T, et al. Stroke. 1989;20(7):864-870.",
    "fields": [
      {
        "key": "consciousness",
        "label": "1a. Уровень сознания",
        "kind": "select",
        "options": [
          {
            "label": "0 — Бодрствует",
            "value": 0
          },
          {
            "label": "1 — Оглушение",
            "value": 1
          },
          {
            "label": "2 — Ступор",
            "value": 2
          },
          {
            "label": "3 — Кома",
            "value": 3
          }
        ]
      },
      {
        "key": "consciousnessQuestions",
        "label": "1b. Ориентация (месяц/возраст)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Оба правильно",
            "value": 0
          },
          {
            "label": "1 — Один правильно",
            "value": 1
          },
          {
            "label": "2 — Оба неправильно",
            "value": 2
          }
        ]
      },
      {
        "key": "consciousnessCommands",
        "label": "1c. Выполнение команд",
        "kind": "select",
        "options": [
          {
            "label": "0 — Обе выполнены",
            "value": 0
          },
          {
            "label": "1 — Одна выполнена",
            "value": 1
          },
          {
            "label": "2 — Не выполнены",
            "value": 2
          }
        ]
      },
      {
        "key": "gazeParesis",
        "label": "2. Взор",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "1 — Частичный парез взора",
            "value": 1
          },
          {
            "label": "2 — Вынужденный поворот взора",
            "value": 2
          }
        ]
      },
      {
        "key": "visual",
        "label": "3. Поля зрения",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "1 — Частичная гемианопсия",
            "value": 1
          },
          {
            "label": "2 — Полная гемианопсия",
            "value": 2
          },
          {
            "label": "3 — Слепота/двусторонняя",
            "value": 3
          }
        ]
      },
      {
        "key": "facialParalysis",
        "label": "4. Лицевой паралич",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "1 — Незначительный",
            "value": 1
          },
          {
            "label": "2 — Частичный (нижняя часть)",
            "value": 2
          },
          {
            "label": "3 — Полный",
            "value": 3
          }
        ]
      },
      {
        "key": "leftArm",
        "label": "5a. Двигательная функция — рука (левая)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Без отклонения 10 с",
            "value": 0
          },
          {
            "label": "1 — Опускается за 10 с",
            "value": 1
          },
          {
            "label": "2 — Не может удержать 10 с",
            "value": 2
          },
          {
            "label": "3 — Движения против силы тяжести нет",
            "value": 3
          },
          {
            "label": "4 — Нет движений",
            "value": 4
          }
        ]
      },
      {
        "key": "rightArm",
        "label": "5b. Двигательная функция — рука (правая)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Без отклонения 10 с",
            "value": 0
          },
          {
            "label": "1 — Опускается за 10 с",
            "value": 1
          },
          {
            "label": "2 — Не может удержать 10 с",
            "value": 2
          },
          {
            "label": "3 — Движения против силы тяжести нет",
            "value": 3
          },
          {
            "label": "4 — Нет движений",
            "value": 4
          }
        ]
      },
      {
        "key": "leftLeg",
        "label": "6a. Двигательная функция — нога (левая)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Без отклонения 5 с",
            "value": 0
          },
          {
            "label": "1 — Опускается за 5 с",
            "value": 1
          },
          {
            "label": "2 — Не может удержать 5 с",
            "value": 2
          },
          {
            "label": "3 — Движения против силы тяжести нет",
            "value": 3
          },
          {
            "label": "4 — Нет движений",
            "value": 4
          }
        ]
      },
      {
        "key": "rightLeg",
        "label": "6b. Двигательная функция — нога (правая)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Без отклонения 5 с",
            "value": 0
          },
          {
            "label": "1 — Опускается за 5 с",
            "value": 1
          },
          {
            "label": "2 — Не может удержать 5 с",
            "value": 2
          },
          {
            "label": "3 — Движения против силы тяжести нет",
            "value": 3
          },
          {
            "label": "4 — Нет движений",
            "value": 4
          }
        ]
      },
      {
        "key": "ataxia",
        "label": "7. Атаксия конечностей",
        "kind": "select",
        "options": [
          {
            "label": "0 — Нет",
            "value": 0
          },
          {
            "label": "1 — Одна конечность",
            "value": 1
          },
          {
            "label": "2 — Две конечности",
            "value": 2
          }
        ]
      },
      {
        "key": "sensory",
        "label": "8. Чувствительность",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "1 — Лёгкое снижение",
            "value": 1
          },
          {
            "label": "2 — Выраженное снижение/анестезия",
            "value": 2
          }
        ]
      },
      {
        "key": "aphasia",
        "label": "9. Наилучшая речь",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "1 — Лёгкая афазия",
            "value": 1
          },
          {
            "label": "2 — Тяжёлая афазия",
            "value": 2
          },
          {
            "label": "3 — Мутизм/тотальная афазия",
            "value": 3
          }
        ]
      },
      {
        "key": "dysarthria",
        "label": "10. Дизартрия",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "1 — Умеренная",
            "value": 1
          },
          {
            "label": "2 — Тяжёлая/анартрия",
            "value": 2
          }
        ]
      },
      {
        "key": "extinction",
        "label": "11. Угасание/невнимание",
        "kind": "select",
        "options": [
          {
            "label": "0 — Нет",
            "value": 0
          },
          {
            "label": "1 — Один модальный тип",
            "value": 1
          },
          {
            "label": "2 — Несколько модальностей",
            "value": 2
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "NIHSS"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "level"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "abcd2",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "ABCD²",
    "type": "risk",
    "description": "Риск инсульта после ТИА",
    "module": "abcd2",
    "fn": "calculateABCD2",
    "citation": "Johnston SC, et al. Lancet. 2007;369(9558):283-292.",
    "fields": [
      {
        "key": "age60plus",
        "label": "Возраст ≥ 60 лет",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "bpElevated",
        "label": "АД ≥ 140/90 мм рт.ст.",
        "kind": "boolean",
        "hint": "При первичном осмотре",
        "points": "+1"
      },
      {
        "key": "clinicalFeature",
        "label": "Клинические признаки",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Другие симптомы"
          },
          {
            "value": 1,
            "label": "1 — Речевые нарушения без слабости"
          },
          {
            "value": 2,
            "label": "2 — Односторонняя мышечная слабость"
          }
        ]
      },
      {
        "key": "duration",
        "label": "Длительность симптомов",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Менее 10 минут"
          },
          {
            "value": 1,
            "label": "1 — 10–59 минут"
          },
          {
            "value": 2,
            "label": "2 — 60 минут и более"
          }
        ]
      },
      {
        "key": "diabetes",
        "label": "Сахарный диабет",
        "kind": "boolean",
        "points": "+1"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "ABCD² Score"
      },
      {
        "key": "risk"
      },
      {
        "key": "strokeRisk2d",
        "label": "Риск инсульта (2 дня)"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "mess",
    "categoryId": "trauma",
    "categories": [
      "trauma"
    ],
    "name": "MESS",
    "type": "scale",
    "description": "Оценка конечности при травме",
    "module": "mess",
    "fn": "calculateMESS",
    "citation": "Johansen K, et al. J Trauma. 1990;30(5):568-573.",
    "fields": [
      {
        "key": "energy",
        "label": "Энергия травмы",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — Низкая (тупая, нискоскоростная)"
          },
          {
            "value": 2,
            "label": "2 — Средняя (открытый перелом, вывих)"
          },
          {
            "value": 3,
            "label": "3 — Высокая (высокоскоростное огнестрельное, сдавление)"
          },
          {
            "value": 4,
            "label": "4 — Очень высокая (высокоскоростное + заражение)"
          }
        ]
      },
      {
        "key": "ischemia",
        "label": "Ишемия конечности",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — Пульс снижен или отсутствует, перфузия нормальная"
          },
          {
            "value": 2,
            "label": "2 — Пульс отсутствует, парестезии, замедл. наполнение"
          },
          {
            "value": 3,
            "label": "3 — Холодная, паралич, отсутствие капиллярного наполнения"
          }
        ]
      },
      {
        "key": "ischemiaOver6h",
        "label": "Ишемия более 6 часов (баллы ×2)",
        "kind": "boolean"
      },
      {
        "key": "shock",
        "label": "Шоковое состояние",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нормотензия (АДс >90 мм рт.ст.)"
          },
          {
            "value": 1,
            "label": "1 — Транзиторная гипотензия"
          },
          {
            "value": 2,
            "label": "2 — Стойкая гипотензия"
          }
        ]
      },
      {
        "key": "age",
        "label": "Возраст пациента",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Младше 30 лет"
          },
          {
            "value": 1,
            "label": "1 — 30–50 лет"
          },
          {
            "value": 2,
            "label": "2 — Старше 50 лет"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "MESS Score"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "caprini",
    "categoryId": "trauma",
    "categories": [
      "trauma"
    ],
    "name": "Caprini",
    "type": "risk",
    "description": "Риск ВТЭ у хирургических больных",
    "module": "caprini",
    "fn": "calculateCaprini",
    "citation": "Caprini JA. Dis Mon. 2005;51(2-3):70-78.",
    "fields": [
      {
        "key": "age4160",
        "label": "Возраст 41–60 лет",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "minorSurgery",
        "label": "Малая операция",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "bmi25plus",
        "label": "ИМТ > 25 кг/м²",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "swollenLegs",
        "label": "Отёчность ног",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "varicoseVeins",
        "label": "Варикозное расширение вен",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "pregnantPostpartum",
        "label": "Беременность / послеродовой период",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "unexplainedFetalLoss",
        "label": "Необъяснённые потери плода в анамнезе",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "oralContraceptives",
        "label": "Оральные контрацептивы / ГЗТ",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "bedrestUnder72h",
        "label": "Постельный режим < 72 ч",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "plasterCastMinor",
        "label": "Гипсовая иммобилизация",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "centralVenousAccess",
        "label": "Центральный венозный доступ",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "age6174",
        "label": "Возраст 61–74 года",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "arthroscopicSurgery",
        "label": "Артроскопическая операция",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "malignancy",
        "label": "Злокачественное новообразование",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "confinedBed72hPlus",
        "label": "Постельный режим > 72 ч",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "historyDvtPe2",
        "label": "ТГВ/ТЭЛА в анамнезе",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "age75plus",
        "label": "Возраст ≥ 75 лет",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "historyDvtPe3",
        "label": "historyDvtPe3",
        "kind": "boolean",
        "fixedValue": false
      },
      {
        "key": "familyHistoryThrombosis",
        "label": "Семейный анамнез тромбозов",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "factorVLeiden",
        "label": "Фактор V Leiden",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "prothrombin20210A",
        "label": "Протромбин 20210A",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "lupusAnticoagulant",
        "label": "Волчаночный антикоагулянт",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "anticardiolipinAb",
        "label": "Антикардиолипиновые антитела",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "elevatedHomocysteine",
        "label": "Повышенный гомоцистеин",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "hit",
        "label": "ГИТ (гепарин-индуц. тромбоцитопения)",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "otherThrombophilia",
        "label": "Другая тромбофилия",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "strokeLess1mo",
        "label": "Инсульт менее 1 месяца назад",
        "kind": "boolean",
        "points": "+5"
      },
      {
        "key": "electiveArthroplasty",
        "label": "Плановое эндопротезирование",
        "kind": "boolean",
        "points": "+5"
      },
      {
        "key": "hipPelvisLegFracture",
        "label": "Перелом бедра / таза / ноги",
        "kind": "boolean",
        "points": "+5"
      },
      {
        "key": "acuteSpinalCordInjury",
        "label": "Острая травма спинного мозга",
        "kind": "boolean",
        "points": "+5"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Caprini Score"
      },
      {
        "key": "riskGroup"
      },
      {
        "key": "vteRate",
        "label": "Риск ВТЭ"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "phq9",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "PHQ-9",
    "type": "scale",
    "description": "Скрининг депрессии",
    "module": "phq9",
    "fn": "calculatePHQ9",
    "citation": "Kroenke K, et al. J Gen Intern Med. 2001;16(9):606-613.",
    "fields": [
      {
        "key": "q1",
        "label": "Слабый интерес или удовольствие от дел",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Чувство подавленности, безнадёжности",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q3",
        "label": "Нарушения сна (бессонница или избыточная сонливость)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q4",
        "label": "Усталость или упадок сил",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q5",
        "label": "Плохой аппетит или переедание",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q6",
        "label": "Чувство никчёмности или вины",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q7",
        "label": "Трудности с концентрацией",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q8",
        "label": "Замедленность или беспокойство (по наблюдению других)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q9",
        "label": "Мысли о причинении себе вреда или смерти",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "PHQ-9"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "suicidalRisk"
      }
    ]
  },
  {
    "id": "ciwa",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "CIWA-Ar",
    "shortName": "CIWA",
    "type": "scale",
    "description": "Алкогольный абстинентный синдром",
    "module": "ciwa",
    "fn": "calculateCIWA",
    "citation": "Sullivan JT, et al. Br J Addict. 1989;84(11):1353-1357.",
    "fields": [
      {
        "key": "nausea",
        "label": "Тошнота / рвота",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "tremor",
        "label": "Тремор",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "sweats",
        "label": "Пароксизмальные поты",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "anxiety",
        "label": "Тревога",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "agitation",
        "label": "Ажитация",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "tactile",
        "label": "Тактильные нарушения",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "auditory",
        "label": "Слуховые нарушения",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "visual",
        "label": "Зрительные нарушения",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "headache",
        "label": "Головная боль / тяжесть в голове",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          },
          {
            "value": 5,
            "label": "5"
          },
          {
            "value": 6,
            "label": "6"
          },
          {
            "value": 7,
            "label": "7"
          }
        ]
      },
      {
        "key": "orientation",
        "label": "Ориентация (0–4)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "CIWA-Ar Score"
      },
      {
        "key": "severity"
      },
      {
        "key": "level",
        "label": "Тяжесть"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "apgar",
    "categoryId": "obstetrics",
    "categories": [
      "obstetrics"
    ],
    "name": "Апгар",
    "shortName": "Apgar",
    "type": "scale",
    "description": "Состояние новорождённого",
    "module": "apgar",
    "fn": "calculateApgar",
    "citation": "Apgar V. Curr Res Anesth Analg. 1953;32(4):260-267.",
    "fields": [
      {
        "key": "appearance",
        "label": "Цвет кожных покровов (Appearance)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Синюшный/бледный (весь)"
          },
          {
            "value": 1,
            "label": "1 — Тело розовое, конечности синюшные"
          },
          {
            "value": 2,
            "label": "2 — Полностью розовый"
          }
        ]
      },
      {
        "key": "pulse",
        "label": "Пульс (Pulse)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Отсутствует"
          },
          {
            "value": 1,
            "label": "1 — < 100 уд/мин"
          },
          {
            "value": 2,
            "label": "2 — ≥ 100 уд/мин"
          }
        ]
      },
      {
        "key": "grimace",
        "label": "Рефлекторная возбудимость (Grimace)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет ответа"
          },
          {
            "value": 1,
            "label": "1 — Гримаса"
          },
          {
            "value": 2,
            "label": "2 — Кашель, чихание, крик"
          }
        ]
      },
      {
        "key": "activity",
        "label": "Мышечный тонус (Activity)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Вялый (атония)"
          },
          {
            "value": 1,
            "label": "1 — Умеренный тонус"
          },
          {
            "value": 2,
            "label": "2 — Активные движения"
          }
        ]
      },
      {
        "key": "respiration",
        "label": "Дыхание (Respiration)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Отсутствует"
          },
          {
            "value": 1,
            "label": "1 — Нерегулярное, слабый крик"
          },
          {
            "value": 2,
            "label": "2 — Регулярное, громкий крик"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Оценка по Апгар"
      },
      {
        "key": "severity"
      },
      {
        "key": "color"
      },
      {
        "key": "level"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "bishop",
    "categoryId": "obstetrics",
    "categories": [
      "obstetrics"
    ],
    "name": "Bishop",
    "type": "scale",
    "description": "Зрелость шейки матки",
    "module": "bishop",
    "fn": "calculateBishop",
    "citation": "Bishop EH. Obstet Gynecol. 1964;24:266-268.",
    "fields": [
      {
        "key": "dilation",
        "label": "Раскрытие шейки матки",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Закрыта (0 см)"
          },
          {
            "value": 1,
            "label": "1 — 1–2 см"
          },
          {
            "value": 2,
            "label": "2 — 3–4 см"
          },
          {
            "value": 3,
            "label": "3 — 5+ см"
          }
        ]
      },
      {
        "key": "effacement",
        "label": "Укорочение шейки (%)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — 0–30%"
          },
          {
            "value": 1,
            "label": "1 — 40–50%"
          },
          {
            "value": 2,
            "label": "2 — 60–70%"
          },
          {
            "value": 3,
            "label": "3 — 80%+"
          }
        ]
      },
      {
        "key": "station",
        "label": "Положение предлежащей части",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — −3"
          },
          {
            "value": 1,
            "label": "1 — −2"
          },
          {
            "value": 2,
            "label": "2 — −1/0"
          },
          {
            "value": 3,
            "label": "3 — +1/+2"
          }
        ]
      },
      {
        "key": "consistency",
        "label": "Консистенция шейки",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Плотная"
          },
          {
            "value": 1,
            "label": "1 — Средняя"
          },
          {
            "value": 2,
            "label": "2 — Мягкая"
          }
        ]
      },
      {
        "key": "position",
        "label": "Положение шейки матки",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Задняя"
          },
          {
            "value": 1,
            "label": "1 — Средняя"
          },
          {
            "value": 2,
            "label": "2 — Передняя"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Bishop Score"
      },
      {
        "key": "ripeness",
        "label": "Зрелость шейки"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "naegele",
    "categoryId": "obstetrics",
    "categories": [
      "obstetrics"
    ],
    "name": "Правило Негеле",
    "shortName": "Naegele",
    "type": "formula",
    "description": "Предполагаемый срок родов",
    "module": "naegele",
    "fn": "calculateNaegele",
    "citation": "Naegele FC. Erfahrungen und Untersuchungen. 1812.",
    "fields": [
      {
        "key": "lmpDate",
        "label": "Правило Негеле",
        "kind": "date"
      }
    ],
    "result": [
      {
        "key": "eddDate",
        "nested": true
      },
      {
        "key": "eddFormatted",
        "label": "Предполагаемый срок родов (ПСР)"
      },
      {
        "key": "gestationalWeeks"
      },
      {
        "key": "severity"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "pcr_urine",
    "categoryId": "obstetrics",
    "categories": [
      "obstetrics"
    ],
    "name": "Белок/Креатинин мочи",
    "shortName": "PCR мочи",
    "type": "formula",
    "description": "Соотношение белок/креатинин в разовой моче",
    "module": "pcr_urine",
    "fn": "calculatePCRUrine",
    "citation": "Ginsberg JM, et al. N Engl J Med. 1983;309(25):1543-1546.",
    "fields": [
      {
        "key": "protein",
        "label": "Белок мочи",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "30"
      },
      {
        "key": "creatinine",
        "label": "Креатинин мочи",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "100"
      }
    ],
    "result": [
      {
        "key": "ratio",
        "label": "Белок/Креатинин мочи (ПКО)"
      },
      {
        "key": "dailyEstimate"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "category"
      }
    ]
  },
  {
    "id": "fick_co",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "Сердечный выброс (Fick)",
    "shortName": "Fick CO",
    "type": "formula",
    "description": "Сердечный выброс по методу Фика",
    "module": "fick_co",
    "fn": "calculateFickCO",
    "citation": "Fick A. Über die Messung des Blutquantums in den Herzventrikeln. 1870.",
    "fields": [
      {
        "key": "sao2",
        "label": "SaO₂ (артериальная)",
        "kind": "number",
        "unit": "%",
        "placeholder": "98",
        "hint": "95–100"
      },
      {
        "key": "svo2",
        "label": "SvO₂ (смешанная венозная)",
        "kind": "number",
        "unit": "%",
        "placeholder": "70",
        "hint": "60–80"
      },
      {
        "key": "hgb",
        "label": "Гемоглобин",
        "kind": "number",
        "unit": "г/дл",
        "placeholder": "12",
        "hint": "12–17",
        "step": 0.1
      },
      {
        "key": "bsa",
        "label": "Площадь поверхности тела (ППТ)",
        "kind": "number",
        "unit": "м²",
        "placeholder": "1.75",
        "step": 0.01
      },
      {
        "key": "vo2measured",
        "label": "VO₂ (если измерен, иначе рассчитается)",
        "kind": "number",
        "unit": "мл/мин",
        "placeholder": "Не обязательно",
        "optional": true
      }
    ],
    "result": [
      {
        "key": "vo2"
      },
      {
        "key": "co",
        "label": "Сердечный выброс (Fick)"
      },
      {
        "key": "ci"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "ciInterpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "ascvd_pce",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "ASCVD Risk",
    "type": "risk",
    "description": "10-летний риск атеросклеротических ССЗ (PCE)",
    "module": "ascvd_pce",
    "fn": "calculateASCVD",
    "citation": "Goff DC Jr, et al. Circulation. 2014;129(25 Suppl 2):S49-73.",
    "fields": [
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "55",
        "hint": "40–79"
      },
      {
        "key": "female",
        "label": "Женский пол",
        "kind": "boolean"
      },
      {
        "key": "africanAmerican",
        "label": "Афроамериканское происхождение",
        "kind": "boolean"
      },
      {
        "key": "totalCholesterol",
        "label": "Общий холестерин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "200"
      },
      {
        "key": "hdl",
        "label": "ХС-ЛПВП",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "50"
      },
      {
        "key": "sbp",
        "label": "Систолическое АД",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "130"
      },
      {
        "key": "treatedHypertension",
        "label": "Лечение артериальной гипертензии",
        "kind": "boolean"
      },
      {
        "key": "diabetic",
        "label": "Сахарный диабет",
        "kind": "boolean"
      },
      {
        "key": "smoker",
        "label": "Курение в настоящее время",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "risk10Year",
        "label": "10-летний риск АССЗ (PCE)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "ich_score",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "ICH Score",
    "type": "scale",
    "description": "30-дневная смертность при внутримозговом кровоизлиянии",
    "module": "ich_score",
    "fn": "calculateICHScore",
    "citation": "Hemphill JC 3rd, et al. Stroke. 2001;32(4):891-897.",
    "fields": [
      {
        "key": "gcs",
        "label": "ШКГ при поступлении",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "ШКГ 13–15"
          },
          {
            "value": 1,
            "label": "ШКГ 5–12"
          },
          {
            "value": 2,
            "label": "ШКГ 3–4"
          }
        ]
      },
      {
        "key": "volume30",
        "label": "Объём гематомы ≥ 30 мл (ABC/2)",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "ivh",
        "label": "Прорыв крови в желудочки (ВЖК)",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "infratentorial",
        "label": "Инфратенториальная локализация",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "age80",
        "label": "Возраст ≥ 80 лет",
        "kind": "boolean",
        "points": "+1"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "ICH Score"
      },
      {
        "key": "mortality"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "hunt_hess",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "Hunt-Hess",
    "type": "scale",
    "description": "Клиническая степень субарахноидального кровоизлияния",
    "module": "hunt_hess",
    "fn": "calculateHuntHess",
    "citation": "Hunt WE, Hess RM. J Neurosurg. 1968;28(1):14-20.",
    "fields": [
      {
        "key": "grade",
        "label": "Hunt-Hess",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Неразорвавшаяся аневризма"
          },
          {
            "value": 1,
            "label": "1 — Бессимптомно или лёгкая головная боль"
          },
          {
            "value": 2,
            "label": "2 — Умеренная/тяжёлая ГБ, ригидность"
          },
          {
            "value": 3,
            "label": "3 — Сонливость / лёгкий очаговый дефицит"
          },
          {
            "value": 4,
            "label": "4 — Ступор, умеренный/тяжёлый гемипарез"
          },
          {
            "value": 5,
            "label": "5 — Глубокая кома, децеребрационные позы"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "grade",
        "label": "Hunt-Hess"
      },
      {
        "key": "description"
      },
      {
        "key": "mortality"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "mrs",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "Шкала Рэнкина (mRS)",
    "shortName": "mRS",
    "type": "scale",
    "description": "Функциональный исход после инсульта",
    "module": "mrs",
    "fn": "calculateMRS",
    "citation": "Rankin J. Scott Med J. 1957;2(5):200-215.",
    "fields": [
      {
        "key": "grade",
        "label": "Шкала Рэнкина (mRS)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет симптомов"
          },
          {
            "value": 1,
            "label": "1 — Незначительная инвалидизация"
          },
          {
            "value": 2,
            "label": "2 — Лёгкая инвалидизация"
          },
          {
            "value": 3,
            "label": "3 — Умеренная инвалидизация"
          },
          {
            "value": 4,
            "label": "4 — Умеренно-тяжёлая инвалидизация"
          },
          {
            "value": 5,
            "label": "5 — Тяжёлая инвалидизация"
          },
          {
            "value": 6,
            "label": "6 — Смерть"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "grade",
        "label": "Шкала Рэнкина"
      },
      {
        "key": "description"
      },
      {
        "key": "category"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "barthel",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "Индекс Бартел",
    "shortName": "Barthel",
    "type": "scale",
    "description": "Повседневная активность и самообслуживание",
    "module": "barthel",
    "fn": "calculateBarthel",
    "citation": "Mahoney FI, Barthel DW. Md State Med J. 1965;14:61-65.",
    "fields": [
      {
        "key": "feeding",
        "label": "Приём пищи",
        "kind": "select",
        "options": [
          {
            "label": "0 — Не может самостоятельно",
            "value": 0
          },
          {
            "label": "5 — Нужна помощь",
            "value": 5
          },
          {
            "label": "10 — Независим",
            "value": 10
          }
        ]
      },
      {
        "key": "bathing",
        "label": "Купание/душ",
        "kind": "select",
        "options": [
          {
            "label": "0 — Зависим",
            "value": 0
          },
          {
            "label": "5 — Независим",
            "value": 5
          }
        ]
      },
      {
        "key": "grooming",
        "label": "Личная гигиена",
        "kind": "select",
        "options": [
          {
            "label": "0 — Нужна помощь",
            "value": 0
          },
          {
            "label": "5 — Независим",
            "value": 5
          }
        ]
      },
      {
        "key": "dressing",
        "label": "Одевание",
        "kind": "select",
        "options": [
          {
            "label": "0 — Зависим",
            "value": 0
          },
          {
            "label": "5 — Нужна помощь",
            "value": 5
          },
          {
            "label": "10 — Независим",
            "value": 10
          }
        ]
      },
      {
        "key": "bowel",
        "label": "Контроль кишечника",
        "kind": "select",
        "options": [
          {
            "label": "0 — Недержание",
            "value": 0
          },
          {
            "label": "5 — Случайные эпизоды",
            "value": 5
          },
          {
            "label": "10 — Удерживает",
            "value": 10
          }
        ]
      },
      {
        "key": "bladder",
        "label": "Контроль мочевого пузыря",
        "kind": "select",
        "options": [
          {
            "label": "0 — Недержание",
            "value": 0
          },
          {
            "label": "5 — Случайные эпизоды",
            "value": 5
          },
          {
            "label": "10 — Удерживает",
            "value": 10
          }
        ]
      },
      {
        "key": "toilet",
        "label": "Пользование туалетом",
        "kind": "select",
        "options": [
          {
            "label": "0 — Зависим",
            "value": 0
          },
          {
            "label": "5 — Нужна помощь",
            "value": 5
          },
          {
            "label": "10 — Независим",
            "value": 10
          }
        ]
      },
      {
        "key": "transfers",
        "label": "Перемещение кровать-кресло",
        "kind": "select",
        "options": [
          {
            "label": "0 — Невозможно (нет баланса сидя)",
            "value": 0
          },
          {
            "label": "5 — Требует значительной помощи",
            "value": 5
          },
          {
            "label": "10 — Требует небольшой помощи",
            "value": 10
          },
          {
            "label": "15 — Независим",
            "value": 15
          }
        ]
      },
      {
        "key": "mobility",
        "label": "Передвижение",
        "kind": "select",
        "options": [
          {
            "label": "0 — Неподвижен",
            "value": 0
          },
          {
            "label": "5 — Независим в кресле-коляске",
            "value": 5
          },
          {
            "label": "10 — Ходит с помощью",
            "value": 10
          },
          {
            "label": "15 — Независим > 50 м",
            "value": 15
          }
        ]
      },
      {
        "key": "stairs",
        "label": "Подъём по лестнице",
        "kind": "select",
        "options": [
          {
            "label": "0 — Не может",
            "value": 0
          },
          {
            "label": "5 — Нужна помощь",
            "value": 5
          },
          {
            "label": "10 — Независим",
            "value": 10
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Индекс Бартел"
      },
      {
        "key": "category"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "psi_port",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "PSI/PORT",
    "type": "scale",
    "description": "Тяжесть внебольничной пневмонии (класс риска)",
    "module": "psi_port",
    "fn": "calculatePSIPort",
    "citation": "Fine MJ, et al. N Engl J Med. 1997;336(4):243-250.",
    "fields": [
      {
        "key": "age",
        "label": "Возраст",
        "kind": "number",
        "unit": "лет",
        "placeholder": "65"
      },
      {
        "key": "female",
        "label": "Женский пол",
        "kind": "boolean"
      },
      {
        "key": "nursingHome",
        "label": "Проживание в доме престарелых",
        "kind": "boolean"
      },
      {
        "key": "neoplasm",
        "label": "Злокачественное новообразование",
        "kind": "boolean"
      },
      {
        "key": "liverDisease",
        "label": "Заболевание печени",
        "kind": "boolean"
      },
      {
        "key": "chf",
        "label": "ХСН",
        "kind": "boolean"
      },
      {
        "key": "cerebrovascular",
        "label": "Цереброваскулярные заболевания",
        "kind": "boolean"
      },
      {
        "key": "renalDisease",
        "label": "Заболевание почек",
        "kind": "boolean"
      },
      {
        "key": "alteredMentalStatus",
        "label": "Нарушение сознания",
        "kind": "boolean"
      },
      {
        "key": "rr30",
        "label": "ЧДД ≥ 30 /мин",
        "kind": "boolean"
      },
      {
        "key": "sbpLt90",
        "label": "АД < 90 мм рт.ст.",
        "kind": "boolean"
      },
      {
        "key": "tempAbnormal",
        "label": "Температура < 35°C или ≥ 40°C",
        "kind": "boolean"
      },
      {
        "key": "hr125",
        "label": "ЧСС ≥ 125 уд/мин",
        "kind": "boolean"
      },
      {
        "key": "phLt735",
        "label": "pH < 7.35",
        "kind": "boolean"
      },
      {
        "key": "bunHigh",
        "label": "Мочевина крови ≥ 30 мг/дл",
        "kind": "boolean"
      },
      {
        "key": "naLow",
        "label": "Na < 130 мЭкв/л",
        "kind": "boolean"
      },
      {
        "key": "glucoseHigh",
        "label": "Глюкоза ≥ 250 мг/дл",
        "kind": "boolean"
      },
      {
        "key": "hctLow",
        "label": "Гематокрит < 30%",
        "kind": "boolean"
      },
      {
        "key": "po2Low",
        "label": "PaO₂ < 60 мм рт.ст.",
        "kind": "boolean"
      },
      {
        "key": "pleuralEffusion",
        "label": "Плевральный выпот",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "`PSI/PORT — Класс ${result.riskClass}`"
      },
      {
        "key": "riskClass"
      },
      {
        "key": "mortality"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "stop_bang",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "STOP-BANG",
    "type": "scale",
    "description": "Риск синдрома обструктивного апноэ сна",
    "module": "stop_bang",
    "fn": "calculateStopBang",
    "citation": "Chung F, et al. Anesthesiology. 2008;108(5):812-821.",
    "fields": [
      {
        "key": "snoring",
        "label": "S — Храп",
        "kind": "boolean",
        "hint": "Громко храпите (слышно через закрытую дверь)?"
      },
      {
        "key": "tired",
        "label": "T — Усталость",
        "kind": "boolean",
        "hint": "Часто чувствуете усталость, утомление или сонливость днём?"
      },
      {
        "key": "observed",
        "label": "O — Наблюдение",
        "kind": "boolean",
        "hint": "Кто-либо наблюдал остановки дыхания во время вашего сна?"
      },
      {
        "key": "pressure",
        "label": "P — Давление",
        "kind": "boolean",
        "hint": "Есть или лечите артериальную гипертензию?"
      },
      {
        "key": "bmi",
        "label": "B — ИМТ",
        "kind": "boolean",
        "hint": "ИМТ > 35 кг/м²?"
      },
      {
        "key": "age",
        "label": "A — Возраст",
        "kind": "boolean",
        "hint": "Возраст > 50 лет?"
      },
      {
        "key": "neck",
        "label": "N — Шея",
        "kind": "boolean",
        "hint": "Окружность шеи > 40 см?"
      },
      {
        "key": "gender",
        "label": "G — Пол",
        "kind": "boolean",
        "hint": "Мужской пол?"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "STOP-BANG"
      },
      {
        "key": "risk"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "revised_geneva",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "Geneva (пересм.)",
    "shortName": "Revised Geneva",
    "type": "scale",
    "description": "Вероятность ТЭЛА (пересмотренная шкала Женевы)",
    "module": "revised_geneva",
    "fn": "calculateRevisedGeneva",
    "citation": "Le Gal G, et al. Ann Intern Med. 2006;144(3):165-171.",
    "fields": [
      {
        "key": "age65",
        "label": "Возраст > 65 лет",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "previousPeDvt",
        "label": "Ранее ТЭЛА или ТГВ",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "surgeryFracture",
        "label": "Операция или перелом за последний месяц",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "activeMalignancy",
        "label": "Активное злокачественное новообразование",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "unilateralLegPain",
        "label": "Односторонняя боль в ноге",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "hemoptysis",
        "label": "Кровохарканье",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "hr75to94",
        "label": "ЧСС 75–94 уд/мин",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "hr95plus",
        "label": "ЧСС ≥ 95 уд/мин",
        "kind": "boolean",
        "points": "+5"
      },
      {
        "key": "legPainPalpation",
        "label": "Боль при пальпации + отёк ноги",
        "kind": "boolean",
        "points": "+4"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Женева (пересм.)"
      },
      {
        "key": "probability"
      },
      {
        "key": "prevalence"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "epworth",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "Шкала Эпворта",
    "shortName": "Epworth",
    "type": "scale",
    "description": "Дневная сонливость",
    "module": "epworth",
    "fn": "calculateEpworth",
    "citation": "Johns MW. Sleep. 1991;14(6):540-545.",
    "fields": [
      {
        "key": "sitting",
        "label": "Сидя и читая",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Никогда не засыпаю"
          },
          {
            "value": 1,
            "label": "1 — Малая вероятность засыпания"
          },
          {
            "value": 2,
            "label": "2 — Умеренная вероятность"
          },
          {
            "value": 3,
            "label": "3 — Высокая вероятность"
          }
        ]
      },
      {
        "key": "watching_tv",
        "label": "Просматривая телевизор",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Никогда не засыпаю"
          },
          {
            "value": 1,
            "label": "1 — Малая вероятность засыпания"
          },
          {
            "value": 2,
            "label": "2 — Умеренная вероятность"
          },
          {
            "value": 3,
            "label": "3 — Высокая вероятность"
          }
        ]
      },
      {
        "key": "sitting_inactive",
        "label": "Сидя в пассивной ситуации (лекция, совещание)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Никогда не засыпаю"
          },
          {
            "value": 1,
            "label": "1 — Малая вероятность засыпания"
          },
          {
            "value": 2,
            "label": "2 — Умеренная вероятность"
          },
          {
            "value": 3,
            "label": "3 — Высокая вероятность"
          }
        ]
      },
      {
        "key": "passenger",
        "label": "В качестве пассажира в транспорте (1 час без остановок)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Никогда не засыпаю"
          },
          {
            "value": 1,
            "label": "1 — Малая вероятность засыпания"
          },
          {
            "value": 2,
            "label": "2 — Умеренная вероятность"
          },
          {
            "value": 3,
            "label": "3 — Высокая вероятность"
          }
        ]
      },
      {
        "key": "lying_afternoon",
        "label": "Лёжа отдыхая после обеда (когда есть возможность)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Никогда не засыпаю"
          },
          {
            "value": 1,
            "label": "1 — Малая вероятность засыпания"
          },
          {
            "value": 2,
            "label": "2 — Умеренная вероятность"
          },
          {
            "value": 3,
            "label": "3 — Высокая вероятность"
          }
        ]
      },
      {
        "key": "sitting_talking",
        "label": "Сидя и разговаривая",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Никогда не засыпаю"
          },
          {
            "value": 1,
            "label": "1 — Малая вероятность засыпания"
          },
          {
            "value": 2,
            "label": "2 — Умеренная вероятность"
          },
          {
            "value": 3,
            "label": "3 — Высокая вероятность"
          }
        ]
      },
      {
        "key": "sitting_after_lunch",
        "label": "Сидя спокойно после обеда (без алкоголя)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Никогда не засыпаю"
          },
          {
            "value": 1,
            "label": "1 — Малая вероятность засыпания"
          },
          {
            "value": 2,
            "label": "2 — Умеренная вероятность"
          },
          {
            "value": 3,
            "label": "3 — Высокая вероятность"
          }
        ]
      },
      {
        "key": "in_car_traffic",
        "label": "За рулём, стоя в пробке (несколько минут)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Никогда не засыпаю"
          },
          {
            "value": 1,
            "label": "1 — Малая вероятность засыпания"
          },
          {
            "value": 2,
            "label": "2 — Умеренная вероятность"
          },
          {
            "value": 3,
            "label": "3 — Высокая вероятность"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Шкала Эпворта"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "rockall",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Rockall",
    "type": "scale",
    "description": "Смертность и риск рецидива при ЖКК",
    "module": "rockall",
    "fn": "calculateRockall",
    "citation": "Rockall TA, et al. Gut. 1996;38(3):316-321.",
    "fields": [
      {
        "key": "age",
        "label": "Возраст",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "< 60 лет"
          },
          {
            "value": 1,
            "label": "60–79 лет"
          },
          {
            "value": 2,
            "label": "≥ 80 лет"
          }
        ]
      },
      {
        "key": "shock",
        "label": "Гемодинамика / шок",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Нет — АД ≥ 100, ЧСС < 100"
          },
          {
            "value": 1,
            "label": "Тахикардия — АД ≥ 100, ЧСС ≥ 100"
          },
          {
            "value": 2,
            "label": "Гипотензия — АД < 90"
          }
        ]
      },
      {
        "key": "comorbidity",
        "label": "Сопутствующие заболевания",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Нет"
          },
          {
            "value": 2,
            "label": "СН / ИБС / другие тяжёлые"
          },
          {
            "value": 3,
            "label": "Почечная/печёночная недостаточность / метастазы"
          }
        ]
      },
      {
        "key": "diagnosis",
        "label": "Диагноз (по эндоскопии)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Разрыв Мэллори-Вейсса / нет поражения"
          },
          {
            "value": 1,
            "label": "Другой диагноз"
          },
          {
            "value": 2,
            "label": "Злокачественное новообразование"
          }
        ]
      },
      {
        "key": "bleedingSigns",
        "label": "Эндоскопические признаки кровотечения",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Нет / тёмное пятно"
          },
          {
            "value": 2,
            "label": "Кровь в желудке / сгусток / видимый сосуд / активное кровотечение"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Rockall Score"
      },
      {
        "key": "mortality"
      },
      {
        "key": "rebleed"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "alvarado",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Alvarado (MANTRELS)",
    "shortName": "Alvarado",
    "type": "scale",
    "description": "Вероятность острого аппендицита",
    "module": "alvarado",
    "fn": "calculateAlvarado",
    "citation": "Alvarado A. Ann Emerg Med. 1986;15(5):557-564.",
    "fields": [
      {
        "key": "migrationPain",
        "label": "М — Миграция боли в правую подвздошную область",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "anorexia",
        "label": "A — Анорексия",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "nausea",
        "label": "N — Тошнота/рвота",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "rlqTenderness",
        "label": "T — Болезненность в правой подвздошной области",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "rebound",
        "label": "R — Симптом отдачи",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "fever",
        "label": "E — Температура > 37.3°C",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "leukocytosis",
        "label": "L — Лейкоцитоз > 10 000",
        "kind": "boolean",
        "points": "+2"
      },
      {
        "key": "leftShift",
        "label": "S — Сдвиг формулы влево (> 75% нейтрофилов)",
        "kind": "boolean",
        "points": "+1"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Alvarado Score"
      },
      {
        "key": "probability"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "mayo_uc",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Mayo (ЯК)",
    "shortName": "Mayo UC",
    "type": "scale",
    "description": "Активность язвенного колита",
    "module": "mayo_uc",
    "fn": "calculateMayoUC",
    "citation": "Schroeder KW, et al. N Engl J Med. 1987;317(26):1625-1629.",
    "fields": [
      {
        "key": "stoolFrequency",
        "label": "Частота стула",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нормальная частота"
          },
          {
            "value": 1,
            "label": "1 — На 1–2 раза больше нормы"
          },
          {
            "value": 2,
            "label": "2 — На 3–4 раза больше нормы"
          },
          {
            "value": 3,
            "label": "3 — На 5+ раз больше нормы"
          }
        ]
      },
      {
        "key": "rectalBleeding",
        "label": "Ректальное кровотечение",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Прожилки крови < 50% дефекаций"
          },
          {
            "value": 2,
            "label": "2 — Явная кровь в большинстве дефекаций"
          },
          {
            "value": 3,
            "label": "3 — Преимущественно кровь"
          }
        ]
      },
      {
        "key": "physicianAssessment",
        "label": "Общая оценка врача",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Норма"
          },
          {
            "value": 1,
            "label": "1 — Лёгкое обострение"
          },
          {
            "value": 2,
            "label": "2 — Умеренное обострение"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлое обострение"
          }
        ]
      },
      {
        "key": "endoscopy",
        "label": "Эндоскопические находки",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Норма или неактивная болезнь"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая (эритема, сниженная васкуляризация)"
          },
          {
            "value": 2,
            "label": "2 — Умеренная (выраженная эритема, эрозии)"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая (язвы, спонтанное кровотечение)"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Mayo UC Score"
      },
      {
        "key": "activity"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "hbi",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Harvey-Bradshaw (БК)",
    "shortName": "HBI",
    "type": "scale",
    "description": "Активность болезни Крона",
    "module": "hbi",
    "fn": "calculateHBI",
    "citation": "Harvey RF, Bradshaw JM. Lancet. 1980;1(8167):514.",
    "fields": [
      {
        "key": "generalWellbeing",
        "label": "Общее самочувствие",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Очень хорошее"
          },
          {
            "value": 1,
            "label": "1 — Чуть хуже нормы"
          },
          {
            "value": 2,
            "label": "2 — Плохое"
          },
          {
            "value": 3,
            "label": "3 — Очень плохое"
          },
          {
            "value": 4,
            "label": "4 — Ужасное"
          }
        ]
      },
      {
        "key": "abdominalPain",
        "label": "Боль в животе",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          }
        ]
      },
      {
        "key": "liquidStools",
        "label": "Количество жидкого стула в сутки",
        "kind": "number",
        "placeholder": "3"
      },
      {
        "key": "abdominalMass",
        "label": "Образование в животе",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Сомнительное"
          },
          {
            "value": 2,
            "label": "2 — Определённое"
          },
          {
            "value": 3,
            "label": "3 — Определённое + болезненное"
          }
        ]
      },
      {
        "key": "arthritis",
        "label": "Артрит",
        "kind": "boolean"
      },
      {
        "key": "uveitis",
        "label": "Увеит",
        "kind": "boolean"
      },
      {
        "key": "erythemaNodosum",
        "label": "Узловатая эритема",
        "kind": "boolean"
      },
      {
        "key": "pyodermaGangrenosum",
        "label": "Гангренозная пиодермия",
        "kind": "boolean"
      },
      {
        "key": "aphthousUlcers",
        "label": "Афтозные язвы",
        "kind": "boolean"
      },
      {
        "key": "analFissure",
        "label": "Анальная трещина",
        "kind": "boolean"
      },
      {
        "key": "fistula",
        "label": "Свищ",
        "kind": "boolean"
      },
      {
        "key": "abscess",
        "label": "Абсцесс",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Harvey-Bradshaw Index"
      },
      {
        "key": "activity"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "meld3",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "MELD 3.0",
    "type": "formula",
    "description": "Смертность при болезнях печени (обновлённая формула)",
    "module": "meld3",
    "fn": "calculateMELD3",
    "citation": "Kim WR, et al. N Engl J Med. 2021;384(7):599-609.",
    "fields": [
      {
        "key": "bilirubin",
        "label": "Билирубин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "2.0",
        "hint": "≥ 1.0 (мин.)",
        "step": 0.1
      },
      {
        "key": "creatinine",
        "label": "Креатинин",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "1.5",
        "hint": "1.0–4.0",
        "step": 0.1
      },
      {
        "key": "inr",
        "label": "МНО (INR)",
        "kind": "number",
        "placeholder": "1.5",
        "hint": "≥ 1.0",
        "step": 0.1
      },
      {
        "key": "sodium",
        "label": "Натрий",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "135",
        "hint": "125–137"
      },
      {
        "key": "female",
        "label": "Женский пол (+1.85 балла)",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "MELD 3.0"
      },
      {
        "key": "mortality90Day"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "phq2",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "PHQ-2",
    "type": "scale",
    "description": "Ультрабыстрый скрининг депрессии (2 вопроса)",
    "module": "phq2",
    "fn": "calculatePHQ2",
    "citation": "Kroenke K, et al. The Patient Health Questionnaire-2. Med Care. 2003;41(11):1284-1292.",
    "fields": [
      {
        "key": "q1",
        "label": "Подавленное настроение, депрессия, безнадёжность",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Снижение интереса или удовольствия",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "PHQ-2"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "positiveScreen"
      }
    ]
  },
  {
    "id": "bdi2",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "BDI-II",
    "type": "scale",
    "description": "Шкала депрессии Бека (21 вопрос, самооценка)",
    "module": "bdi2",
    "fn": "calculateBDI2",
    "citation": "Beck AT, et al. Psychometric properties of the Beck Depression Inventory. Clin Psychol Rev. 1988;8(1):77-100.",
    "fields": [
      {
        "key": "q1",
        "label": "Грусть",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Пессимизм",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q3",
        "label": "Прошлые неудачи",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q4",
        "label": "Потеря удовольствия",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q5",
        "label": "Чувство вины",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q6",
        "label": "Чувство наказания",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q7",
        "label": "Недовольство собой",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q8",
        "label": "Самокритика",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q9",
        "label": "Суицидальные мысли или желание причинить себе вред",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q10",
        "label": "Плаксивость",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q11",
        "label": "Возбуждение",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q12",
        "label": "Потеря интереса",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q13",
        "label": "Нерешительность",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q14",
        "label": "Ощущение бесполезности",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q15",
        "label": "Потеря энергии",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q16",
        "label": "Изменения режима сна",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q17",
        "label": "Раздражительность",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q18",
        "label": "Изменения аппетита",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q19",
        "label": "Трудности с концентрацией",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q20",
        "label": "Усталость или утомляемость",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      },
      {
        "key": "q21",
        "label": "Потеря интереса к сексу",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — отсутствует"
          },
          {
            "value": 1,
            "label": "1 — лёгкая степень"
          },
          {
            "value": 2,
            "label": "2 — умеренная степень"
          },
          {
            "value": 3,
            "label": "3 — выраженная степень"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "BDI-II"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "cognitiveAffective"
      },
      {
        "key": "somatic"
      },
      {
        "key": "suicidalIdeation"
      }
    ]
  },
  {
    "id": "hamd17",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "HAM-D 17",
    "type": "scale",
    "description": "Шкала депрессии Гамильтона (клиницист, 17 пунктов)",
    "module": "hamd17",
    "fn": "calculateHAMD17",
    "citation": "Hamilton M. A rating scale for depression. J Neurol Neurosurg Psychiatry. 1960;23:56-62.",
    "fields": [
      {
        "key": "q1",
        "label": "Депрессивное настроение",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Чувство вины",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q3",
        "label": "Суицид",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q4",
        "label": "Начальная инсомния (трудности засыпания)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          }
        ]
      },
      {
        "key": "q5",
        "label": "Средняя инсомния (пробуждения ночью)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          }
        ]
      },
      {
        "key": "q6",
        "label": "Поздняя инсомния (ранние пробуждения)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          }
        ]
      },
      {
        "key": "q7",
        "label": "Работа и активность",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q8",
        "label": "Психомоторная заторможенность",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q9",
        "label": "Ажитация",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q10",
        "label": "Психическая тревога",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q11",
        "label": "Соматическая тревога",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q12",
        "label": "Соматические симптомы — ЖКТ",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          }
        ]
      },
      {
        "key": "q13",
        "label": "Общие соматические симптомы",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          }
        ]
      },
      {
        "key": "q14",
        "label": "Генитальные симптомы",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          }
        ]
      },
      {
        "key": "q15",
        "label": "Ипохондрия",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          },
          {
            "value": 3,
            "label": "3"
          },
          {
            "value": 4,
            "label": "4"
          }
        ]
      },
      {
        "key": "q16",
        "label": "Снижение веса",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          }
        ]
      },
      {
        "key": "q17",
        "label": "Критичность к своему состоянию",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0"
          },
          {
            "value": 1,
            "label": "1"
          },
          {
            "value": 2,
            "label": "2"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "HAM-D 17"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "suicidalRisk"
      }
    ]
  },
  {
    "id": "hads",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "HADS",
    "type": "scale",
    "description": "Шкала тревоги и депрессии (14 вопросов, соматические пациенты)",
    "module": "hads",
    "fn": "calculateHADS",
    "fields": [
      {
        "key": "a1",
        "label": "Я испытываю напряжение, взвинченность",
        "kind": "select",
        "options": [
          {
            "label": "Всё время",
            "value": 3
          },
          {
            "label": "Часто",
            "value": 2
          },
          {
            "label": "Иногда",
            "value": 1
          },
          {
            "label": "Совсем нет",
            "value": 0
          }
        ]
      },
      {
        "key": "a3",
        "label": "Я испытываю страх, ощущение, что что-то ужасное вот-вот случится",
        "kind": "select",
        "options": [
          {
            "label": "Определённо и очень сильно",
            "value": 3
          },
          {
            "label": "Да, но не слишком сильно",
            "value": 2
          },
          {
            "label": "Немного и не слишком",
            "value": 1
          },
          {
            "label": "Совсем нет",
            "value": 0
          }
        ]
      },
      {
        "key": "a5",
        "label": "Беспокойные мысли крутятся у меня в голове",
        "kind": "select",
        "options": [
          {
            "label": "Большую часть времени",
            "value": 3
          },
          {
            "label": "Часто",
            "value": 2
          },
          {
            "label": "Иногда",
            "value": 1
          },
          {
            "label": "Только иногда",
            "value": 0
          }
        ]
      },
      {
        "key": "a7",
        "label": "Я могу легко сесть и расслабиться",
        "kind": "select",
        "options": [
          {
            "label": "Определённо да",
            "value": 0
          },
          {
            "label": "Наверное да",
            "value": 1
          },
          {
            "label": "Редко",
            "value": 2
          },
          {
            "label": "Совсем не могу",
            "value": 3
          }
        ]
      },
      {
        "key": "a9",
        "label": "Я испытываю ощущение испуга и паники",
        "kind": "select",
        "options": [
          {
            "label": "Очень часто",
            "value": 3
          },
          {
            "label": "Довольно часто",
            "value": 2
          },
          {
            "label": "Иногда",
            "value": 1
          },
          {
            "label": "Совсем нет",
            "value": 0
          }
        ]
      },
      {
        "key": "a11",
        "label": "Я чувствую беспокойство, и мне трудно усидеть на месте",
        "kind": "select",
        "options": [
          {
            "label": "Очень сильно",
            "value": 3
          },
          {
            "label": "Довольно",
            "value": 2
          },
          {
            "label": "Немного",
            "value": 1
          },
          {
            "label": "Совсем нет",
            "value": 0
          }
        ]
      },
      {
        "key": "a13",
        "label": "У меня бывает внезапное ощущение паники",
        "kind": "select",
        "options": [
          {
            "label": "Очень часто",
            "value": 3
          },
          {
            "label": "Довольно часто",
            "value": 2
          },
          {
            "label": "Нечасто",
            "value": 1
          },
          {
            "label": "Совсем нет",
            "value": 0
          }
        ]
      },
      {
        "key": "d2",
        "label": "То, что приносило мне большое удовольствие, и сейчас вызывает у меня такое же чувство",
        "kind": "select",
        "options": [
          {
            "label": "Определённо так",
            "value": 0
          },
          {
            "label": "Наверное, это так",
            "value": 1
          },
          {
            "label": "Лишь в очень малой степени",
            "value": 2
          },
          {
            "label": "Это совсем не так",
            "value": 3
          }
        ]
      },
      {
        "key": "d4",
        "label": "Я способен рассмеяться и увидеть в том или ином событии смешное",
        "kind": "select",
        "options": [
          {
            "label": "Как обычно",
            "value": 0
          },
          {
            "label": "Немного меньше",
            "value": 1
          },
          {
            "label": "Значительно меньше",
            "value": 2
          },
          {
            "label": "Совсем нет",
            "value": 3
          }
        ]
      },
      {
        "key": "d6",
        "label": "Я чувствую бодрость",
        "kind": "select",
        "options": [
          {
            "label": "Совсем не чувствую",
            "value": 3
          },
          {
            "label": "Очень редко",
            "value": 2
          },
          {
            "label": "Иногда",
            "value": 1
          },
          {
            "label": "Большую часть времени",
            "value": 0
          }
        ]
      },
      {
        "key": "d8",
        "label": "Мне кажется, что я стал всё делать очень медленно",
        "kind": "select",
        "options": [
          {
            "label": "Почти всегда",
            "value": 3
          },
          {
            "label": "Часто",
            "value": 2
          },
          {
            "label": "Иногда",
            "value": 1
          },
          {
            "label": "Совсем нет",
            "value": 0
          }
        ]
      },
      {
        "key": "d10",
        "label": "Я не слежу за своей внешностью",
        "kind": "select",
        "options": [
          {
            "label": "Определённо это так",
            "value": 3
          },
          {
            "label": "Меньше, чем обычно",
            "value": 2
          },
          {
            "label": "Возможно, я стал меньше уделять этому внимания",
            "value": 1
          },
          {
            "label": "Я слежу столько же, что и раньше",
            "value": 0
          }
        ]
      },
      {
        "key": "d12",
        "label": "Я с удовольствием жду предстоящих событий",
        "kind": "select",
        "options": [
          {
            "label": "Как и обычно",
            "value": 0
          },
          {
            "label": "Немного меньше, чем обычно",
            "value": 1
          },
          {
            "label": "Значительно меньше, чем обычно",
            "value": 2
          },
          {
            "label": "Почти никогда",
            "value": 3
          }
        ]
      },
      {
        "key": "d14",
        "label": "Я могу получить удовольствие от хорошей книги, радио- или телепрограммы",
        "kind": "select",
        "options": [
          {
            "label": "Часто",
            "value": 0
          },
          {
            "label": "Иногда",
            "value": 1
          },
          {
            "label": "Редко",
            "value": 2
          },
          {
            "label": "Очень редко",
            "value": 3
          }
        ]
      }
    ],
    "result": [
      {
        "key": "anxiety.score",
        "subKey": "score",
        "group": "HADS-A — Тревога"
      },
      {
        "key": "anxiety.severity",
        "subKey": "severity",
        "group": "HADS-A — Тревога"
      },
      {
        "key": "anxiety.level",
        "subKey": "level",
        "group": "HADS-A — Тревога"
      },
      {
        "key": "depression.score",
        "subKey": "score",
        "group": "HADS-D — Депрессия"
      },
      {
        "key": "depression.severity",
        "subKey": "severity",
        "group": "HADS-D — Депрессия"
      },
      {
        "key": "depression.level",
        "subKey": "level",
        "group": "HADS-D — Депрессия"
      }
    ]
  },
  {
    "id": "gds15",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "GDS-15",
    "type": "scale",
    "description": "Гериатрическая шкала депрессии (для пациентов ≥65 лет)",
    "module": "gds15",
    "fn": "calculateGDS15",
    "citation": "Sheikh JI, Yesavage JA. Geriatric Depression Scale (GDS). Clin Gerontol. 1986;5(1-2):165-173.",
    "fields": [
      {
        "key": "q1",
        "label": "В целом вы довольны своей жизнью?",
        "kind": "boolean"
      },
      {
        "key": "q2",
        "label": "Вы забросили многие свои занятия и интересы?",
        "kind": "boolean"
      },
      {
        "key": "q3",
        "label": "Вы ощущаете, что ваша жизнь пуста?",
        "kind": "boolean"
      },
      {
        "key": "q4",
        "label": "Вам часто бывает скучно?",
        "kind": "boolean"
      },
      {
        "key": "q5",
        "label": "Вы обычно в хорошем настроении?",
        "kind": "boolean"
      },
      {
        "key": "q6",
        "label": "Вы боитесь, что с вами случится что-то плохое?",
        "kind": "boolean"
      },
      {
        "key": "q7",
        "label": "Вы чувствуете себя счастливым большую часть времени?",
        "kind": "boolean"
      },
      {
        "key": "q8",
        "label": "Вы часто чувствуете беспомощность?",
        "kind": "boolean"
      },
      {
        "key": "q9",
        "label": "Вы предпочитаете оставаться дома, а не выходить и не делать что-то новое?",
        "kind": "boolean"
      },
      {
        "key": "q10",
        "label": "Вы считаете, что у вас больше проблем с памятью, чем у большинства?",
        "kind": "boolean"
      },
      {
        "key": "q11",
        "label": "Вы думаете, что жить — это замечательно?",
        "kind": "boolean"
      },
      {
        "key": "q12",
        "label": "Вы чувствуете себя никчёмным таким, какой вы есть?",
        "kind": "boolean"
      },
      {
        "key": "q13",
        "label": "Вы ощущаете прилив энергии?",
        "kind": "boolean"
      },
      {
        "key": "q14",
        "label": "Вы считаете, что ваша ситуация безнадёжна?",
        "kind": "boolean"
      },
      {
        "key": "q15",
        "label": "Вы думаете, что у большинства людей положение лучше, чем у вас?",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "GDS-15"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "bai",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "BAI",
    "type": "scale",
    "description": "Шкала тревоги Бека (21 вопрос, самооценка)",
    "module": "bai",
    "fn": "calculateBAI",
    "citation": "Beck AT, et al. An inventory for measuring clinical anxiety. J Consult Clin Psychol. 1988;56(6):893-897.",
    "fields": [
      {
        "key": "q1",
        "label": "Онемение или покалывание",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Приливы жара",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q3",
        "label": "Дрожь в ногах",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q4",
        "label": "Неспособность расслабиться",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q5",
        "label": "Страх, что случится что-то ужасное",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q6",
        "label": "Головокружение или дурнота",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q7",
        "label": "Учащённое сердцебиение",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q8",
        "label": "Неустойчивость",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q9",
        "label": "Ужас",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q10",
        "label": "Нервозность",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q11",
        "label": "Ощущение удушья",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q12",
        "label": "Дрожание рук",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q13",
        "label": "Дрожь или шаткость",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q14",
        "label": "Страх потерять контроль",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q15",
        "label": "Затруднённое дыхание",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q16",
        "label": "Страх смерти",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q17",
        "label": "Испуг",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q18",
        "label": "Расстройство желудка или тошнота",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q19",
        "label": "Обмороки или слабость",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q20",
        "label": "Покраснение лица",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      },
      {
        "key": "q21",
        "label": "Потоотделение (не связанное с жарой)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — слабо"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — сильно"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "BAI"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "hama",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "HAM-A",
    "type": "scale",
    "description": "Шкала тревоги Гамильтона (клиницист, 14 пунктов)",
    "module": "hama",
    "fn": "calculateHAMA",
    "citation": "Hamilton M. The assessment of anxiety states by rating. Br J Med Psychol. 1959;32(1):50-55.",
    "fields": [
      {
        "key": "q1",
        "label": "Тревожное настроение (беспокойство, раздражительность, страх, ощущение надвигающегося несчастья)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Напряжение (чувство усталости, дрожь, плаксивость, невозможность расслабиться)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q3",
        "label": "Страхи (темноты, незнакомых людей, транспорта, одиночества, животных)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q4",
        "label": "Инсомния (трудности засыпания, прерывистый сон, ранние пробуждения, кошмары)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q5",
        "label": "Интеллектуальные нарушения (трудности концентрации, ухудшение памяти)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q6",
        "label": "Депрессивное настроение (утрата интереса, ангедония)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q7",
        "label": "Соматические симптомы — мышечные (боли, мышечное напряжение, скрежетание зубами)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q8",
        "label": "Соматические симптомы — сенсорные (звон в ушах, нечёткость зрения, ощущение жара/холода)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q9",
        "label": "Сердечно-сосудистые симптомы (тахикардия, учащённый пульс, боль в груди)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q10",
        "label": "Дыхательные симптомы (давление в груди, одышка, ощущение сдавливания)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q11",
        "label": "ЖКТ симптомы (затруднённое глотание, тошнота, диарея, спазмы)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q12",
        "label": "Мочеполовые симптомы (учащённое мочеиспускание, импотенция/менструальные нарушения)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q13",
        "label": "Вегетативные симптомы (сухость рта, бледность/гиперемия, потливость, головокружение)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      },
      {
        "key": "q14",
        "label": "Поведение при осмотре (двигательное возбуждение, дрожь, нахмуренность, напряжённость)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — нет"
          },
          {
            "value": 1,
            "label": "1 — лёгкая"
          },
          {
            "value": 2,
            "label": "2 — умеренная"
          },
          {
            "value": 3,
            "label": "3 — тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — очень тяжёлая"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "HAM-A"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "psychicSubscale"
      },
      {
        "key": "somaticSubscale"
      }
    ]
  },
  {
    "id": "k10",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "K10 Kessler",
    "type": "scale",
    "description": "Шкала психологического дистресса Кесслера (10 вопросов)",
    "module": "k10",
    "fn": "calculateK10",
    "citation": "Kessler RC, et al. Short screening scales to monitor population prevalences and trends in non-specific psychological distress. Psychol Med. 2002;32(6):959-976.",
    "fields": [
      {
        "key": "q1",
        "label": "Вы чувствовали усталость без видимой причины?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Вы были нервозны?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q3",
        "label": "Вы были так нервозны, что ничто не могло вас успокоить?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q4",
        "label": "Вы чувствовали безнадёжность?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q5",
        "label": "Вы были беспокойны или взволнованны?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q6",
        "label": "Вы были так беспокойны, что не могли усидеть на месте?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q7",
        "label": "Вы чувствовали себя подавленным или в депрессии?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q8",
        "label": "Вы чувствовали, что вам трудно поднять настроение?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q9",
        "label": "Вы чувствовали, что любое дело требует огромных усилий?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      },
      {
        "key": "q10",
        "label": "Вы чувствовали собственную никчёмность?",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — никогда"
          },
          {
            "value": 2,
            "label": "2 — иногда"
          },
          {
            "value": 3,
            "label": "3 — часть времени"
          },
          {
            "value": 4,
            "label": "4 — большую часть"
          },
          {
            "value": 5,
            "label": "5 — всё время"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "K10"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "pcl5",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "PCL-5",
    "type": "scale",
    "description": "Опросник ПТСР по DSM-5 (20 вопросов)",
    "module": "pcl5",
    "fn": "calculatePCL5",
    "citation": "Weathers FW, et al. The PTSD Checklist for DSM-5. National Center for PTSD. 2013.",
    "fields": [
      {
        "key": "q1",
        "label": "Повторяющиеся, тягостные воспоминания о травматическом событии",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Повторяющиеся тревожные сны о событии",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q3",
        "label": "Внезапное ощущение или поведение, как будто событие происходит снова (флэшбэки)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q4",
        "label": "Сильное эмоциональное расстройство при напоминании о событии",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q5",
        "label": "Сильные физические реакции при напоминании о событии",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q6",
        "label": "Избегание воспоминаний, мыслей или чувств, связанных с событием",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q7",
        "label": "Избегание внешних напоминаний о событии (людей, мест, разговоров)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q8",
        "label": "Нарушение памяти на важные аспекты события",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q9",
        "label": "Стойкие негативные убеждения о себе, других или мире",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q10",
        "label": "Обвинение себя или других в событии или его последствиях",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q11",
        "label": "Стойкие негативные эмоции (страх, ужас, гнев, вина, стыд)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q12",
        "label": "Значительно сниженный интерес к значимой деятельности",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q13",
        "label": "Ощущение отчуждённости или оторванности от других",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q14",
        "label": "Неспособность испытывать положительные эмоции",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q15",
        "label": "Раздражительность или вспышки гнева, агрессивное поведение",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q16",
        "label": "Безрассудное или саморазрушительное поведение",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q17",
        "label": "Гипербдительность",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q18",
        "label": "Повышенная реакция испуга",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q19",
        "label": "Трудности с концентрацией",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      },
      {
        "key": "q20",
        "label": "Нарушения сна",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — совсем нет"
          },
          {
            "value": 1,
            "label": "1 — немного"
          },
          {
            "value": 2,
            "label": "2 — умеренно"
          },
          {
            "value": 3,
            "label": "3 — значительно"
          },
          {
            "value": 4,
            "label": "4 — чрезвычайно"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "PCL-5"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      },
      {
        "key": "clusterB"
      },
      {
        "key": "clusterC"
      },
      {
        "key": "clusterD"
      },
      {
        "key": "clusterE"
      },
      {
        "key": "provisionalPTSD"
      }
    ]
  },
  {
    "id": "mdq",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "MDQ",
    "type": "scale",
    "description": "Опросник расстройств настроения (биполярное расстройство)",
    "module": "mdq",
    "fn": "calculateMDQ",
    "fields": [
      {
        "key": "p1q1",
        "label": "Вы ощущали себя настолько хорошо или «на подъёме», что другие люди считали, что вы не в себе, или вы из-за этого попадали в неприятности?",
        "kind": "boolean"
      },
      {
        "key": "p1q2",
        "label": "Вы были настолько взбудоражены, что неприятности казались незначительными?",
        "kind": "boolean"
      },
      {
        "key": "p1q3",
        "label": "Вы были более самоуверенны, чем обычно?",
        "kind": "boolean"
      },
      {
        "key": "p1q4",
        "label": "Вы спали меньше обычного и не чувствовали усталости?",
        "kind": "boolean"
      },
      {
        "key": "p1q5",
        "label": "Вы были более разговорчивы или говорили быстрее обычного?",
        "kind": "boolean"
      },
      {
        "key": "p1q6",
        "label": "Мысли в голове роились и перескакивали одна на другую?",
        "kind": "boolean"
      },
      {
        "key": "p1q7",
        "label": "Вы легко отвлекались на посторонние вещи?",
        "kind": "boolean"
      },
      {
        "key": "p1q8",
        "label": "Вы были более энергичны, чем обычно?",
        "kind": "boolean"
      },
      {
        "key": "p1q9",
        "label": "Вы были более активны или делали больше обычного?",
        "kind": "boolean"
      },
      {
        "key": "p1q10",
        "label": "Вы были более общительны или экстравертированы, чем обычно?",
        "kind": "boolean"
      },
      {
        "key": "p1q11",
        "label": "Вы больше, чем обычно, интересовались сексом?",
        "kind": "boolean"
      },
      {
        "key": "p1q12",
        "label": "Вы делали вещи необычные для вас или которые другие считали чрезмерными?",
        "kind": "boolean"
      },
      {
        "key": "p1q13",
        "label": "Вы тратили деньги, что вызывало затруднения у вас или вашей семьи?",
        "kind": "boolean"
      },
      {
        "key": "part2",
        "label": "Часть 2",
        "kind": "boolean",
        "hint": "Если вы ответили «Да» на несколько вопросов выше — происходило ли несколько из этих состояний одновременно?"
      },
      {
        "key": "part3",
        "label": "Часть 3",
        "kind": "select",
        "hint": "Насколько эти состояния создавали проблемы (в семье, на работе, в отношениях)?",
        "options": [
          {
            "value": 0,
            "label": "Не создавало проблем"
          },
          {
            "value": 1,
            "label": "Незначительные проблемы"
          },
          {
            "value": 2,
            "label": "Умеренные проблемы"
          },
          {
            "value": 3,
            "label": "Серьёзные проблемы"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "part1Count"
      },
      {
        "key": "part1Positive"
      },
      {
        "key": "part2Positive"
      },
      {
        "key": "part3Positive"
      },
      {
        "key": "overallPositive"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "hcl32",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "HCL-32",
    "type": "scale",
    "description": "Чеклист гипомании (32 пункта) — скрининг биполярного спектра",
    "module": "hcl32",
    "fn": "calculateHCL32",
    "fields": [],
    "result": [
      {
        "key": "score"
      },
      {
        "key": "positive"
      },
      {
        "key": "severity"
      },
      {
        "key": "level"
      },
      {
        "key": "description"
      },
      {
        "key": "activatingCount"
      },
      {
        "key": "inhibitingCount"
      }
    ]
  },
  {
    "id": "lithium_perry",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "Литий: подбор дозы (Perry)",
    "type": "formula",
    "description": "Начальная доза Li₂CO₃ по регрессии Перри, без тест-дозы",
    "module": "lithium",
    "fn": "calculatePerry",
    "fields": [
      {
        "key": "targetCss",
        "label": "Целевой уровень Css (mmol/L)",
        "kind": "number"
      },
      {
        "key": "age",
        "label": "Возраст (лет)",
        "kind": "number"
      },
      {
        "key": "weight",
        "label": "Масса тела (кг)",
        "kind": "number"
      },
      {
        "key": "bun",
        "label": "Азот мочевины крови (BUN)",
        "kind": "number"
      },
      {
        "key": "ureaInMmol",
        "label": "Мочевина введена в ммоль/л",
        "kind": "boolean",
        "hint": "Пересчитывается в BUN: мочевина × 2.8"
      }
    ],
    "result": [
      {
        "key": "rawDose"
      },
      {
        "key": "roundedDose"
      }
    ]
  },
  {
    "id": "lithium_cooper",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "Литий: номограмма Купера",
    "type": "formula",
    "description": "Доза Li₂CO₃ по уровню через 24 ч после тест-дозы 600 мг",
    "module": "lithium",
    "fn": "calculateCooper",
    "fields": [
      {
        "key": "c24h",
        "label": "Уровень лития через 24 ч",
        "kind": "number",
        "unit": "ммоль/л",
        "placeholder": "0.2"
      }
    ],
    "result": [
      {
        "key": "dose"
      },
      {
        "key": "formulaDose"
      },
      {
        "key": "note"
      }
    ],
    "scalarArg": true
  },
  {
    "id": "lithium_level",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "Литий: интерпретация уровня",
    "type": "formula",
    "description": "Терапевтический диапазон и признаки токсичности",
    "module": "lithium",
    "fn": "interpretLithiumLevel",
    "fields": [
      {
        "key": "level",
        "label": "Уровень лития в сыворотке",
        "kind": "number",
        "unit": "ммоль/л",
        "placeholder": "0.8"
      },
      {
        "key": "indication",
        "label": "Показание",
        "kind": "select",
        "options": [
          {
            "value": "acute_mania",
            "label": "Острая мания (0.8–1.2)"
          },
          {
            "value": "maintenance",
            "label": "Поддерживающая терапия (0.6–1.0)"
          },
          {
            "value": "elderly",
            "label": "Пожилые пациенты (0.4–0.7)"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "severity"
      },
      {
        "key": "status"
      },
      {
        "key": "description"
      },
      {
        "key": "symptoms",
        "optional": true
      },
      {
        "key": "action",
        "optional": true
      }
    ]
  },
  {
    "id": "gad7",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "GAD-7",
    "type": "scale",
    "description": "Скрининг генерализованного тревожного расстройства",
    "module": "gad7",
    "fn": "calculateGAD7",
    "citation": "Spitzer RL, et al. Arch Intern Med. 2006;166(10):1092-1097.",
    "fields": [
      {
        "key": "q1",
        "label": "Чувство тревоги, беспокойства или напряжения",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q2",
        "label": "Невозможность остановить беспокойство или контролировать его",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q3",
        "label": "Чрезмерное беспокойство по различным поводам",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q4",
        "label": "Трудности с расслаблением",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q5",
        "label": "Такое беспокойство, что трудно усидеть на месте",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q6",
        "label": "Легко раздражаетесь или сердитесь",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      },
      {
        "key": "q7",
        "label": "Ощущение страха, как будто может случиться что-то ужасное",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "Ни разу"
          },
          {
            "value": 1,
            "label": "Несколько дней"
          },
          {
            "value": 2,
            "label": "Больше половины дней"
          },
          {
            "value": 3,
            "label": "Почти каждый день"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "GAD-7"
      },
      {
        "key": "level"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "mmse",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "MMSE",
    "type": "scale",
    "description": "Краткая оценка психического статуса",
    "module": "mmse",
    "fn": "calculateMMSE",
    "citation": "Folstein MF, et al. J Psychiatr Res. 1975;12(3):189-198.",
    "fields": [
      {
        "key": "orientationTime",
        "label": "Ориентация во времени",
        "kind": "number",
        "hint": "Год, сезон, месяц, дата, день недели"
      },
      {
        "key": "orientationPlace",
        "label": "Ориентация в месте",
        "kind": "number",
        "hint": "Страна, регион, город, больница, этаж"
      },
      {
        "key": "registration",
        "label": "Запоминание",
        "kind": "number",
        "hint": "Повторение 3 слов"
      },
      {
        "key": "attention",
        "label": "Внимание и счёт",
        "kind": "number",
        "hint": "Серийный счёт (100−7) или слово ЗЕМЛЯ в обратном порядке"
      },
      {
        "key": "recall",
        "label": "Воспроизведение",
        "kind": "number",
        "hint": "Вспомнить 3 слова"
      },
      {
        "key": "language",
        "label": "Речь",
        "kind": "number",
        "hint": "Называние, повторение, команды, чтение, письмо, рисование"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "MMSE"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "category"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "moca",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "MoCA",
    "type": "scale",
    "description": "Монреальская когнитивная оценка",
    "module": "moca",
    "fn": "calculateMoCA",
    "citation": "Nasreddine ZS, et al. J Am Geriatr Soc. 2005;53(4):695-699.",
    "fields": [
      {
        "key": "visuospatial",
        "label": "Зрительно-пространственная / исполнительная функция",
        "kind": "number",
        "hint": "Тест связи, рисование куба, часы"
      },
      {
        "key": "naming",
        "label": "Называние",
        "kind": "number",
        "hint": "Назвать 3 животных"
      },
      {
        "key": "attention",
        "label": "Внимание",
        "kind": "number",
        "hint": "Цифровой охват, бдительность, серийный счёт −7"
      },
      {
        "key": "language",
        "label": "Речь",
        "kind": "number",
        "hint": "Повторение фраз, беглость речи"
      },
      {
        "key": "abstraction",
        "label": "Абстракция",
        "kind": "number",
        "hint": "Сходство понятий"
      },
      {
        "key": "delayedRecall",
        "label": "Отсроченное воспроизведение",
        "kind": "number",
        "hint": "Вспомнить 5 слов через 5 мин"
      },
      {
        "key": "orientation",
        "label": "Ориентация",
        "kind": "number",
        "hint": "Дата, месяц, год, день, место, город"
      },
      {
        "key": "lowEducation",
        "label": "Образование ≤ 12 лет (+1 балл, макс. 30)",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score"
      },
      {
        "key": "adjustedScore",
        "label": "MoCA"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "category"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "audit",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "AUDIT",
    "type": "scale",
    "description": "Скрининг расстройств, связанных с употреблением алкоголя",
    "module": "audit",
    "fn": "calculateAUDIT",
    "citation": "Saunders JB, et al. Addiction. 1993;88(6):791-804.",
    "fields": [
      {
        "key": "q1",
        "label": "Как часто вы употребляете алкоголь?",
        "kind": "select",
        "options": [
          {
            "label": "Никогда",
            "value": 0
          },
          {
            "label": "Раз в месяц или реже",
            "value": 1
          },
          {
            "label": "2–4 раза в месяц",
            "value": 2
          },
          {
            "label": "2–3 раза в неделю",
            "value": 3
          },
          {
            "label": "4 раза в неделю и чаще",
            "value": 4
          }
        ]
      },
      {
        "key": "q2",
        "label": "Сколько доз алкоголя вы обычно выпиваете за один раз?",
        "kind": "select",
        "options": [
          {
            "label": "1–2 дозы",
            "value": 0
          },
          {
            "label": "3–4 дозы",
            "value": 1
          },
          {
            "label": "5–6 доз",
            "value": 2
          },
          {
            "label": "7–9 доз",
            "value": 3
          },
          {
            "label": "10 доз и более",
            "value": 4
          }
        ]
      },
      {
        "key": "q3",
        "label": "Как часто за один раз вы выпиваете 6 или более доз?",
        "kind": "select",
        "options": [
          {
            "label": "Никогда",
            "value": 0
          },
          {
            "label": "Реже раза в месяц",
            "value": 1
          },
          {
            "label": "Ежемесячно",
            "value": 2
          },
          {
            "label": "Еженедельно",
            "value": 3
          },
          {
            "label": "Ежедневно или почти ежедневно",
            "value": 4
          }
        ]
      },
      {
        "key": "q4",
        "label": "Как часто за последний год вы не могли остановиться, начав пить?",
        "kind": "select",
        "options": [
          {
            "label": "Никогда",
            "value": 0
          },
          {
            "label": "Реже раза в месяц",
            "value": 1
          },
          {
            "label": "Ежемесячно",
            "value": 2
          },
          {
            "label": "Еженедельно",
            "value": 3
          },
          {
            "label": "Ежедневно или почти ежедневно",
            "value": 4
          }
        ]
      },
      {
        "key": "q5",
        "label": "Как часто из-за алкоголя вы не выполняли то, что от вас ожидалось?",
        "kind": "select",
        "options": [
          {
            "label": "Никогда",
            "value": 0
          },
          {
            "label": "Реже раза в месяц",
            "value": 1
          },
          {
            "label": "Ежемесячно",
            "value": 2
          },
          {
            "label": "Еженедельно",
            "value": 3
          },
          {
            "label": "Ежедневно или почти ежедневно",
            "value": 4
          }
        ]
      },
      {
        "key": "q6",
        "label": "Как часто вам требовался алкоголь с утра, чтобы прийти в себя?",
        "kind": "select",
        "options": [
          {
            "label": "Никогда",
            "value": 0
          },
          {
            "label": "Реже раза в месяц",
            "value": 1
          },
          {
            "label": "Ежемесячно",
            "value": 2
          },
          {
            "label": "Еженедельно",
            "value": 3
          },
          {
            "label": "Ежедневно или почти ежедневно",
            "value": 4
          }
        ]
      },
      {
        "key": "q7",
        "label": "Как часто вы испытывали чувство вины или раскаяния после выпивки?",
        "kind": "select",
        "options": [
          {
            "label": "Никогда",
            "value": 0
          },
          {
            "label": "Реже раза в месяц",
            "value": 1
          },
          {
            "label": "Ежемесячно",
            "value": 2
          },
          {
            "label": "Еженедельно",
            "value": 3
          },
          {
            "label": "Ежедневно или почти ежедневно",
            "value": 4
          }
        ]
      },
      {
        "key": "q8",
        "label": "Как часто вы не могли вспомнить, что было накануне из-за выпивки?",
        "kind": "select",
        "options": [
          {
            "label": "Никогда",
            "value": 0
          },
          {
            "label": "Реже раза в месяц",
            "value": 1
          },
          {
            "label": "Ежемесячно",
            "value": 2
          },
          {
            "label": "Еженедельно",
            "value": 3
          },
          {
            "label": "Ежедневно или почти ежедневно",
            "value": 4
          }
        ]
      },
      {
        "key": "q9",
        "label": "Случались ли травмы у вас или кого-либо из-за вашего употребления алкоголя?",
        "kind": "select",
        "options": [
          {
            "label": "Нет",
            "value": 0
          },
          {
            "label": "Да, но не за последний год",
            "value": 2
          },
          {
            "label": "Да, за последний год",
            "value": 4
          }
        ]
      },
      {
        "key": "q10",
        "label": "Выражал ли кто-нибудь обеспокоенность вашим употреблением алкоголя?",
        "kind": "select",
        "options": [
          {
            "label": "Нет",
            "value": 0
          },
          {
            "label": "Да, но не за последний год",
            "value": 2
          },
          {
            "label": "Да, за последний год",
            "value": 4
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "AUDIT"
      },
      {
        "key": "auditC"
      },
      {
        "key": "zone"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "cage",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "CAGE",
    "type": "scale",
    "description": "Скрининг алкогольной зависимости",
    "module": "cage",
    "fn": "calculateCAGE",
    "citation": "Ewing JA. JAMA. 1984;252(14):1905-1907.",
    "fields": [
      {
        "key": "cutDown",
        "label": "C — Сокращение",
        "kind": "boolean",
        "hint": "Вы когда-либо чувствовали, что вам следует сократить употребление алкоголя?"
      },
      {
        "key": "annoyed",
        "label": "A — Раздражение",
        "kind": "boolean",
        "hint": "Вас когда-либо раздражала критика вашего употребления алкоголя?"
      },
      {
        "key": "guilty",
        "label": "G — Вина",
        "kind": "boolean",
        "hint": "Вы когда-либо чувствовали вину из-за употребления алкоголя?"
      },
      {
        "key": "eyeOpener",
        "label": "E — Утренняя доза",
        "kind": "boolean",
        "hint": "Вы когда-либо нуждались в алкоголе с утра, чтобы «открыть глаза» и прийти в норму?"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "CAGE"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "ymrs",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "YMRS",
    "type": "scale",
    "description": "Шкала оценки мании Янга",
    "module": "ymrs",
    "fn": "calculateYMRS",
    "citation": "Young RC, et al. Br J Psychiatry. 1978;133:429-435.",
    "fields": [
      {
        "key": "elevatedMood",
        "label": "1. Повышенное настроение",
        "kind": "select",
        "options": [
          {
            "label": "0 — Нет",
            "value": 0
          },
          {
            "label": "1 — Слабо повышено",
            "value": 1
          },
          {
            "label": "2 — Субъективно повышено",
            "value": 2
          },
          {
            "label": "3 — Приподнято, не соответствует ситуации",
            "value": 3
          },
          {
            "label": "4 — Эйфория, смех, нецелесообразно",
            "value": 4
          }
        ]
      },
      {
        "key": "motorActivity",
        "label": "2. Двигательная активность",
        "kind": "select",
        "options": [
          {
            "label": "0 — Нет",
            "value": 0
          },
          {
            "label": "1 — Слегка повышена",
            "value": 1
          },
          {
            "label": "2 — Оживлён",
            "value": 2
          },
          {
            "label": "3 — Гиперактивен",
            "value": 3
          },
          {
            "label": "4 — Постоянно двигается",
            "value": 4
          }
        ]
      },
      {
        "key": "sexualInterest",
        "label": "3. Сексуальный интерес",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "1 — Слабо повышен",
            "value": 1
          },
          {
            "label": "2 — Умеренно повышен",
            "value": 2
          },
          {
            "label": "3 — Явно повышен",
            "value": 3
          },
          {
            "label": "4 — Откровенно сексуальное поведение",
            "value": 4
          }
        ]
      },
      {
        "key": "sleep",
        "label": "4. Сон (уменьшение потребности)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Не снижена",
            "value": 0
          },
          {
            "label": "1 — Сокращён на ≤ 1 ч",
            "value": 1
          },
          {
            "label": "2 — Сокращён на > 1 ч",
            "value": 2
          },
          {
            "label": "3 — Сокращён на > 3 ч",
            "value": 3
          },
          {
            "label": "4 — Нет сна",
            "value": 4
          }
        ]
      },
      {
        "key": "irritability",
        "label": "5. Раздражительность (×2)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Нет",
            "value": 0
          },
          {
            "label": "2 — Периодически",
            "value": 2
          },
          {
            "label": "4 — Часто раздражителен",
            "value": 4
          },
          {
            "label": "6 — Агрессивен",
            "value": 6
          },
          {
            "label": "8 — Нападает, невозможно провести беседу",
            "value": 8
          }
        ]
      },
      {
        "key": "speechRate",
        "label": "6. Темп речи",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "1 — Слегка ускорена",
            "value": 1
          },
          {
            "label": "2 — Ускорена, логоррея",
            "value": 2
          },
          {
            "label": "3 — Трудно перебить",
            "value": 3
          },
          {
            "label": "4 — Невозможно перебить",
            "value": 4
          }
        ]
      },
      {
        "key": "languageThought",
        "label": "7. Речь и мышление (×2)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "2 — Слабое отвлечение",
            "value": 2
          },
          {
            "label": "4 — Скачка идей",
            "value": 4
          },
          {
            "label": "6 — Непоследовательность",
            "value": 6
          },
          {
            "label": "8 — Бессвязность",
            "value": 8
          }
        ]
      },
      {
        "key": "thoughtContent",
        "label": "8. Содержание мышления (×2)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Норма",
            "value": 0
          },
          {
            "label": "2 — Слабые идеи величия",
            "value": 2
          },
          {
            "label": "4 — Грандиозные идеи",
            "value": 4
          },
          {
            "label": "6 — Параноидные идеи",
            "value": 6
          },
          {
            "label": "8 — Бред",
            "value": 8
          }
        ]
      },
      {
        "key": "disruptive",
        "label": "9. Дезорганизованное поведение (×2)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Нет",
            "value": 0
          },
          {
            "label": "2 — Шумное поведение",
            "value": 2
          },
          {
            "label": "4 — Требует ограничений",
            "value": 4
          },
          {
            "label": "6 — Угрозы, требует сдерживания",
            "value": 6
          },
          {
            "label": "8 — Жестокое поведение",
            "value": 8
          }
        ]
      },
      {
        "key": "appearance",
        "label": "10. Внешний вид (×2)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Соответствующий ситуации",
            "value": 0
          },
          {
            "label": "2 — Несколько небрежен",
            "value": 2
          },
          {
            "label": "4 — Неряшлив, яркая одежда",
            "value": 4
          },
          {
            "label": "6 — Нарушен туалет",
            "value": 6
          },
          {
            "label": "8 — Полностью нарушен туалет",
            "value": 8
          }
        ]
      },
      {
        "key": "insight",
        "label": "11. Критика к болезни (×2)",
        "kind": "select",
        "options": [
          {
            "label": "0 — Полная критика",
            "value": 0
          },
          {
            "label": "2 — Снижена",
            "value": 2
          },
          {
            "label": "4 — Признаёт гиперактивность, отрицает болезнь",
            "value": 4
          },
          {
            "label": "6 — Отрицает любые изменения",
            "value": 6
          },
          {
            "label": "8 — Полностью отрицает болезнь",
            "value": 8
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "YMRS"
      },
      {
        "key": "level"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "ktv",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "Kt/V (диализ)",
    "shortName": "Kt/V",
    "type": "formula",
    "description": "Адекватность гемодиализа",
    "module": "ktv",
    "fn": "calculateKtV",
    "citation": "Daugirdas JT. J Am Soc Nephrol. 1993;4(5):1205-1213.",
    "fields": [
      {
        "key": "preBUN",
        "label": "Мочевина до диализа",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "60"
      },
      {
        "key": "postBUN",
        "label": "Мочевина после диализа",
        "kind": "number",
        "unit": "мг/дл",
        "placeholder": "20"
      },
      {
        "key": "duration",
        "label": "Продолжительность диализа",
        "kind": "number",
        "unit": "часов",
        "placeholder": "4"
      },
      {
        "key": "uf",
        "label": "Ультрафильтрация",
        "kind": "number",
        "unit": "литров",
        "placeholder": "2",
        "step": 0.1
      },
      {
        "key": "postWeight",
        "label": "Вес после диализа",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70"
      }
    ],
    "result": [
      {
        "key": "ktv",
        "label": "Kt/V (Daugirdas)"
      },
      {
        "key": "urr"
      },
      {
        "key": "ktvInterpretation"
      },
      {
        "key": "urrInterpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "uag",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "Анионный промежуток мочи",
    "shortName": "UAG",
    "type": "formula",
    "description": "Дифференциальная диагностика метаболического ацидоза",
    "module": "uag",
    "fn": "calculateUAG",
    "citation": "Battle DC, et al. Ann Intern Med. 1988;102(4):536-541.",
    "fields": [
      {
        "key": "uNa",
        "label": "Na мочи",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "60"
      },
      {
        "key": "uK",
        "label": "K мочи",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "30"
      },
      {
        "key": "uCl",
        "label": "Cl мочи",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "100"
      }
    ],
    "result": [
      {
        "key": "uag",
        "label": "Анионный промежуток мочи (UAG)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "diagnosis"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "winter_formula",
    "categoryId": "nephrology",
    "categories": [
      "nephrology",
      "lab"
    ],
    "name": "Формула Винтера",
    "shortName": "Winter",
    "type": "formula",
    "description": "Ожидаемая компенсация при метаболическом ацидозе",
    "module": "winter_formula",
    "fn": "calculateWinterFormula",
    "citation": "Winter SD, et al. JAMA. 1969;208(8):1484-1486.",
    "fields": [
      {
        "key": "hco3",
        "label": "HCO₃ (измеренный)",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "15",
        "hint": "22–26"
      },
      {
        "key": "measuredPaCO2",
        "label": "PaCO₂ (измеренный)",
        "kind": "number",
        "unit": "мм рт.ст.",
        "placeholder": "30",
        "hint": "35–45"
      }
    ],
    "result": [
      {
        "key": "expectedPaCO2Low",
        "label": "Ожидаемый PaCO₂"
      },
      {
        "key": "expectedPaCO2High"
      },
      {
        "key": "measuredPaCO2"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "diagnosis"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "delta_delta",
    "categoryId": "nephrology",
    "categories": [
      "nephrology",
      "lab"
    ],
    "name": "Дельта-дельта",
    "shortName": "δ/δ",
    "type": "formula",
    "description": "Выявление смешанных нарушений КЩС",
    "module": "delta_delta",
    "fn": "calculateDeltaDelta",
    "citation": "Mehta AN, et al. Am J Med Sci. 2008;336(6):496-502.",
    "fields": [
      {
        "key": "ag",
        "label": "Анионный промежуток",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "20",
        "hint": "8–16"
      },
      {
        "key": "hco3",
        "label": "HCO₃",
        "kind": "number",
        "unit": "мЭкв/л",
        "placeholder": "12",
        "hint": "22–26"
      }
    ],
    "result": [
      {
        "key": "ratio",
        "label": "Дельта-дельта (δ/δ)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "diagnosis"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "corrected_phenytoin",
    "categoryId": "nephrology",
    "categories": [
      "nephrology",
      "lab"
    ],
    "name": "Корр. фенитоин",
    "shortName": "Corrected PHT",
    "type": "formula",
    "description": "Коррекция уровня фенитоина на альбумин",
    "module": "corrected_phenytoin",
    "fn": "calculateCorrectedPhenytoin",
    "citation": "Winter ME, Tozer TN. Clinical Pharmacokinetics. 2006.",
    "fields": [
      {
        "key": "measured",
        "label": "Измеренный фенитоин",
        "kind": "number",
        "unit": "мкг/мл",
        "placeholder": "8",
        "hint": "10–20"
      },
      {
        "key": "albumin",
        "label": "Альбумин",
        "kind": "number",
        "unit": "г/дл",
        "placeholder": "3.0",
        "hint": "3.5–5.0",
        "step": 0.1
      },
      {
        "key": "renalFailure",
        "label": "Почечная недостаточность (СКФ &lt; 20 мл/мин)",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "corrected",
        "label": "Скорректированный фенитоин"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "formula"
      }
    ]
  },
  {
    "id": "rts",
    "categoryId": "trauma",
    "categories": [
      "trauma"
    ],
    "name": "Revised Trauma Score",
    "shortName": "RTS",
    "type": "formula",
    "description": "Физиологическая оценка тяжести травмы",
    "module": "rts",
    "fn": "calculateRTS",
    "citation": "Champion HR, et al. J Trauma. 1989;29(5):623-629.",
    "fields": [
      {
        "key": "gcsCoded",
        "label": "ШКГ",
        "kind": "select",
        "options": [
          {
            "value": 4,
            "label": "4 — ШКГ 13–15"
          },
          {
            "value": 3,
            "label": "3 — ШКГ 9–12"
          },
          {
            "value": 2,
            "label": "2 — ШКГ 6–8"
          },
          {
            "value": 1,
            "label": "1 — ШКГ 4–5"
          },
          {
            "value": 0,
            "label": "0 — ШКГ 3"
          }
        ]
      },
      {
        "key": "sbpCoded",
        "label": "Систолическое АД",
        "kind": "select",
        "options": [
          {
            "value": 4,
            "label": "4 — АД > 89 мм рт.ст."
          },
          {
            "value": 3,
            "label": "3 — АД 76–89"
          },
          {
            "value": 2,
            "label": "2 — АД 50–75"
          },
          {
            "value": 1,
            "label": "1 — АД 1–49"
          },
          {
            "value": 0,
            "label": "0 — АД 0"
          }
        ]
      },
      {
        "key": "rrCoded",
        "label": "Частота дыхания",
        "kind": "select",
        "options": [
          {
            "value": 4,
            "label": "4 — ЧДД 10–29 /мин"
          },
          {
            "value": 3,
            "label": "3 — ЧДД > 29"
          },
          {
            "value": 2,
            "label": "2 — ЧДД 6–9"
          },
          {
            "value": 1,
            "label": "1 — ЧДД 1–5"
          },
          {
            "value": 0,
            "label": "0 — ЧДД 0"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "rts",
        "label": "RTS (пересм. шкала травмы)"
      },
      {
        "key": "trts"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "abc_score",
    "categoryId": "trauma",
    "categories": [
      "trauma"
    ],
    "name": "ABC Score",
    "type": "scale",
    "description": "Прогноз массивной трансфузии при травме",
    "module": "abc_score",
    "fn": "calculateABCScore",
    "citation": "Nunez TC, et al. J Trauma. 2009;66(2):346-352.",
    "fields": [
      {
        "key": "sbpLow",
        "label": "АД ≤ 90 мм рт.ст.",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "hrHigh",
        "label": "ЧСС ≥ 120 уд/мин",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "fastPositive",
        "label": "FAST-ультразвук положительный",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "penetrating",
        "label": "Проникающий механизм травмы",
        "kind": "boolean",
        "points": "+1"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "ABC Score"
      },
      {
        "key": "mtpProbability"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "nyha",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "NYHA",
    "type": "scale",
    "description": "Функциональный класс сердечной недостаточности",
    "module": "nyha",
    "fn": "calculateNYHA",
    "citation": "The Criteria Committee of the New York Heart Association. 1994.",
    "fields": [
      {
        "key": "grade",
        "label": "NYHA",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "I — Нет ограничений физической активности"
          },
          {
            "value": 2,
            "label": "II — Незначительное ограничение"
          },
          {
            "value": 3,
            "label": "III — Выраженное ограничение"
          },
          {
            "value": 4,
            "label": "IV — Симптомы в покое"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "grade",
        "label": "NYHA"
      },
      {
        "key": "description"
      },
      {
        "key": "prognosis"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "killip",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "Killip",
    "type": "scale",
    "description": "Тяжесть СН при остром инфаркте миокарда",
    "module": "killip",
    "fn": "calculateKillip",
    "citation": "Killip T 3rd, Kimball JT. Am J Cardiol. 1967;20(4):457-464.",
    "fields": [
      {
        "key": "grade",
        "label": "Killip",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "I — Нет признаков СН"
          },
          {
            "value": 2,
            "label": "II — Лёгкая СН (хрипы < 50%, S3, набухание яремных вен)"
          },
          {
            "value": 3,
            "label": "III — Отёк лёгких (хрипы > 50%)"
          },
          {
            "value": 4,
            "label": "IV — Кардиогенный шок"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "grade",
        "label": "Killip"
      },
      {
        "key": "description"
      },
      {
        "key": "mortality"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "bsa",
    "categoryId": "oncology",
    "categories": [
      "oncology"
    ],
    "name": "Площадь поверхности тела",
    "shortName": "BSA",
    "type": "formula",
    "description": "Площадь поверхности тела (Mosteller, DuBois, Haycock)",
    "module": "bsa",
    "fn": "calculateBSA",
    "citation": "Mosteller RD. N Engl J Med. 1987;317(17):1098.",
    "fields": [
      {
        "key": "height",
        "label": "Рост",
        "kind": "number",
        "unit": "см",
        "placeholder": "170"
      },
      {
        "key": "weight",
        "label": "Вес",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70"
      },
      {
        "key": "formula",
        "label": "Формула",
        "kind": "select",
        "options": [
          {
            "value": "mosteller",
            "label": "Mosteller (стандарт)"
          },
          {
            "value": "dubois",
            "label": "DuBois"
          },
          {
            "value": "haycock",
            "label": "Haycock (педиатрическая)"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "bsa",
        "label": "`ППТ (${result.formula})`"
      },
      {
        "key": "formula"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "calvert",
    "categoryId": "oncology",
    "categories": [
      "oncology"
    ],
    "name": "Формула Кальверта",
    "shortName": "Calvert",
    "type": "formula",
    "description": "Дозирование карбоплатина по AUC",
    "module": "calvert",
    "fn": "calculateCalvert",
    "citation": "Calvert AH, et al. J Clin Oncol. 1989;7(11):1748-1756.",
    "fields": [
      {
        "key": "targetAUC",
        "label": "Целевая AUC",
        "kind": "number",
        "unit": "мг/мл·мин",
        "placeholder": "5",
        "hint": "4–7",
        "step": 0.5
      },
      {
        "key": "gfr",
        "label": "СКФ (по Cockcroft-Gault)",
        "kind": "number",
        "unit": "мл/мин",
        "placeholder": "80",
        "hint": "60–125 (≤125 по FDA)"
      }
    ],
    "result": [
      {
        "key": "dose",
        "label": "Доза карбоплатина"
      },
      {
        "key": "effectiveGFR"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "khorana",
    "categoryId": "oncology",
    "categories": [
      "oncology"
    ],
    "name": "Khorana Score",
    "type": "risk",
    "description": "Риск ВТЭ у онкологических пациентов на ХТ",
    "module": "khorana",
    "fn": "calculateKhorana",
    "citation": "Khorana AA, et al. Blood. 2008;111(10):4902-4907.",
    "fields": [
      {
        "key": "cancerType",
        "label": "Тип онкологического заболевания",
        "kind": "select",
        "options": [
          {
            "value": "very_high",
            "label": "Очень высокий риск (+2) — Желудок, поджелудочная железа"
          },
          {
            "value": "high",
            "label": "Высокий риск (+1) — Лёгкие, лимфома, гинекология, мочевой пузырь, яички"
          },
          {
            "value": "other",
            "label": "Другой тип — (0)"
          }
        ]
      },
      {
        "key": "plateletsHigh",
        "label": "Тромбоциты ≥ 350 ×10⁹/л до ХТ",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "hgbLow",
        "label": "Hgb < 100 г/л или применение ЭПО",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "wbcHigh",
        "label": "Лейкоциты > 11 ×10⁹/л до ХТ",
        "kind": "boolean",
        "points": "+1"
      },
      {
        "key": "bmiHigh",
        "label": "ИМТ ≥ 35 кг/м²",
        "kind": "boolean",
        "points": "+1"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "Khorana Score"
      },
      {
        "key": "risk"
      },
      {
        "key": "vteRate"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "ecog",
    "categoryId": "oncology",
    "categories": [
      "oncology"
    ],
    "name": "ECOG / ВОЗ",
    "shortName": "ECOG",
    "type": "scale",
    "description": "Статус общего состояния в онкологии",
    "module": "ecog",
    "fn": "calculateECOG",
    "citation": "Oken MM, et al. Am J Clin Oncol. 1982;5(6):649-655.",
    "fields": [
      {
        "key": "grade",
        "label": "ECOG / ВОЗ",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Полностью активен"
          },
          {
            "value": 1,
            "label": "1 — Ограничена тяжёлая физическая активность"
          },
          {
            "value": 2,
            "label": "2 — Амбулаторный > 50% времени бодрствования"
          },
          {
            "value": 3,
            "label": "3 — Ограниченное самообслуживание"
          },
          {
            "value": 4,
            "label": "4 — Полностью нетрудоспособен"
          },
          {
            "value": 5,
            "label": "5 — Смерть"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "grade",
        "label": "ECOG / ВОЗ"
      },
      {
        "key": "description"
      },
      {
        "key": "karnofsky"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "mascc",
    "categoryId": "oncology",
    "categories": [
      "oncology"
    ],
    "name": "MASCC Score",
    "type": "risk",
    "description": "Риск осложнений при нейтропенической лихорадке",
    "module": "mascc",
    "fn": "calculateMASCC",
    "citation": "Klastersky J, et al. J Clin Oncol. 2000;18(16):3038-3051.",
    "fields": [
      {
        "key": "burden",
        "label": "Тяжесть заболевания",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Тяжёлые симптомы"
          },
          {
            "value": 3,
            "label": "3 — Умеренные симптомы"
          },
          {
            "value": 5,
            "label": "5 — Нет или лёгкие симптомы"
          }
        ]
      },
      {
        "key": "noHypotension",
        "label": "Нет гипотензии (АД > 90 мм рт.ст.)",
        "kind": "boolean",
        "points": "+5"
      },
      {
        "key": "noCOPD",
        "label": "Нет ХОБЛ",
        "kind": "boolean",
        "points": "+4"
      },
      {
        "key": "solidOrNoFungal",
        "label": "Солидная опухоль ИЛИ нет предшествующей грибковой инфекции",
        "kind": "boolean",
        "points": "+4"
      },
      {
        "key": "noDehydration",
        "label": "Нет признаков дегидратации",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "outpatient",
        "label": "Амбулаторный пациент в начале лихорадки",
        "kind": "boolean",
        "points": "+3"
      },
      {
        "key": "ageLt60",
        "label": "Возраст < 60 лет",
        "kind": "boolean",
        "points": "+2"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "MASCC Score"
      },
      {
        "key": "risk"
      },
      {
        "key": "complicationRate"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "anc",
    "categoryId": "oncology",
    "categories": [
      "oncology"
    ],
    "name": "Абсолютное число нейтрофилов",
    "shortName": "ANC",
    "type": "formula",
    "description": "Абсолютное число нейтрофилов",
    "module": "anc",
    "fn": "calculateANC",
    "fields": [
      {
        "key": "wbc",
        "label": "Лейкоциты (WBC)",
        "kind": "number",
        "unit": "×10³/мкл",
        "placeholder": "5.0",
        "hint": "4–11",
        "step": 0.1
      },
      {
        "key": "neutrophils",
        "label": "Сегментоядерные нейтрофилы",
        "kind": "number",
        "unit": "%",
        "placeholder": "60",
        "hint": "50–70"
      },
      {
        "key": "bands",
        "label": "Палочкоядерные нейтрофилы",
        "kind": "number",
        "unit": "%",
        "placeholder": "0",
        "hint": "0–5"
      }
    ],
    "result": [
      {
        "key": "anc",
        "label": "Абс. число нейтрофилов (ANC)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "category"
      }
    ]
  },
  {
    "id": "das28",
    "categoryId": "rheumatology",
    "categories": [
      "rheumatology"
    ],
    "name": "DAS28",
    "type": "formula",
    "description": "Активность ревматоидного артрита",
    "module": "das28",
    "fn": "calculateDAS28",
    "citation": "Prevoo ML, et al. Arthritis Rheum. 1995;38(1):44-48.",
    "fields": [
      {
        "key": "tjc28",
        "label": "Болезненные суставы (TJC28)",
        "kind": "number",
        "unit": "0–28",
        "placeholder": "5"
      },
      {
        "key": "sjc28",
        "label": "Припухшие суставы (SJC28)",
        "kind": "number",
        "unit": "0–28",
        "placeholder": "3"
      },
      {
        "key": "crp",
        "label": "CRP",
        "kind": "number",
        "unit": "мг/л",
        "placeholder": "10"
      },
      {
        "key": "esr",
        "label": "СОЭ",
        "kind": "number",
        "unit": "мм/ч",
        "placeholder": "25"
      },
      {
        "key": "vas",
        "label": "ВАШ пациента",
        "kind": "number",
        "unit": "0–100",
        "placeholder": "50"
      },
      {
        "key": "useESR",
        "label": "Использовать СОЭ (DAS28-ESR) вместо CRP",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "`DAS28-${useESR ? \"ESR\" : \"CRP\"}`"
      },
      {
        "key": "activity"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "formula"
      }
    ]
  },
  {
    "id": "acr_eular_ra",
    "categoryId": "rheumatology",
    "categories": [
      "rheumatology"
    ],
    "name": "Критерии ACR/EULAR (РА)",
    "shortName": "ACR/EULAR RA",
    "type": "scale",
    "description": "Диагностические критерии ревматоидного артрита 2010",
    "module": "acr_eular_ra",
    "fn": "calculateACREULARRA",
    "citation": "Aletaha D, et al. Arthritis Rheum. 2010;62(9):2569-2581.",
    "fields": [
      {
        "key": "joints",
        "label": "Поражение суставов",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — 1 крупный сустав"
          },
          {
            "value": 2,
            "label": "2 — 2–10 крупных суставов"
          },
          {
            "value": 3,
            "label": "3 — 1–3 мелких сустава"
          },
          {
            "value": 5,
            "label": "5 — 4–10 мелких суставов или > 10 суставов"
          }
        ]
      },
      {
        "key": "serology",
        "label": "Серология (РФ / anti-CCP)",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — РФ и anti-CCP отрицательные"
          },
          {
            "value": 2,
            "label": "2 — Слабо положительный РФ или anti-CCP"
          },
          {
            "value": 3,
            "label": "3 — Высоко положительный РФ или anti-CCP"
          }
        ]
      },
      {
        "key": "acutePhase",
        "label": "Острофазовые показатели",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — CRP и СОЭ нормальные"
          },
          {
            "value": 1,
            "label": "1 — Аномальный CRP или СОЭ"
          }
        ]
      },
      {
        "key": "duration",
        "label": "Длительность симптомов",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — < 6 недель"
          },
          {
            "value": 1,
            "label": "1 — ≥ 6 недель"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "ACR/EULAR 2010 (РА)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "diagnosis"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "pasi",
    "categoryId": "dermatology",
    "categories": [
      "dermatology"
    ],
    "name": "PASI",
    "type": "formula",
    "description": "Индекс тяжести псориаза",
    "module": "pasi",
    "fn": "calculatePASI",
    "citation": "Fredriksson T, Pettersson U. Dermatologica. 1978;157(4):238-244.",
    "fields": [
      {
        "key": "head.erythema",
        "label": "Эритема (E)",
        "kind": "select",
        "group": "Голова и шея (H) ×0.1",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "head.induration",
        "label": "Инфильтрация (I)",
        "kind": "select",
        "group": "Голова и шея (H) ×0.1",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "head.desquamation",
        "label": "Шелушение (D)",
        "kind": "select",
        "group": "Голова и шея (H) ×0.1",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "head.area",
        "label": "Площадь поражения (A)",
        "kind": "select",
        "group": "Голова и шея (H) ×0.1",
        "options": [
          {
            "value": 0,
            "label": "0 — 0%"
          },
          {
            "value": 1,
            "label": "1 — < 10%"
          },
          {
            "value": 2,
            "label": "2 — 10–29%"
          },
          {
            "value": 3,
            "label": "3 — 30–49%"
          },
          {
            "value": 4,
            "label": "4 — 50–69%"
          },
          {
            "value": 5,
            "label": "5 — 70–89%"
          },
          {
            "value": 6,
            "label": "6 — 90–100%"
          }
        ]
      },
      {
        "key": "upperLimbs.erythema",
        "label": "Эритема (E)",
        "kind": "select",
        "group": "Верхние конечности (U) ×0.2",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "upperLimbs.induration",
        "label": "Инфильтрация (I)",
        "kind": "select",
        "group": "Верхние конечности (U) ×0.2",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "upperLimbs.desquamation",
        "label": "Шелушение (D)",
        "kind": "select",
        "group": "Верхние конечности (U) ×0.2",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "upperLimbs.area",
        "label": "Площадь поражения (A)",
        "kind": "select",
        "group": "Верхние конечности (U) ×0.2",
        "options": [
          {
            "value": 0,
            "label": "0 — 0%"
          },
          {
            "value": 1,
            "label": "1 — < 10%"
          },
          {
            "value": 2,
            "label": "2 — 10–29%"
          },
          {
            "value": 3,
            "label": "3 — 30–49%"
          },
          {
            "value": 4,
            "label": "4 — 50–69%"
          },
          {
            "value": 5,
            "label": "5 — 70–89%"
          },
          {
            "value": 6,
            "label": "6 — 90–100%"
          }
        ]
      },
      {
        "key": "trunk.erythema",
        "label": "Эритема (E)",
        "kind": "select",
        "group": "Туловище (T) ×0.3",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "trunk.induration",
        "label": "Инфильтрация (I)",
        "kind": "select",
        "group": "Туловище (T) ×0.3",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "trunk.desquamation",
        "label": "Шелушение (D)",
        "kind": "select",
        "group": "Туловище (T) ×0.3",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "trunk.area",
        "label": "Площадь поражения (A)",
        "kind": "select",
        "group": "Туловище (T) ×0.3",
        "options": [
          {
            "value": 0,
            "label": "0 — 0%"
          },
          {
            "value": 1,
            "label": "1 — < 10%"
          },
          {
            "value": 2,
            "label": "2 — 10–29%"
          },
          {
            "value": 3,
            "label": "3 — 30–49%"
          },
          {
            "value": 4,
            "label": "4 — 50–69%"
          },
          {
            "value": 5,
            "label": "5 — 70–89%"
          },
          {
            "value": 6,
            "label": "6 — 90–100%"
          }
        ]
      },
      {
        "key": "lowerLimbs.erythema",
        "label": "Эритема (E)",
        "kind": "select",
        "group": "Нижние конечности (L) ×0.4",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "lowerLimbs.induration",
        "label": "Инфильтрация (I)",
        "kind": "select",
        "group": "Нижние конечности (L) ×0.4",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "lowerLimbs.desquamation",
        "label": "Шелушение (D)",
        "kind": "select",
        "group": "Нижние конечности (L) ×0.4",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Лёгкая"
          },
          {
            "value": 2,
            "label": "2 — Умеренная"
          },
          {
            "value": 3,
            "label": "3 — Тяжёлая"
          },
          {
            "value": 4,
            "label": "4 — Очень тяжёлая"
          }
        ]
      },
      {
        "key": "lowerLimbs.area",
        "label": "Площадь поражения (A)",
        "kind": "select",
        "group": "Нижние конечности (L) ×0.4",
        "options": [
          {
            "value": 0,
            "label": "0 — 0%"
          },
          {
            "value": 1,
            "label": "1 — < 10%"
          },
          {
            "value": 2,
            "label": "2 — 10–29%"
          },
          {
            "value": 3,
            "label": "3 — 30–49%"
          },
          {
            "value": 4,
            "label": "4 — 50–69%"
          },
          {
            "value": 5,
            "label": "5 — 70–89%"
          },
          {
            "value": 6,
            "label": "6 — 90–100%"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "PASI"
      },
      {
        "key": "severity"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "category"
      }
    ]
  },
  {
    "id": "ipss",
    "categoryId": "urology",
    "categories": [
      "urology"
    ],
    "name": "IPSS",
    "type": "scale",
    "description": "Симптомы нижних мочевыводящих путей / ДГПЖ",
    "module": "ipss",
    "fn": "calculateIPSS",
    "citation": "Barry MJ, et al. J Urol. 1992;148(5):1549-1557.",
    "fields": [
      {
        "key": "incomplete",
        "label": "1. Неполное опорожнение",
        "kind": "select",
        "hint": "Как часто за последний месяц у вас оставалось ощущение неполного опорожнения мочевого пузыря после мочеиспускания?",
        "options": [
          {
            "value": 0,
            "label": "0 — Ни разу"
          },
          {
            "value": 1,
            "label": "1 — Менее 1 раза из 5"
          },
          {
            "value": 2,
            "label": "2 — Менее 1 раза из 2"
          },
          {
            "value": 3,
            "label": "3 — Примерно 1 раз из 2"
          },
          {
            "value": 4,
            "label": "4 — Более 1 раза из 2"
          },
          {
            "value": 5,
            "label": "5 — Почти всегда"
          }
        ]
      },
      {
        "key": "frequency",
        "label": "2. Частота",
        "kind": "select",
        "hint": "Как часто вам приходилось мочиться снова менее чем через 2 часа после последнего мочеиспускания?",
        "options": [
          {
            "value": 0,
            "label": "0 — Ни разу"
          },
          {
            "value": 1,
            "label": "1 — Менее 1 раза из 5"
          },
          {
            "value": 2,
            "label": "2 — Менее 1 раза из 2"
          },
          {
            "value": 3,
            "label": "3 — Примерно 1 раз из 2"
          },
          {
            "value": 4,
            "label": "4 — Более 1 раза из 2"
          },
          {
            "value": 5,
            "label": "5 — Почти всегда"
          }
        ]
      },
      {
        "key": "intermittency",
        "label": "3. Прерывистость",
        "kind": "select",
        "hint": "Как часто у вас прерывалась струя мочи?",
        "options": [
          {
            "value": 0,
            "label": "0 — Ни разу"
          },
          {
            "value": 1,
            "label": "1 — Менее 1 раза из 5"
          },
          {
            "value": 2,
            "label": "2 — Менее 1 раза из 2"
          },
          {
            "value": 3,
            "label": "3 — Примерно 1 раз из 2"
          },
          {
            "value": 4,
            "label": "4 — Более 1 раза из 2"
          },
          {
            "value": 5,
            "label": "5 — Почти всегда"
          }
        ]
      },
      {
        "key": "urgency",
        "label": "4. Ургентность",
        "kind": "select",
        "hint": "Как часто вам было трудно удерживать мочеиспускание?",
        "options": [
          {
            "value": 0,
            "label": "0 — Ни разу"
          },
          {
            "value": 1,
            "label": "1 — Менее 1 раза из 5"
          },
          {
            "value": 2,
            "label": "2 — Менее 1 раза из 2"
          },
          {
            "value": 3,
            "label": "3 — Примерно 1 раз из 2"
          },
          {
            "value": 4,
            "label": "4 — Более 1 раза из 2"
          },
          {
            "value": 5,
            "label": "5 — Почти всегда"
          }
        ]
      },
      {
        "key": "weakStream",
        "label": "5. Слабая струя",
        "kind": "select",
        "hint": "Как часто у вас была слабая струя мочи?",
        "options": [
          {
            "value": 0,
            "label": "0 — Ни разу"
          },
          {
            "value": 1,
            "label": "1 — Менее 1 раза из 5"
          },
          {
            "value": 2,
            "label": "2 — Менее 1 раза из 2"
          },
          {
            "value": 3,
            "label": "3 — Примерно 1 раз из 2"
          },
          {
            "value": 4,
            "label": "4 — Более 1 раза из 2"
          },
          {
            "value": 5,
            "label": "5 — Почти всегда"
          }
        ]
      },
      {
        "key": "straining",
        "label": "6. Натуживание",
        "kind": "select",
        "hint": "Как часто вам приходилось натуживаться, чтобы начать мочеиспускание?",
        "options": [
          {
            "value": 0,
            "label": "0 — Ни разу"
          },
          {
            "value": 1,
            "label": "1 — Менее 1 раза из 5"
          },
          {
            "value": 2,
            "label": "2 — Менее 1 раза из 2"
          },
          {
            "value": 3,
            "label": "3 — Примерно 1 раз из 2"
          },
          {
            "value": 4,
            "label": "4 — Более 1 раза из 2"
          },
          {
            "value": 5,
            "label": "5 — Почти всегда"
          }
        ]
      },
      {
        "key": "nocturia",
        "label": "7. Ноктурия",
        "kind": "select",
        "hint": "Сколько раз обычно вы вставали ночью для мочеиспускания?",
        "options": [
          {
            "value": 0,
            "label": "0 — Ни разу"
          },
          {
            "value": 1,
            "label": "1 — 1 раз"
          },
          {
            "value": 2,
            "label": "2 — 2 раза"
          },
          {
            "value": 3,
            "label": "3 — 3 раза"
          },
          {
            "value": 4,
            "label": "4 — 4 раза"
          },
          {
            "value": 5,
            "label": "5 — 5 раз и более"
          }
        ]
      },
      {
        "key": "qol",
        "label": "Качество жизни (не входит в IPSS)",
        "kind": "select",
        "hint": "Как бы вы чувствовали себя, если бы оставшуюся жизнь мочеиспускание осталось таким же?",
        "options": [
          {
            "value": 0,
            "label": "0 — Отлично"
          },
          {
            "value": 1,
            "label": "1 — Хорошо"
          },
          {
            "value": 2,
            "label": "2 — В основном удовлетворён"
          },
          {
            "value": 3,
            "label": "3 — Смешанное чувство"
          },
          {
            "value": 4,
            "label": "4 — В основном неудовлетворён"
          },
          {
            "value": 5,
            "label": "5 — Плохо"
          },
          {
            "value": 6,
            "label": "6 — Ужасно"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "IPSS"
      },
      {
        "key": "qol"
      },
      {
        "key": "severity"
      },
      {
        "key": "category"
      },
      {
        "key": "interpretation"
      }
    ]
  },
  {
    "id": "opioid_conversion",
    "categoryId": "pharmacology",
    "categories": [
      "pharmacology"
    ],
    "name": "Конверсия опиоидов",
    "shortName": "Opioid Conv.",
    "type": "formula",
    "description": "Эквианальгетические дозы опиоидов",
    "module": "opioid_conversion",
    "fn": "calculateOpioidConversion",
    "citation": "Pereira J, et al. J Pain Symptom Manage. 2001;22(2):672-687.",
    "fields": [
      {
        "key": "drug",
        "label": "Препарат",
        "kind": "select",
        "options": [
          {
            "value": "morphine_oral",
            "label": "Морфин (пероральный)"
          },
          {
            "value": "morphine_iv",
            "label": "Морфин (в/в)"
          },
          {
            "value": "codeine",
            "label": "Кодеин (пероральный)"
          },
          {
            "value": "tramadol",
            "label": "Трамадол (пероральный)"
          },
          {
            "value": "oxycodone",
            "label": "Оксикодон (пероральный)"
          },
          {
            "value": "hydromorphone_iv",
            "label": "Гидроморфон (в/в)"
          },
          {
            "value": "fentanyl_iv",
            "label": "Фентанил (в/в, мкг/ч → мг/сут)"
          },
          {
            "value": "buprenorphine_sl",
            "label": "Бупренорфин (сублингв., мкг)"
          }
        ]
      },
      {
        "key": "dose",
        "label": "Суточная доза",
        "kind": "number",
        "unit": "мг/сут",
        "placeholder": "30",
        "step": 0.5
      },
      {
        "key": "route",
        "label": "Путь введения",
        "kind": "select",
        "options": [
          {
            "value": "oral",
            "label": "Пероральный"
          },
          {
            "value": "iv",
            "label": "Внутривенный / парентеральный"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "morphineEquivalent",
        "label": "Морфиновый эквивалент (ММЭ)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "nac_protocol",
    "categoryId": "pharmacology",
    "categories": [
      "pharmacology"
    ],
    "name": "N-ацетилцистеин",
    "shortName": "NAC",
    "type": "formula",
    "description": "Протокол введения NAC при передозировке парацетамола",
    "module": "nac_protocol",
    "fn": "calculateNACProtocol",
    "citation": "Acetadote® (acetylcysteine) Prescribing Information. FDA.",
    "fields": [
      {
        "key": "weight",
        "label": "Масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70"
      }
    ],
    "result": [
      {
        "key": "phases",
        "nested": true
      },
      {
        "key": "totalDose",
        "label": "N-ацетилцистеин (NAC)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "pk_basics",
    "categoryId": "pharmacology",
    "categories": [
      "pharmacology"
    ],
    "name": "Основы ФК",
    "shortName": "PK",
    "type": "formula",
    "description": "Объём распределения, клиренс, T½",
    "module": "pk_basics",
    "fn": "calculatePKBasics",
    "fields": [
      {
        "key": "dose",
        "label": "Доза",
        "kind": "number",
        "unit": "мг",
        "placeholder": "500"
      },
      {
        "key": "auc",
        "label": "AUC",
        "kind": "number",
        "unit": "мг·ч/л",
        "placeholder": "50",
        "step": 0.1
      },
      {
        "key": "cmax",
        "label": "cmax",
        "kind": "number",
        "fixedValue": 0
      },
      {
        "key": "cmin",
        "label": "cmin",
        "kind": "number",
        "fixedValue": 0
      },
      {
        "key": "halfLife",
        "label": "T½ (период полувыведения)",
        "kind": "number",
        "unit": "ч",
        "placeholder": "6",
        "step": 0.1
      },
      {
        "key": "vd",
        "label": "Vd (кажущийся объём распределения)",
        "kind": "number",
        "unit": "л/кг",
        "placeholder": "0.6",
        "step": 0.01
      },
      {
        "key": "weight",
        "label": "Масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "70"
      }
    ],
    "result": [
      {
        "key": "clearance",
        "label": "Клиренс (CL)"
      },
      {
        "key": "vdTotal"
      },
      {
        "key": "ke"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "dic_score",
    "categoryId": "hematology",
    "categories": [
      "hematology"
    ],
    "name": "ДВС (ISTH)",
    "shortName": "DIC Score",
    "type": "scale",
    "description": "Явный ДВС-синдром по критериям ISTH",
    "module": "dic_score",
    "fn": "calculateDICScore",
    "citation": "Taylor FB Jr, et al. Thromb Haemost. 2001;86(5):1327-1330.",
    "fields": [
      {
        "key": "platelets",
        "label": "Тромбоциты",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — > 100 ×10⁹/л"
          },
          {
            "value": 1,
            "label": "1 — 50–100 ×10⁹/л"
          },
          {
            "value": 2,
            "label": "2 — < 50 ×10⁹/л"
          }
        ]
      },
      {
        "key": "dDimer",
        "label": "Д-димер",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — < 5× верхней границы нормы"
          },
          {
            "value": 2,
            "label": "2 — 5–25× ВГН"
          },
          {
            "value": 3,
            "label": "3 — ≥ 25× ВГН"
          }
        ]
      },
      {
        "key": "fibrinogen",
        "label": "Фибриноген",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — ≥ 1 г/л"
          },
          {
            "value": 1,
            "label": "1 — < 1 г/л"
          }
        ]
      },
      {
        "key": "ptProlongation",
        "label": "Удлинение ПВ",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — < 3 сек"
          },
          {
            "value": 1,
            "label": "1 — 3–6 сек"
          },
          {
            "value": 2,
            "label": "2 — > 6 сек"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "ДВС (ISTH)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "diagnosis"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "four_t_hit",
    "categoryId": "hematology",
    "categories": [
      "hematology"
    ],
    "name": "4T Score (ГИТ)",
    "shortName": "4T HIT",
    "type": "scale",
    "description": "Вероятность гепарин-индуцированной тромбоцитопении",
    "module": "four_t_hit",
    "fn": "calculateFourTHIT",
    "citation": "Warkentin TE, Heddle NM. Curr Hematol Rep. 2003;2(2):148-157.",
    "fields": [
      {
        "key": "thrombocytopenia",
        "label": "Тромбоцитопения",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Снижение < 30% или надир < 10 ×10⁹/л"
          },
          {
            "value": 1,
            "label": "1 — Снижение 30–50% или надир 10–19 ×10⁹/л"
          },
          {
            "value": 2,
            "label": "2 — Снижение > 50% или надир ≥ 20 ×10⁹/л"
          }
        ]
      },
      {
        "key": "timing",
        "label": "Время развития тромбоцитопении",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Снижение < 4 дней (без предшествующего гепарина)"
          },
          {
            "value": 1,
            "label": "1 — > 10 дней или < 1 дня (гепарин в последние 30–100 дн.)"
          },
          {
            "value": 2,
            "label": "2 — 5–10 дней или ≤ 1 дня (гепарин < 30 дн. назад)"
          }
        ]
      },
      {
        "key": "thrombosis",
        "label": "Тромбоз или некроз кожи",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Нет"
          },
          {
            "value": 1,
            "label": "1 — Прогрессирующий или подозреваемый тромбоз / некроз кожи"
          },
          {
            "value": 2,
            "label": "2 — Новый подтверждённый тромбоз или некроз кожи"
          }
        ]
      },
      {
        "key": "otherCauses",
        "label": "Другие причины тромбоцитопении",
        "kind": "select",
        "options": [
          {
            "value": 0,
            "label": "0 — Очевидная альтернативная причина"
          },
          {
            "value": 1,
            "label": "1 — Возможная альтернативная причина"
          },
          {
            "value": 2,
            "label": "2 — Нет других очевидных причин"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "4T Score (ГИТ)"
      },
      {
        "key": "probability"
      },
      {
        "key": "hitRate"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "recommendation"
      }
    ]
  },
  {
    "id": "transfusion_trigger",
    "categoryId": "hematology",
    "categories": [
      "hematology"
    ],
    "name": "Показания к трансфузии",
    "shortName": "Transfusion",
    "type": "scale",
    "description": "Триггеры переливания эритроцитарной массы",
    "module": "transfusion_trigger",
    "fn": "calculateTransfusionTrigger",
    "citation": "Carson JL, et al. N Engl J Med. 2011;365(26):2453-2462.",
    "fields": [
      {
        "key": "hgb",
        "label": "Гемоглобин",
        "kind": "number",
        "unit": "г/дл",
        "placeholder": "8.5",
        "hint": "12–17",
        "step": 0.1
      },
      {
        "key": "clinicalStatus",
        "label": "Клинический статус",
        "kind": "select",
        "options": [
          {
            "value": "stable",
            "label": "Стабильный пациент"
          },
          {
            "value": "acs",
            "label": "Острый коронарный синдром"
          },
          {
            "value": "cardiac_surgery",
            "label": "Кардиохирургия"
          },
          {
            "value": "icu",
            "label": "ОРИТ"
          },
          {
            "value": "orthopedic",
            "label": "Ортопедическая хирургия"
          }
        ]
      },
      {
        "key": "symptoms",
        "label": "Симптоматическая анемия (одышка, боль в груди, нестабильная гемодинамика)",
        "kind": "boolean"
      }
    ],
    "result": [
      {
        "key": "recommendation"
      },
      {
        "key": "trigger",
        "label": "Показания к трансфузии"
      },
      {
        "key": "severity"
      },
      {
        "key": "rationale"
      }
    ]
  },
  {
    "id": "holliday_segar",
    "categoryId": "pediatrics",
    "categories": [
      "pediatrics"
    ],
    "name": "Holliday-Segar",
    "type": "formula",
    "description": "Поддерживающий объём жидкости у детей",
    "module": "holliday_segar",
    "fn": "calculateHollidaySegar",
    "citation": "Holliday MA, Segar WE. Pediatrics. 1957;19(5):823-832.",
    "fields": [
      {
        "key": "weight",
        "label": "Масса тела",
        "kind": "number",
        "unit": "кг",
        "placeholder": "20"
      }
    ],
    "result": [
      {
        "key": "dailyMl",
        "label": "Holliday-Segar"
      },
      {
        "key": "hourlyMl"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "breakdown"
      }
    ]
  },
  {
    "id": "pgcs",
    "categoryId": "pediatrics",
    "categories": [
      "pediatrics"
    ],
    "name": "ШКГ детская (pGCS)",
    "shortName": "pGCS",
    "type": "scale",
    "description": "Шкала комы Глазго для детей",
    "module": "pgcs",
    "fn": "calculatePGCS",
    "citation": "Reilly PL, et al. Lancet. 1988;1(8589):809-812.",
    "fields": [
      {
        "key": "eye",
        "label": "Открывание глаз",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — Не открывает"
          },
          {
            "value": 2,
            "label": "2 — На боль"
          },
          {
            "value": 3,
            "label": "3 — На голос"
          },
          {
            "value": 4,
            "label": "4 — Спонтанно"
          }
        ]
      },
      {
        "key": "verbal",
        "label": "Речевой ответ",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — Нет ответа"
          },
          {
            "value": 2,
            "label": "2 — Стоны / нечленораздельно"
          },
          {
            "value": 3,
            "label": "3 — Плачет / крик (неадекватные слова)"
          },
          {
            "value": 4,
            "label": "4 — Возбуждён / недостаточно ориентирован"
          },
          {
            "value": 5,
            "label": "5 — Ориентирован / нормальная речь"
          }
        ]
      },
      {
        "key": "motor",
        "label": "Двигательный ответ",
        "kind": "select",
        "options": [
          {
            "value": 1,
            "label": "1 — Нет ответа"
          },
          {
            "value": 2,
            "label": "2 — Разгибание (децеребрация)"
          },
          {
            "value": 3,
            "label": "3 — Сгибание (декортикация)"
          },
          {
            "value": 4,
            "label": "4 — Отдёргивание"
          },
          {
            "value": 5,
            "label": "5 — Локализует боль"
          },
          {
            "value": 6,
            "label": "6 — Выполняет команды"
          }
        ]
      }
    ],
    "result": [
      {
        "key": "score",
        "label": "ШКГ детская (pGCS)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "pediatric_bsa",
    "categoryId": "pediatrics",
    "categories": [
      "pediatrics"
    ],
    "name": "ППТ детская (Haycock)",
    "shortName": "Pediatric BSA",
    "type": "formula",
    "description": "Площадь поверхности тела у детей (формула Хейкока)",
    "module": "pediatric_bsa",
    "fn": "calculatePediatricBSA",
    "citation": "Haycock GB, et al. J Pediatr. 1978;93(1):62-66.",
    "fields": [
      {
        "key": "height",
        "label": "Рост",
        "kind": "number",
        "unit": "см",
        "placeholder": "100"
      },
      {
        "key": "weight",
        "label": "Вес",
        "kind": "number",
        "unit": "кг",
        "placeholder": "15"
      }
    ],
    "result": [
      {
        "key": "bsa",
        "label": "ППТ детская (Haycock)"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      }
    ]
  },
  {
    "id": "eag_hba1c",
    "categoryId": "lab",
    "categories": [
      "lab"
    ],
    "name": "eAG по HbA1c",
    "shortName": "eAG",
    "type": "formula",
    "description": "Расчётная средняя гликемия по гликированному гемоглобину",
    "module": "eag_hba1c",
    "fn": "calculateEAGHbA1c",
    "citation": "Nathan DM, et al. Diabetes Care. 2008;31(8):1473-1478.",
    "fields": [
      {
        "key": "hba1c",
        "label": "HbA1c",
        "kind": "number",
        "unit": "%",
        "placeholder": "7.0",
        "hint": "< 5.7 (норма)",
        "step": 0.1
      }
    ],
    "result": [
      {
        "key": "eagMgDl",
        "label": "Расчётная средняя гликемия (eAG)"
      },
      {
        "key": "eagMmolL"
      },
      {
        "key": "interpretation"
      },
      {
        "key": "severity"
      },
      {
        "key": "target"
      }
    ]
  }
];
