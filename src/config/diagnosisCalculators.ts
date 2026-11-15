// Какие клинические калькуляторы относятся к конкретному диагнозу.
//
// Ключ — тег сценария из Icd10Code.category (icd10Reference.ts), тот же
// словарь, которым уже связаны фарм-справочник (relatedCategories) и шаблоны
// назначений. Значение — идентификаторы из сгенерированного каталога
// (src/generated/calculators/catalog.ts).
//
// Эту связь неоткуда взять автоматически: в MedCalc привязки к МКБ нет вовсе,
// а класс МКБ по первой букве кода (I → кардиология) слишком груб — по нему
// «под фибрилляцию предсердий» попадали бы все два десятка кардиологических
// шкал разом, включая расчёт сердечного выброса по Фику. Поэтому здесь
// курируемый список, и он намеренно неполный: тег без строки в этой таблице
// (мигрень, ГЭРБ, конъюнктивит) — не пропуск, а честное «подходящей шкалы в
// наборе нет». Придумывать соответствие ради заполненности хуже, чем не
// показать ничего: врач решит, что шкала к его диагнозу применима.
//
// Полнота идентификаторов проверяется scripts/check-calculators.ts — он
// падает, если тут упомянут калькулятор, которого в каталоге нет.
export const CALCULATORS_BY_DIAGNOSIS: Record<string, string[]> = {
  // Кардиология
  afib: ['cha2ds2vasc', 'hasbled'],
  heart_failure: ['nyha'],
  mi: ['grace', 'timi', 'killip'],
  angina_cad: ['heart_score', 'timi', 'ascvd_pce'],
  hypertension: ['ascvd_pce', 'framingham', 'map'],

  // Пульмонология
  pneumonia: ['curb65', 'psi_port'],
  copd: ['bode', 'pf_ratio'],
  pe: ['wells_pe', 'revised_geneva'],

  // Эндокринология
  diabetes1: ['eag_hba1c'],
  diabetes2: ['eag_hba1c', 'homa_ir', 'bmi'],
  obesity: ['bmi', 'ibw', 'mifflin', 'harris_benedict'],

  // Психиатрия и неврология
  depression: ['phq9', 'phq2', 'bdi2', 'hamd17', 'hads'],
  anxiety_gad: ['gad7', 'bai', 'hama', 'hads'],
  bipolar: ['mdq', 'hcl32', 'ymrs', 'lithium_level'],
  dementia: ['mmse', 'moca'],
  insomnia: ['epworth', 'stop_bang'],

  // Гастроэнтерология
  peptic_ulcer: ['blatchford', 'rockall'],

  // Урология и дерматология
  bph: ['ipss'],
  psoriasis: ['pasi'],
};

/** Калькуляторы под тег сценария; пустой массив, если привязки нет. */
export const getCalculatorsForDiagnosis = (category?: string | null): string[] =>
  (category && CALCULATORS_BY_DIAGNOSIS[category]) || [];
