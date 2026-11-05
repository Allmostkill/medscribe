// Справочник МКБ-10 — курированный список ЧАСТО ИСПОЛЬЗУЕМЫХ кодов на
// специальность для быстрого поиска/копирования. Это НЕ полная официальная
// база МКБ-10 (в проекте такой нет и не подключается) — при необходимости
// сверяйте точный код в официальном классификаторе.

export interface Icd10Code {
  code: string;
  name: string;
  // Тег клинического сценария для связки с фарм-справочником/дозами/шаблонами
  // назначений той же специальности (см. activeDiagnosis в Dashboard.tsx).
  // Гранулярность — «диагноз/тесный кластер», а не система органов (иначе
  // при выборе гипертензии подсветится и фибрилляция предсердий — слишком
  // грубо). Заполнено не для всех кодов: некоторым просто нет соответствия
  // в остальных 3 файлах, это ожидаемо.
  category?: string;
}

export const ICD10_REFERENCE: Record<string, Icd10Code[]> = {
  therapist: [
    { code: 'J06.9', name: 'Острая инфекция верхних дыхательных путей неуточнённая', category: 'uri' },
    { code: 'J02.9', name: 'Острый фарингит неуточнённый', category: 'uri' },
    { code: 'J20.9', name: 'Острый бронхит неуточнённый', category: 'uri' },
    { code: 'J18.9', name: 'Пневмония неуточнённая', category: 'pneumonia' },
    { code: 'I10', name: 'Эссенциальная (первичная) гипертензия', category: 'hypertension' },
    { code: 'E11.9', name: 'Сахарный диабет 2 типа без осложнений' },
    { code: 'E66.9', name: 'Ожирение неуточнённое' },
    { code: 'K29.7', name: 'Гастрит неуточнённый', category: 'gastritis_gerd' },
    { code: 'M54.5', name: 'Боль внизу спины' },
    { code: 'R51', name: 'Головная боль' },
    { code: 'R50.9', name: 'Лихорадка неуточнённая', category: 'fever' },
    { code: 'J45.9', name: 'Астма неуточнённая' },
    { code: 'N39.0', name: 'Инфекция мочевыводящих путей без установленной локализации' },
  ],
  psychiatrist: [
    { code: 'F32.1', name: 'Депрессивный эпизод средней степени тяжести', category: 'depression' },
    { code: 'F33.1', name: 'Рекуррентное депрессивное расстройство, текущий эпизод средней тяжести', category: 'depression' },
    { code: 'F41.1', name: 'Генерализованное тревожное расстройство', category: 'anxiety_gad' },
    { code: 'F41.0', name: 'Паническое расстройство', category: 'panic' },
    { code: 'F42', name: 'Обсессивно-компульсивное расстройство' },
    { code: 'F20.0', name: 'Параноидная шизофрения', category: 'schizophrenia' },
    { code: 'F31.9', name: 'Биполярное аффективное расстройство неуточнённое', category: 'bipolar' },
    { code: 'F43.1', name: 'Посттравматическое стрессовое расстройство' },
    { code: 'F43.2', name: 'Расстройство адаптации' },
    { code: 'F60.3', name: 'Эмоционально неустойчивое расстройство личности' },
    { code: 'F10.2', name: 'Синдром зависимости от алкоголя' },
    { code: 'F90.0', name: 'Нарушение активности и внимания (СДВГ)' },
    { code: 'F51.0', name: 'Бессонница неорганической природы', category: 'insomnia' },
  ],
  cardiologist: [
    { code: 'I10', name: 'Эссенциальная гипертензия', category: 'hypertension' },
    { code: 'I11.9', name: 'Гипертензивная болезнь сердца без сердечной недостаточности', category: 'hypertension' },
    { code: 'I20.9', name: 'Стенокардия неуточнённая', category: 'angina_cad' },
    { code: 'I20.0', name: 'Нестабильная стенокардия', category: 'angina_cad' },
    { code: 'I21.9', name: 'Острый инфаркт миокарда неуточнённый', category: 'mi' },
    { code: 'I25.1', name: 'Атеросклеротическая болезнь сердца', category: 'angina_cad' },
    { code: 'I48.9', name: 'Фибрилляция предсердий неуточнённая', category: 'afib' },
    { code: 'I50.9', name: 'Сердечная недостаточность неуточнённая', category: 'heart_failure' },
    { code: 'I49.9', name: 'Нарушение сердечного ритма неуточнённое' },
    { code: 'I73.9', name: 'Болезнь периферических сосудов неуточнённая' },
    { code: 'I35.0', name: 'Аортальный (клапанный) стеноз' },
    { code: 'I26.9', name: 'Лёгочная эмболия без острого лёгочного сердца', category: 'pe' },
    { code: 'I80.9', name: 'Флебит и тромбофлебит неуточнённой локализации' },
  ],
  endocrinologist: [
    { code: 'E10.9', name: 'Сахарный диабет 1 типа без осложнений', category: 'diabetes1' },
    { code: 'E11.9', name: 'Сахарный диабет 2 типа без осложнений', category: 'diabetes2' },
    { code: 'E03.9', name: 'Гипотиреоз неуточнённый', category: 'hypothyroidism' },
    { code: 'E05.0', name: 'Тиреотоксикоз с диффузным зобом', category: 'hyperthyroidism' },
    { code: 'E04.1', name: 'Нетоксический одноузловой зоб' },
    { code: 'E66.9', name: 'Ожирение неуточнённое', category: 'obesity' },
    { code: 'E27.4', name: 'Другая и неуточнённая недостаточность коры надпочечников' },
    { code: 'E21.0', name: 'Первичный гиперпаратиреоз' },
    { code: 'E28.2', name: 'Синдром поликистозных яичников' },
    { code: 'M81.0', name: 'Постменопаузный остеопороз', category: 'osteoporosis' },
    { code: 'E16.2', name: 'Гипогликемия неуточнённая' },
  ],
  neurologist: [
    { code: 'G43.9', name: 'Мигрень неуточнённая', category: 'migraine' },
    { code: 'G43.0', name: 'Мигрень без ауры', category: 'migraine' },
    { code: 'G44.2', name: 'Головная боль напряжённого типа', category: 'tension_headache' },
    { code: 'G40.9', name: 'Эпилепсия неуточнённая', category: 'epilepsy' },
    { code: 'G45.9', name: 'Транзиторная ишемическая атака неуточнённая' },
    { code: 'I63.9', name: 'Инфаркт мозга неуточнённый (ишемический инсульт)' },
    { code: 'G20', name: 'Болезнь Паркинсона', category: 'parkinsons' },
    { code: 'G30.9', name: 'Болезнь Альцгеймера неуточнённая', category: 'dementia' },
    { code: 'G35', name: 'Рассеянный склероз' },
    { code: 'G56.0', name: 'Синдром запястного канала' },
    { code: 'M54.1', name: 'Радикулопатия', category: 'radiculopathy' },
    { code: 'G62.9', name: 'Полиневропатия неуточнённая', category: 'polyneuropathy' },
    { code: 'R42', name: 'Головокружение и неустойчивость' },
  ],
  pediatrician: [
    { code: 'J06.9', name: 'ОРВИ (острая инфекция верхних дыхательных путей неуточнённая)', category: 'uri' },
    { code: 'J03.9', name: 'Острый тонзиллит неуточнённый' },
    { code: 'J20.9', name: 'Острый бронхит неуточнённый' },
    { code: 'J18.9', name: 'Пневмония неуточнённая', category: 'pneumonia' },
    { code: 'H66.9', name: 'Средний отит неуточнённый', category: 'otitis_media' },
    { code: 'A09', name: 'Диарея и гастроэнтерит предположительно инфекционного происхождения' },
    { code: 'R50.9', name: 'Лихорадка неуточнённая', category: 'fever' },
    { code: 'J45.9', name: 'Астма неуточнённая' },
    { code: 'L20.9', name: 'Атопический дерматит неуточнённый', category: 'atopic_dermatitis' },
    { code: 'B34.9', name: 'Вирусная инфекция неуточнённая' },
    { code: 'K59.0', name: 'Запор' },
  ],
  pulmonologist: [
    { code: 'J45.9', name: 'Астма неуточнённая', category: 'asthma' },
    { code: 'J44.9', name: 'ХОБЛ неуточнённая', category: 'copd' },
    { code: 'J44.1', name: 'ХОБЛ с обострением', category: 'copd' },
    { code: 'J18.9', name: 'Пневмония неуточнённая', category: 'pneumonia' },
    { code: 'J20.9', name: 'Острый бронхит неуточнённый' },
    { code: 'J84.9', name: 'Интерстициальное заболевание лёгких неуточнённое' },
    { code: 'J43.9', name: 'Эмфизема неуточнённая', category: 'copd' },
    { code: 'J90', name: 'Плевральный выпот' },
    { code: 'G47.3', name: 'Апноэ во сне' },
    { code: 'J47', name: 'Бронхоэктатическая болезнь' },
  ],
  gynecologist: [
    { code: 'N92.0', name: 'Обильные и частые менструации при регулярном цикле', category: 'menorrhagia' },
    { code: 'N91.2', name: 'Аменорея неуточнённая' },
    { code: 'N80.9', name: 'Эндометриоз неуточнённый' },
    { code: 'N83.2', name: 'Другие и неуточнённые кисты яичника' },
    { code: 'N70.9', name: 'Сальпингит и оофорит неуточнённые', category: 'pid' },
    { code: 'N76.0', name: 'Острый вагинит', category: 'vaginitis' },
    { code: 'B37.3', name: 'Кандидоз вульвы и вагины', category: 'candidiasis' },
    { code: 'N95.1', name: 'Менопаузальные и климактерические состояния', category: 'menopause' },
    { code: 'N87.9', name: 'Дисплазия шейки матки неуточнённая' },
    { code: 'E28.2', name: 'Синдром поликистозных яичников' },
    { code: 'N60.9', name: 'Доброкачественная дисплазия молочной железы неуточнённая' },
  ],
  gastroenterologist: [
    { code: 'K21.0', name: 'ГЭРБ с эзофагитом', category: 'gerd' },
    { code: 'K21.9', name: 'ГЭРБ без эзофагита', category: 'gerd' },
    { code: 'K29.7', name: 'Гастрит неуточнённый', category: 'gastritis' },
    { code: 'K25.9', name: 'Язва желудка неуточнённая', category: 'peptic_ulcer' },
    { code: 'K27.9', name: 'Пептическая язва неуточнённой локализации', category: 'peptic_ulcer' },
    { code: 'K58.9', name: 'Синдром раздражённого кишечника без диареи', category: 'ibs' },
    { code: 'K52.9', name: 'Неинфекционный гастроэнтерит и колит неуточнённый' },
    { code: 'K76.0', name: 'Жировая дегенерация печени' },
    { code: 'K80.2', name: 'Камни жёлчного пузыря без холецистита' },
    { code: 'K74.6', name: 'Другой и неуточнённый цирроз печени' },
    { code: 'K90.0', name: 'Целиакия' },
    { code: 'K59.0', name: 'Запор' },
  ],
  dermatologist: [
    { code: 'L20.9', name: 'Атопический дерматит неуточнённый', category: 'atopic_dermatitis' },
    { code: 'L40.9', name: 'Псориаз неуточнённый', category: 'psoriasis' },
    { code: 'L70.9', name: 'Акне неуточнённое', category: 'acne' },
    { code: 'L21.9', name: 'Себорейный дерматит неуточнённый' },
    { code: 'L30.9', name: 'Дерматит неуточнённый' },
    { code: 'B35.9', name: 'Дерматофития неуточнённая', category: 'dermatophytosis' },
    { code: 'L50.9', name: 'Крапивница неуточнённая' },
    { code: 'L98.9', name: 'Поражение кожи и подкожной клетчатки неуточнённое' },
    { code: 'L81.9', name: 'Нарушение пигментации неуточнённое' },
    { code: 'D22.9', name: 'Меланоцитарный невус неуточнённый' },
  ],
  ophthalmologist: [
    { code: 'H10.9', name: 'Конъюнктивит неуточнённый', category: 'conjunctivitis' },
    { code: 'H40.9', name: 'Глаукома неуточнённая', category: 'glaucoma' },
    { code: 'H25.9', name: 'Старческая катаракта неуточнённая' },
    { code: 'H52.1', name: 'Миопия' },
    { code: 'H52.0', name: 'Гиперметропия' },
    { code: 'H52.4', name: 'Пресбиопия' },
    { code: 'H35.3', name: 'Дегенерация макулы и заднего полюса', category: 'amd' },
    { code: 'H16.9', name: 'Кератит неуточнённый', category: 'keratitis' },
    { code: 'H00.0', name: 'Гордеолум (ячмень) и другие глубокие воспаления век' },
    { code: 'H43.9', name: 'Болезнь стекловидного тела неуточнённая' },
  ],
  otolaryngologist: [
    { code: 'J02.9', name: 'Острый фарингит неуточнённый', category: 'tonsillopharyngitis' },
    { code: 'J03.9', name: 'Острый тонзиллит неуточнённый', category: 'tonsillopharyngitis' },
    { code: 'H66.9', name: 'Средний отит неуточнённый', category: 'otitis_media' },
    { code: 'J01.9', name: 'Острый синусит неуточнённый', category: 'sinusitis' },
    { code: 'J32.9', name: 'Хронический синусит неуточнённый', category: 'sinusitis' },
    { code: 'H65.9', name: 'Негнойный средний отит неуточнённый', category: 'otitis_media' },
    { code: 'J35.0', name: 'Хронический тонзиллит', category: 'tonsillopharyngitis' },
    { code: 'H61.2', name: 'Серная пробка' },
    { code: 'H81.1', name: 'Доброкачественное пароксизмальное позиционное головокружение' },
    { code: 'R04.0', name: 'Носовое кровотечение' },
  ],
  urologist: [
    { code: 'N39.0', name: 'Инфекция мочевыводящих путей без установленной локализации', category: 'cystitis_uti' },
    { code: 'N40', name: 'Гиперплазия предстательной железы', category: 'bph' },
    { code: 'N20.0', name: 'Камни почки', category: 'kidney_stones' },
    { code: 'N20.1', name: 'Камни мочеточника', category: 'kidney_stones' },
    { code: 'N30.9', name: 'Цистит неуточнённый', category: 'cystitis_uti' },
    { code: 'N41.9', name: 'Воспалительная болезнь предстательной железы неуточнённая' },
    { code: 'R33.9', name: 'Задержка мочи неуточнённая' },
    { code: 'N39.3', name: 'Непроизвольное (стрессовое) мочеиспускание' },
    { code: 'N45.9', name: 'Орхит и эпидидимит без абсцесса' },
    { code: 'N48.4', name: 'Импотенция органического происхождения', category: 'ed' },
  ],
  orthopedist: [
    { code: 'M54.5', name: 'Боль внизу спины', category: 'low_back_pain' },
    { code: 'M54.2', name: 'Цервикалгия' },
    { code: 'M17.9', name: 'Гонартроз неуточнённый', category: 'joint_oa' },
    { code: 'M16.9', name: 'Коксартроз неуточнённый', category: 'joint_oa' },
    { code: 'M75.1', name: 'Синдром сдавления ротатора плеча' },
    { code: 'M77.1', name: 'Латеральный эпикондилит (теннисный локоть)', category: 'lateral_epicondylitis' },
    { code: 'M25.5', name: 'Боль в суставе' },
    { code: 'M79.1', name: 'Миалгия' },
    { code: 'M51.2', name: 'Другое уточнённое смещение межпозвоночного диска', category: 'low_back_pain' },
    { code: 'M06.9', name: 'Ревматоидный артрит неуточнённый' },
    { code: 'M81.9', name: 'Остеопороз неуточнённый' },
  ],
};

export function getIcd10Reference(specialtyId: string): Icd10Code[] {
  return ICD10_REFERENCE[specialtyId] ?? [];
}

/**
 * Клинические категории, упомянутые в свободном тексте диагноза.
 *
 * Поле diagnoses в протоколе — обычный текст, который врач правит руками
 * («I10 Эссенциальная гипертензия», «Гипертоническая болезнь II ст.»), а не
 * выбранный код. Чтобы подтянуть к нему красные флаги (redFlags.ts), надо
 * восстановить category — ищем в тексте коды МКБ-10 из курированного
 * справочника.
 *
 * Сначала своя специальность, потом остальные: у терапевта в протоколе легко
 * окажется кардиологический код, и терять его из-за специальности нельзя.
 * Длинные коды проверяем первыми, чтобы «E11.9» не схлопнулось в «E11».
 *
 * Совпадение по названию диагноза сознательно НЕ делаем: слишком много ложных
 * срабатываний на подстроках, а цена ошибки — чужой список тревожных
 * симптомов в памятке пациенту.
 */
// Кириллические омоглифы латинских букв. Врач набирает диагноз в русской
// раскладке, и «С61» с русской «С» визуально неотличим от «C61» с латинской —
// а по кодовой точке это разные символы, и код молча не находился.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
  'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X',
};

function normalizeCodes(text: string): string {
  return text.replace(/[АВЕКМНОРСТУХ]/g, ch => CYRILLIC_TO_LATIN[ch] ?? ch);
}

export function findIcd10Categories(text: string, specialtyId: string): string[] {
  if (!text?.trim()) return [];
  const haystack = normalizeCodes(text);

  const own = ICD10_REFERENCE[specialtyId] ?? [];
  const rest = Object.entries(ICD10_REFERENCE)
    .filter(([id]) => id !== specialtyId)
    .flatMap(([, codes]) => codes);
  const ordered = [...own, ...rest];

  const found: string[] = [];
  for (const entry of [...ordered].sort((a, b) => b.code.length - a.code.length)) {
    if (!entry.category || found.includes(entry.category)) continue;
    // Код целиком: «I10» не должен ловиться внутри «AI105». Точку экранируем.
    const re = new RegExp(`(^|[^A-Za-zА-Яа-я0-9.])${entry.code.replace('.', '\\.')}(?![0-9])`, 'i');
    if (re.test(haystack)) found.push(entry.category);
  }

  // Трёхзначная рубрика. Справочник хранит уточнённые коды («G43.0», «E11.9»),
  // а врачи сплошь и рядом пишут рубрику целиком — «G43», «E11». Совпадения по
  // полному коду не было, findIcd10Categories возвращала пустой список, и
  // пациент вместо профильных красных флагов уносил общие, а раздел при этом
  // выглядел заполненным. Уточнённый код сюда не попадает: (?![0-9.]) не даёт
  // «G43» из «G43.0» сработать второй раз — его уже разобрал цикл выше.
  for (const m of haystack.matchAll(/(^|[^A-Za-zА-Яа-я0-9.])([A-Za-z]\d{2})(?![0-9.])/g)) {
    const rubric = m[2].toUpperCase();
    for (const entry of ordered) {
      if (!entry.category || found.includes(entry.category)) continue;
      if (entry.code.toUpperCase().startsWith(rubric)) found.push(entry.category);
    }
  }

  return found;
}
