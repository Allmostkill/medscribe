// СГЕНЕРИРОВАНО scripts/import-calculators.mjs — не редактировать.
// Источник: MedCalc, src/lib/calculators/data.ts
// Правки вносить в MedCalc и запускать: node scripts/import-calculators.mjs

export interface CalcListing {
  id: string;
  categoryId: string;
  categories: string[];
  name: string;
  shortName?: string;
  type: "formula" | "scale" | "risk";
  description: string;
  featured?: boolean;
}

export const calcListing: CalcListing[] = [
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
    "featured": true
  },
  {
    "id": "hasbled",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "HAS-BLED",
    "type": "risk",
    "description": "Риск кровотечения на антикоагулянтах"
  },
  {
    "id": "heart_score",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "HEART Score",
    "type": "scale",
    "description": "Риск MACE при боли в груди"
  },
  {
    "id": "grace",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "GRACE",
    "type": "scale",
    "description": "Прогноз при остром коронарном синдроме"
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
    "featured": true
  },
  {
    "id": "qtc",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "QTc (Bazett)",
    "type": "formula",
    "description": "Корригированный интервал QT"
  },
  {
    "id": "framingham",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "Framingham",
    "type": "risk",
    "description": "10-летний риск ССЗ"
  },
  {
    "id": "timi",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "TIMI",
    "type": "scale",
    "description": "Риск при ОКС без подъёма ST"
  },
  {
    "id": "cockcroft_gault",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "Cockcroft-Gault",
    "type": "formula",
    "description": "Клиренс креатинина"
  },
  {
    "id": "ckd_epi",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "CKD-EPI 2021",
    "type": "formula",
    "description": "СКФ (расчётная)"
  },
  {
    "id": "mdrd",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "MDRD",
    "type": "formula",
    "description": "СКФ (упрощённая формула)"
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
    "description": "Анионный промежуток ± коррекция на альбумин"
  },
  {
    "id": "fena",
    "categoryId": "nephrology",
    "categories": [
      "nephrology"
    ],
    "name": "FENa",
    "type": "formula",
    "description": "Фракционная экскреция натрия"
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
    "description": "Расчётная осмоляльность и осмолярный разрыв"
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
    "description": "Коррекция натрия при гипергликемии"
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
    "description": "Вероятность тромбоэмболии лёгочной артерии"
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
    "description": "Вероятность тромбоза глубоких вен"
  },
  {
    "id": "curb65",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "CURB-65",
    "type": "scale",
    "description": "Тяжесть внебольничной пневмонии"
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
    "description": "Альвеолярно-артериальный градиент O₂"
  },
  {
    "id": "pf_ratio",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "P/F Ratio",
    "type": "formula",
    "description": "Индекс оксигенации при ОРДС"
  },
  {
    "id": "bode",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "BODE Index",
    "type": "scale",
    "description": "Прогноз при ХОБЛ"
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
    "featured": true
  },
  {
    "id": "qsofa",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "qSOFA",
    "type": "scale",
    "description": "Быстрый скрининг сепсиса"
  },
  {
    "id": "apache2",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "APACHE II",
    "type": "scale",
    "description": "Тяжесть состояния в ОРИТ"
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
    "description": "Шкала комы Глазго"
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
    "description": "Инфузия при ожогах"
  },
  {
    "id": "child_pugh",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Child-Pugh",
    "type": "scale",
    "description": "Тяжесть цирроза печени"
  },
  {
    "id": "meld",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "MELD",
    "type": "formula",
    "description": "Смертность при болезнях печени"
  },
  {
    "id": "blatchford",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Blatchford",
    "type": "scale",
    "description": "Риск при ЖКК"
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
    "featured": true
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
    "description": "Идеальная и скорректированная масса тела"
  },
  {
    "id": "harris_benedict",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "Harris-Benedict",
    "type": "formula",
    "description": "Основной обмен и суточные калории"
  },
  {
    "id": "mifflin",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "Mifflin-St Jeor",
    "type": "formula",
    "description": "Основной обмен (современная формула)"
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
    "description": "Коррекция кальция на альбумин"
  },
  {
    "id": "ldl_friedewald",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "LDL (Friedewald)",
    "type": "formula",
    "description": "Расчётный ЛПНП"
  },
  {
    "id": "homa_ir",
    "categoryId": "endocrinology",
    "categories": [
      "endocrinology"
    ],
    "name": "HOMA-IR",
    "type": "formula",
    "description": "Индекс инсулинорезистентности"
  },
  {
    "id": "nihss",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "NIHSS",
    "type": "scale",
    "description": "Тяжесть инсульта"
  },
  {
    "id": "abcd2",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "ABCD²",
    "type": "risk",
    "description": "Риск инсульта после ТИА"
  },
  {
    "id": "mess",
    "categoryId": "trauma",
    "categories": [
      "trauma"
    ],
    "name": "MESS",
    "type": "scale",
    "description": "Оценка конечности при травме"
  },
  {
    "id": "caprini",
    "categoryId": "trauma",
    "categories": [
      "trauma"
    ],
    "name": "Caprini",
    "type": "risk",
    "description": "Риск ВТЭ у хирургических больных"
  },
  {
    "id": "phq9",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "PHQ-9",
    "type": "scale",
    "description": "Скрининг депрессии"
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
    "description": "Алкогольный абстинентный синдром"
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
    "description": "Состояние новорождённого"
  },
  {
    "id": "bishop",
    "categoryId": "obstetrics",
    "categories": [
      "obstetrics"
    ],
    "name": "Bishop",
    "type": "scale",
    "description": "Зрелость шейки матки"
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
    "description": "Предполагаемый срок родов"
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
    "description": "Соотношение белок/креатинин в разовой моче"
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
    "description": "Сердечный выброс по методу Фика"
  },
  {
    "id": "ascvd_pce",
    "categoryId": "cardiology",
    "categories": [
      "cardiology"
    ],
    "name": "ASCVD Risk",
    "type": "risk",
    "description": "10-летний риск атеросклеротических ССЗ (PCE)"
  },
  {
    "id": "ich_score",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "ICH Score",
    "type": "scale",
    "description": "30-дневная смертность при внутримозговом кровоизлиянии"
  },
  {
    "id": "hunt_hess",
    "categoryId": "neurology",
    "categories": [
      "neurology"
    ],
    "name": "Hunt-Hess",
    "type": "scale",
    "description": "Клиническая степень субарахноидального кровоизлияния"
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
    "description": "Функциональный исход после инсульта"
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
    "description": "Повседневная активность и самообслуживание"
  },
  {
    "id": "psi_port",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "PSI/PORT",
    "type": "scale",
    "description": "Тяжесть внебольничной пневмонии (класс риска)"
  },
  {
    "id": "stop_bang",
    "categoryId": "pulmonology",
    "categories": [
      "pulmonology"
    ],
    "name": "STOP-BANG",
    "type": "scale",
    "description": "Риск синдрома обструктивного апноэ сна"
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
    "description": "Вероятность ТЭЛА (пересмотренная шкала Женевы)"
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
    "description": "Дневная сонливость"
  },
  {
    "id": "rockall",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "Rockall",
    "type": "scale",
    "description": "Смертность и риск рецидива при ЖКК"
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
    "description": "Вероятность острого аппендицита"
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
    "description": "Активность язвенного колита"
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
    "description": "Активность болезни Крона"
  },
  {
    "id": "meld3",
    "categoryId": "gastro",
    "categories": [
      "gastro"
    ],
    "name": "MELD 3.0",
    "type": "formula",
    "description": "Смертность при болезнях печени (обновлённая формула)"
  },
  {
    "id": "phq2",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "PHQ-2",
    "type": "scale",
    "description": "Ультрабыстрый скрининг депрессии (2 вопроса)"
  },
  {
    "id": "bdi2",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "BDI-II",
    "type": "scale",
    "description": "Шкала депрессии Бека (21 вопрос, самооценка)"
  },
  {
    "id": "hamd17",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "HAM-D 17",
    "type": "scale",
    "description": "Шкала депрессии Гамильтона (клиницист, 17 пунктов)"
  },
  {
    "id": "hads",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "HADS",
    "type": "scale",
    "description": "Шкала тревоги и депрессии (14 вопросов, соматические пациенты)"
  },
  {
    "id": "gds15",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "GDS-15",
    "type": "scale",
    "description": "Гериатрическая шкала депрессии (для пациентов ≥65 лет)"
  },
  {
    "id": "bai",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "BAI",
    "type": "scale",
    "description": "Шкала тревоги Бека (21 вопрос, самооценка)"
  },
  {
    "id": "hama",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "HAM-A",
    "type": "scale",
    "description": "Шкала тревоги Гамильтона (клиницист, 14 пунктов)"
  },
  {
    "id": "k10",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "K10 Kessler",
    "type": "scale",
    "description": "Шкала психологического дистресса Кесслера (10 вопросов)"
  },
  {
    "id": "pcl5",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "PCL-5",
    "type": "scale",
    "description": "Опросник ПТСР по DSM-5 (20 вопросов)"
  },
  {
    "id": "mdq",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "MDQ",
    "type": "scale",
    "description": "Опросник расстройств настроения (биполярное расстройство)"
  },
  {
    "id": "hcl32",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "HCL-32",
    "type": "scale",
    "description": "Чеклист гипомании (32 пункта) — скрининг биполярного спектра"
  },
  {
    "id": "lithium_perry",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "Литий: подбор дозы (Perry)",
    "type": "formula",
    "description": "Начальная доза Li₂CO₃ по регрессии Перри, без тест-дозы"
  },
  {
    "id": "lithium_cooper",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "Литий: номограмма Купера",
    "type": "formula",
    "description": "Доза Li₂CO₃ по уровню через 24 ч после тест-дозы 600 мг"
  },
  {
    "id": "lithium_level",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "Литий: интерпретация уровня",
    "type": "formula",
    "description": "Терапевтический диапазон и признаки токсичности"
  },
  {
    "id": "gad7",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "GAD-7",
    "type": "scale",
    "description": "Скрининг генерализованного тревожного расстройства"
  },
  {
    "id": "mmse",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "MMSE",
    "type": "scale",
    "description": "Краткая оценка психического статуса"
  },
  {
    "id": "moca",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "MoCA",
    "type": "scale",
    "description": "Монреальская когнитивная оценка"
  },
  {
    "id": "audit",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "AUDIT",
    "type": "scale",
    "description": "Скрининг расстройств, связанных с употреблением алкоголя"
  },
  {
    "id": "cage",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "CAGE",
    "type": "scale",
    "description": "Скрининг алкогольной зависимости"
  },
  {
    "id": "ymrs",
    "categoryId": "psychiatry",
    "categories": [
      "psychiatry"
    ],
    "name": "YMRS",
    "type": "scale",
    "description": "Шкала оценки мании Янга"
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
    "description": "Адекватность гемодиализа"
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
    "description": "Дифференциальная диагностика метаболического ацидоза"
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
    "description": "Ожидаемая компенсация при метаболическом ацидозе"
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
    "description": "Выявление смешанных нарушений КЩС"
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
    "description": "Коррекция уровня фенитоина на альбумин"
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
    "description": "Физиологическая оценка тяжести травмы"
  },
  {
    "id": "abc_score",
    "categoryId": "trauma",
    "categories": [
      "trauma"
    ],
    "name": "ABC Score",
    "type": "scale",
    "description": "Прогноз массивной трансфузии при травме"
  },
  {
    "id": "nyha",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "NYHA",
    "type": "scale",
    "description": "Функциональный класс сердечной недостаточности"
  },
  {
    "id": "killip",
    "categoryId": "critical_care",
    "categories": [
      "critical_care"
    ],
    "name": "Killip",
    "type": "scale",
    "description": "Тяжесть СН при остром инфаркте миокарда"
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
    "description": "Площадь поверхности тела (Mosteller, DuBois, Haycock)"
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
    "description": "Дозирование карбоплатина по AUC"
  },
  {
    "id": "khorana",
    "categoryId": "oncology",
    "categories": [
      "oncology"
    ],
    "name": "Khorana Score",
    "type": "risk",
    "description": "Риск ВТЭ у онкологических пациентов на ХТ"
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
    "description": "Статус общего состояния в онкологии"
  },
  {
    "id": "mascc",
    "categoryId": "oncology",
    "categories": [
      "oncology"
    ],
    "name": "MASCC Score",
    "type": "risk",
    "description": "Риск осложнений при нейтропенической лихорадке"
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
    "description": "Абсолютное число нейтрофилов"
  },
  {
    "id": "das28",
    "categoryId": "rheumatology",
    "categories": [
      "rheumatology"
    ],
    "name": "DAS28",
    "type": "formula",
    "description": "Активность ревматоидного артрита"
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
    "description": "Диагностические критерии ревматоидного артрита 2010"
  },
  {
    "id": "pasi",
    "categoryId": "dermatology",
    "categories": [
      "dermatology"
    ],
    "name": "PASI",
    "type": "formula",
    "description": "Индекс тяжести псориаза"
  },
  {
    "id": "ipss",
    "categoryId": "urology",
    "categories": [
      "urology"
    ],
    "name": "IPSS",
    "type": "scale",
    "description": "Симптомы нижних мочевыводящих путей / ДГПЖ"
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
    "description": "Эквианальгетические дозы опиоидов"
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
    "description": "Протокол введения NAC при передозировке парацетамола"
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
    "description": "Объём распределения, клиренс, T½"
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
    "description": "Явный ДВС-синдром по критериям ISTH"
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
    "description": "Вероятность гепарин-индуцированной тромбоцитопении"
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
    "description": "Триггеры переливания эритроцитарной массы"
  },
  {
    "id": "holliday_segar",
    "categoryId": "pediatrics",
    "categories": [
      "pediatrics"
    ],
    "name": "Holliday-Segar",
    "type": "formula",
    "description": "Поддерживающий объём жидкости у детей"
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
    "description": "Шкала комы Глазго для детей"
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
    "description": "Площадь поверхности тела у детей (формула Хейкока)"
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
    "description": "Расчётная средняя гликемия по гликированному гемоглобину"
  }
];
