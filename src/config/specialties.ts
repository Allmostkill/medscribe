export interface DiagnosticPrivileges {
  prescriptionLimits: string[];
  requiresLicense: boolean;
  warnings: string[];
}

export interface SpecialtyConfig {
  id: string;
  name: string;
  clinicalFocus: string;
  privileges: DiagnosticPrivileges;
}

export const MEDICAL_SPECIALTIES: Record<string, SpecialtyConfig> = {
  therapist: {
    id: "therapist",
    name: "Терапевт",
    clinicalFocus: "Первичное звено, общая диагностика, маршрутизация",
    privileges: {
      prescriptionLimits: ["Стандартные препараты", "Исключены препараты строгой учетности (148-1/у-88) без ВК"],
      requiresLicense: false,
      warnings: ["Назначение антидепрессантов СИОЗС допускается только при подтвержденном ГТР/Депрессии легкой степени, иначе маршрутизация к психиатру."]
    }
  },
  cardiologist: {
    id: "cardiologist",
    name: "Кардиолог",
    clinicalFocus: "Сердечно-сосудистая система, ЭКГ, гипертония, ХСН",
    privileges: {
      prescriptionLimits: ["Антиаритмические", "Гипотензивные", "Статины"],
      requiresLicense: false,
      warnings: []
    }
  },
  neurologist: {
    id: "neurologist",
    name: "Невролог",
    clinicalFocus: "ЦНС, ПНС, болевые синдромы",
    privileges: {
      prescriptionLimits: ["Антиконвульсанты", "Ноотропы (ограничено EBM)", "Некоторые транквилизаторы"],
      requiresLicense: false,
      warnings: ["Строгие психотропные препараты требуют контроля."]
    }
  },
  endocrinologist: {
    id: "endocrinologist",
    name: "Эндокринолог",
    clinicalFocus: "Гормональные сбои, диабет, щитовидная железа",
    privileges: {
      prescriptionLimits: ["Инсулины", "Гормональные препараты"],
      requiresLicense: false,
      warnings: ["Назначение гормональной терапии требует лабораторного подтверждения."]
    }
  },
  psychiatrist: {
    id: "psychiatrist",
    name: "Психиатр",
    clinicalFocus: "Психические расстройства, клиническая депрессия, шизофрения, БАР",
    privileges: {
      prescriptionLimits: ["Любые психотропные", "Наркотические анальгетики (по показаниям)", "Препараты списков ПКУ (№ 148-1/у-88 и № 107/у-НП)"],
      requiresLicense: true, // Requires strict medical license logging
      warnings: ["ВНИМАНИЕ: Выписка строгорецептурных препаратов. Требуется внесение в особый реестр ПКУ МИС."]
    }
  },
  pediatrician: {
    id: "pediatrician",
    name: "Педиатр",
    clinicalFocus: "Детские болезни, вакцинация",
    privileges: {
      prescriptionLimits: ["Детские дозировки (строго по массе тела)"],
      requiresLicense: false,
      warnings: ["ДЕТСКИЙ ВОЗРАСТ: Многие препараты (например, фторхинолоны, тетрациклины) противопоказаны. Обязательно проверять возрастные ограничения!"]
    }
  },
  pulmonologist: {
    id: "pulmonologist",
    name: "Пульмонолог",
    clinicalFocus: "Бронхолегочные заболевания, бронхиальная астма, ХОБЛ",
    privileges: {
      prescriptionLimits: ["Бронходилататоры", "ИГКС"],
      requiresLicense: false,
      warnings: []
    }
  },
  gastroenterologist: {
    id: "gastroenterologist",
    name: "Гастроэнтеролог",
    clinicalFocus: "ЖКТ, гепатобилиарная система, поджелудочная железа",
    privileges: {
      prescriptionLimits: ["ИПП", "Спазмолитики", "Ферменты", "УДХК"],
      requiresLicense: false,
      warnings: ["При тревожных симптомах (мелена, потеря веса, дисфагия) — срочная ЭГДС/колоноскопия."]
    }
  },
  gynecologist: {
    id: "gynecologist",
    name: "Гинеколог",
    clinicalFocus: "Женское репродуктивное здоровье, беременность, контрацепция",
    privileges: {
      prescriptionLimits: ["Гормональная контрацепция", "ЗГТ", "Антибиотики для УГИ"],
      requiresLicense: false,
      warnings: ["Беременность — особый протокол назначений. Учитывать категории риска FDA (A/B/C/D/X)."]
    }
  },
  dermatologist: {
    id: "dermatologist",
    name: "Дерматолог",
    clinicalFocus: "Кожа, придатки кожи, ИППП",
    privileges: {
      prescriptionLimits: ["Топические ГКС", "Ретиноиды (системные — по показаниям)", "Антимикотики"],
      requiresLicense: false,
      warnings: ["Изотретиноин — программа предупреждения беременности обязательна."]
    }
  },
  ophthalmologist: {
    id: "ophthalmologist",
    name: "Офтальмолог",
    clinicalFocus: "Зрение, рефракция, глазное дно, ВГД",
    privileges: {
      prescriptionLimits: ["Глазные капли (антиглаукомные, антибактериальные, противовоспалительные)"],
      requiresLicense: false,
      warnings: []
    }
  },
  otolaryngologist: {
    id: "otolaryngologist",
    name: "Оториноларинголог (ЛОР)",
    clinicalFocus: "Ухо, горло, нос, верхние дыхательные пути",
    privileges: {
      prescriptionLimits: ["Топические деконгестанты (с ограничением 5-7 дней)", "Антибиотики"],
      requiresLicense: false,
      warnings: ["Деконгестанты >7 дней → медикаментозный ринит."]
    }
  },
  urologist: {
    id: "urologist",
    name: "Уролог",
    clinicalFocus: "Мужское и женское урологическое здоровье, простата, ИМП",
    privileges: {
      prescriptionLimits: ["α1-адреноблокаторы", "Ингибиторы 5α-редуктазы", "Антибиотики для ИМП"],
      requiresLicense: false,
      warnings: []
    }
  },
  orthopedist: {
    id: "orthopedist",
    name: "Травматолог-ортопед",
    clinicalFocus: "ОДА, травмы, артриты, артрозы, спортивная медицина",
    privileges: {
      prescriptionLimits: ["НПВС", "Хондропротекторы", "Местные ГКС инъекции"],
      requiresLicense: false,
      warnings: ["НПВС длительно — гастро- и нефротоксичность. Проверить ЖКТ-риск (Lanza)."]
    }
  },
  ultrasound: {
    id: "ultrasound",
    name: "Врач УЗИ",
    clinicalFocus: "Ультразвуковая диагностика, биометрия, допплерография, скрининги",
    privileges: {
      prescriptionLimits: ["Не назначает лекарства — только рекомендации по обследованию"],
      requiresLicense: false,
      warnings: [
        "Протокол — строго описательный (без диагноза МКБ).",
        "При тревожных эхопризнаках (новообразование, свободная жидкость) — срочная маршрутизация к профильному специалисту."
      ]
    }
  },
  dentist: {
    id: "dentist",
    name: "Стоматолог",
    clinicalFocus: "Терапевтическая, хирургическая стоматология, пародонтология",
    privileges: {
      prescriptionLimits: ["Местные анестетики", "Антибиотики при одонтогенных осложнениях", "НПВС"],
      requiresLicense: false,
      warnings: ["Уточнять аллергию на анестетики (артикаин, лидокаин) до инъекции.", "Беременность и сопутствующие заболевания (сахарный диабет, нарушения свёртываемости) — ограничения на анестезию и рентген."]
    }
  }
};
