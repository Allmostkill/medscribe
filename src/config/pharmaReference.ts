// Фарм-справочник МНН по специальности — читай, не диктуй. Переработано (не
// копия) из текстовых списков "Примеры препаратов (МНН)", которые сегодня
// зашиты в system-промпт /api/ai/analyze (server.ts) для коррекции STT-ошибок;
// здесь та же фактура structured для показа врачу на рабочем поле.
// Это справочный список для быстрой ориентировки, а не полная фармакопея —
// сверяйте дозы и противопоказания с инструкцией препарата.

export interface PharmaGroup {
  group: string;
  // Совпадает со значениями Icd10Code.category (та же специальность) —
  // группа может относиться к нескольким сценариям.
  relatedCategories?: string[];
  drugs: { mnn: string; note?: string }[];
}

export const PHARMA_REFERENCE: Record<string, PharmaGroup[]> = {
  therapist: [
    {
      group: 'Жаропонижающие / НПВС',
      relatedCategories: ['uri', 'fever'],
      drugs: [
        { mnn: 'парацетамол' },
        { mnn: 'ибупрофен' },
        { mnn: 'нимесулид' },
      ],
    },
    {
      group: 'Антибиотики первой линии',
      relatedCategories: ['uri', 'pneumonia'],
      drugs: [
        { mnn: 'амоксициллин' },
        { mnn: 'амоксициллин/клавуланат' },
        { mnn: 'азитромицин' },
        { mnn: 'цефиксим' },
      ],
    },
    {
      group: 'Антигипертензивные (базовые классы)',
      relatedCategories: ['hypertension'],
      drugs: [
        { mnn: 'эналаприл', note: 'иАПФ' },
        { mnn: 'лозартан', note: 'БРА' },
        { mnn: 'амлодипин', note: 'БКК' },
        { mnn: 'бисопролол', note: 'β-блокатор' },
      ],
    },
    {
      group: 'ИПП / гастропротекция',
      relatedCategories: ['gastritis_gerd'],
      drugs: [{ mnn: 'омепразол' }, { mnn: 'пантопразол' }],
    },
  ],
  psychiatrist: [
    {
      group: 'Антидепрессанты — СИОЗС/СИОЗСН',
      relatedCategories: ['depression', 'anxiety_gad', 'panic'],
      drugs: [
        { mnn: 'сертралин' }, { mnn: 'флуоксетин' }, { mnn: 'эсциталопрам' },
        { mnn: 'пароксетин' }, { mnn: 'флувоксамин' }, { mnn: 'венлафаксин' },
        { mnn: 'дулоксетин' }, { mnn: 'милнаципран' },
      ],
    },
    {
      group: 'Антидепрессанты — другие классы',
      relatedCategories: ['depression'],
      drugs: [
        { mnn: 'миртазапин' }, { mnn: 'амитриптилин' }, { mnn: 'кломипрамин' },
        { mnn: 'имипрамин' }, { mnn: 'тразодон' }, { mnn: 'агомелатин' },
        { mnn: 'бупропион' }, { mnn: 'вортиоксетин' }, { mnn: 'моклобемид' }, { mnn: 'пирлиндол' },
      ],
    },
    {
      group: 'Нейролептики',
      relatedCategories: ['schizophrenia', 'bipolar'],
      drugs: [
        { mnn: 'рисперидон' }, { mnn: 'оланзапин' }, { mnn: 'кветиапин' },
        { mnn: 'арипипразол' }, { mnn: 'клозапин' }, { mnn: 'галоперидол' }, { mnn: 'хлорпромазин' },
        { mnn: 'палиперидон' }, { mnn: 'амисульприд' }, { mnn: 'зипрасидон' },
        { mnn: 'карипразин' }, { mnn: 'луразидон' }, { mnn: 'брекспипразол' },
      ],
    },
    {
      group: 'Стабилизаторы настроения',
      relatedCategories: ['bipolar'],
      drugs: [
        { mnn: 'лития карбонат' }, { mnn: 'вальпроевая кислота' },
        { mnn: 'ламотриджин' }, { mnn: 'карбамазепин' }, { mnn: 'окскарбазепин' },
      ],
    },
    {
      group: 'Анксиолитики / снотворные',
      relatedCategories: ['anxiety_gad', 'panic', 'insomnia'],
      drugs: [
        { mnn: 'диазепам' }, { mnn: 'феназепам' }, { mnn: 'алпразолам' },
        { mnn: 'лоразепам' }, { mnn: 'клоназепам' }, { mnn: 'буспирон' },
        { mnn: 'гидроксизин' }, { mnn: 'этифоксин' }, { mnn: 'зопиклон' }, { mnn: 'прегабалин' },
      ],
    },
    {
      group: 'Корректоры экстрапирамидных расстройств',
      relatedCategories: ['schizophrenia', 'bipolar'],
      drugs: [
        { mnn: 'тригексифенидил' }, { mnn: 'бипериден' }, { mnn: 'амантадин' },
        { mnn: 'пропранолол', note: 'акатизия, тремор' },
      ],
    },
  ],
  cardiologist: [
    {
      group: 'иАПФ',
      relatedCategories: ['hypertension'],
      drugs: [{ mnn: 'эналаприл' }, { mnn: 'периндоприл' }, { mnn: 'рамиприл' }, { mnn: 'лизиноприл' }, { mnn: 'фозиноприл' }],
    },
    {
      group: 'БРА',
      relatedCategories: ['hypertension'],
      drugs: [{ mnn: 'лозартан' }, { mnn: 'валсартан' }, { mnn: 'кандесартан' }, { mnn: 'телмисартан' }, { mnn: 'ирбесартан' }],
    },
    {
      group: 'β-блокаторы',
      relatedCategories: ['hypertension', 'afib', 'angina_cad'],
      drugs: [{ mnn: 'бисопролол' }, { mnn: 'метопролола сукцинат' }, { mnn: 'небиволол' }, { mnn: 'карведилол' }],
    },
    {
      group: 'БКК',
      relatedCategories: ['hypertension'],
      drugs: [{ mnn: 'амлодипин' }, { mnn: 'фелодипин' }, { mnn: 'нифедипин-ретард' }, { mnn: 'верапамил' }, { mnn: 'дилтиазем' }],
    },
    {
      group: 'Диуретики',
      relatedCategories: ['hypertension', 'heart_failure'],
      drugs: [{ mnn: 'гидрохлоротиазид' }, { mnn: 'индапамид' }, { mnn: 'торасемид' }, { mnn: 'спиронолактон' }, { mnn: 'эплеренон' }],
    },
    {
      group: 'Статины',
      relatedCategories: ['angina_cad'],
      drugs: [{ mnn: 'аторвастатин' }, { mnn: 'розувастатин' }, { mnn: 'питавастатин' }],
    },
    {
      group: 'Антиагреганты / антикоагулянты',
      relatedCategories: ['angina_cad', 'mi', 'afib', 'pe'],
      drugs: [
        { mnn: 'ацетилсалициловая кислота' }, { mnn: 'клопидогрел' }, { mnn: 'тикагрелор' },
        { mnn: 'варфарин' }, { mnn: 'ривароксабан' }, { mnn: 'апиксабан' }, { mnn: 'дабигатран' }, { mnn: 'эдоксабан' },
      ],
    },
  ],
  endocrinologist: [
    {
      group: 'Сахароснижающие',
      relatedCategories: ['diabetes2'],
      drugs: [
        { mnn: 'метформин', note: 'Сиофор, Глюкофаж' },
        { mnn: 'эмпаглифлозин', note: 'иНГЛТ-2, Джардинс' },
        { mnn: 'дапаглифлозин', note: 'иНГЛТ-2, Форсига' },
        { mnn: 'семаглутид', note: 'аГПП-1, Оземпик' },
        { mnn: 'лираглутид', note: 'аГПП-1, Виктоза' },
        { mnn: 'дулаглутид', note: 'аГПП-1, Трулисити' },
      ],
    },
    {
      group: 'Инсулины',
      relatedCategories: ['diabetes1', 'diabetes2'],
      drugs: [
        { mnn: 'гларгин', note: 'Лантус' }, { mnn: 'деглудек', note: 'Тресиба' },
        { mnn: 'детемир' }, { mnn: 'аспарт', note: 'НовоРапид' }, { mnn: 'лизпро' },
      ],
    },
    {
      group: 'Щитовидная железа',
      relatedCategories: ['hypothyroidism', 'hyperthyroidism'],
      drugs: [{ mnn: 'левотироксин натрия', note: 'Эутирокс, L-Тироксин' }, { mnn: 'тиамазол', note: 'Мерказолил' }, { mnn: 'пропилтиоурацил' }],
    },
    {
      group: 'Остеопороз',
      relatedCategories: ['osteoporosis'],
      drugs: [{ mnn: 'алендронат' }, { mnn: 'ризедронат' }, { mnn: 'золедроновая кислота' }],
    },
  ],
  neurologist: [
    {
      group: 'Триптаны (мигрень, купирование)',
      relatedCategories: ['migraine'],
      drugs: [{ mnn: 'суматриптан' }, { mnn: 'ризатриптан' }, { mnn: 'элетриптан' }, { mnn: 'золмитриптан' }],
    },
    {
      group: 'Антиконвульсанты',
      relatedCategories: ['epilepsy', 'radiculopathy', 'polyneuropathy'],
      drugs: [
        { mnn: 'вальпроевая кислота' }, { mnn: 'ламотриджин' }, { mnn: 'леветирацетам' },
        { mnn: 'топирамат' }, { mnn: 'карбамазепин' }, { mnn: 'окскарбазепин' }, { mnn: 'прегабалин' }, { mnn: 'габапентин' },
      ],
    },
    {
      group: 'Профилактика мигрени',
      relatedCategories: ['migraine'],
      drugs: [{ mnn: 'топирамат' }, { mnn: 'амитриптилин' }, { mnn: 'кандесартан' }, { mnn: 'эренумаб', note: 'моноклональное АТ' }, { mnn: 'фреманезумаб', note: 'моноклональное АТ' }],
    },
    {
      group: 'Миорелаксанты',
      relatedCategories: ['radiculopathy', 'tension_headache'],
      drugs: [{ mnn: 'толперизон', note: 'Мидокалм' }, { mnn: 'тизанидин', note: 'Сирдалуд' }, { mnn: 'баклофен' }],
    },
    {
      group: 'Противодементные препараты',
      relatedCategories: ['dementia'],
      drugs: [{ mnn: 'донепезил' }, { mnn: 'мемантин' }, { mnn: 'галантамин' }, { mnn: 'ривастигмин' }],
    },
    {
      group: 'Противопаркинсонические средства',
      relatedCategories: ['parkinsons'],
      drugs: [
        { mnn: 'леводопа/карбидопа' }, { mnn: 'прамипексол' }, { mnn: 'амантадин' },
        { mnn: 'тригексифенидил', note: 'коррекция тремора' },
      ],
    },
  ],
  pediatrician: [
    {
      group: 'Жаропонижающие / анальгетики (доза по массе тела!)',
      relatedCategories: ['uri', 'fever'],
      drugs: [
        { mnn: 'парацетамол', note: '15 мг/кг до 4 раз/сут' },
        { mnn: 'ибупрофен', note: '10 мг/кг до 3 раз/сут' },
      ],
    },
    {
      group: 'Антибиотики',
      relatedCategories: ['otitis_media', 'pneumonia'],
      drugs: [
        { mnn: 'амоксициллин', note: '50 мг/кг/сут в 3 приёма' },
        { mnn: 'амоксициллин/клавуланат', note: '45 мг/кг/сут по амоксициллину' },
      ],
    },
    {
      group: 'Прочее',
      drugs: [
        { mnn: 'сальбутамол', note: 'ингаляции, 100 мкг/доза' },
        { mnn: 'цетиризин', note: 'Зиртек, 0.25 мг/кг' },
      ],
    },
    {
      group: 'Запрещено по возрасту',
      drugs: [
        { mnn: 'фторхинолоны', note: '< 18 лет' },
        { mnn: 'тетрациклины', note: '< 8 лет' },
        { mnn: 'кодеин', note: '< 12 лет' },
        { mnn: 'аспирин', note: '< 12 лет — синдром Рея' },
      ],
    },
  ],
  pulmonologist: [
    {
      group: 'КДБА / ДДБА',
      relatedCategories: ['asthma', 'copd'],
      drugs: [
        { mnn: 'сальбутамол', note: 'Вентолин' }, { mnn: 'фенотерол', note: 'Беротек' },
        { mnn: 'формотерол' }, { mnn: 'сальметерол' }, { mnn: 'индакатерол' }, { mnn: 'олодатерол' },
      ],
    },
    {
      group: 'М-холинолитики',
      relatedCategories: ['copd'],
      drugs: [{ mnn: 'ипратропий', note: 'Атровент' }, { mnn: 'тиотропий', note: 'Спирива' }, { mnn: 'умеклидиний' }, { mnn: 'гликопирроний' }],
    },
    {
      group: 'ИГКС',
      relatedCategories: ['asthma'],
      drugs: [{ mnn: 'будесонид', note: 'Пульмикорт' }, { mnn: 'флутиказон' }, { mnn: 'беклометазон' }, { mnn: 'мометазон' }, { mnn: 'циклесонид' }],
    },
    {
      group: 'Комбинации',
      relatedCategories: ['asthma', 'copd'],
      drugs: [
        { mnn: 'будесонид/формотерол', note: 'Симбикорт' },
        { mnn: 'флутиказон/салметерол', note: 'Серетид' },
        { mnn: 'вилантерол/флутиказон', note: 'Релвар' },
      ],
    },
    {
      group: 'Биологические',
      relatedCategories: ['asthma'],
      drugs: [{ mnn: 'омализумаб', note: 'Ксолар' }, { mnn: 'меполизумаб' }, { mnn: 'дупилумаб' }],
    },
  ],
  gynecologist: [
    {
      group: 'КОК',
      relatedCategories: ['menorrhagia'],
      drugs: [
        { mnn: 'дроспиренон + этинилэстрадиол', note: 'Джес, Ярина' },
        { mnn: 'дезогестрел + этинилэстрадиол', note: 'Регулон' },
        { mnn: 'левоноргестрел + этинилэстрадиол', note: 'Микрогинон' },
      ],
    },
    {
      group: 'Гестагены',
      relatedCategories: ['menorrhagia'],
      drugs: [{ mnn: 'дидрогестерон', note: 'Дюфастон' }, { mnn: 'микронизированный прогестерон', note: 'Утрожестан' }],
    },
    {
      group: 'ВМС / ЗГТ',
      relatedCategories: ['menopause'],
      drugs: [
        { mnn: 'левоноргестрел-ВМС', note: 'Мирена, Кайлина' },
        { mnn: 'эстрадиол + дидрогестерон', note: 'Фемостон, Анжелик' },
      ],
    },
    {
      group: 'Антибиотики при УГИ',
      relatedCategories: ['vaginitis', 'pid'],
      drugs: [{ mnn: 'азитромицин' }, { mnn: 'доксициклин' }, { mnn: 'цефтриаксон' }, { mnn: 'метронидазол' }],
    },
  ],
  gastroenterologist: [
    {
      group: 'ИПП / H2-блокаторы',
      relatedCategories: ['gerd', 'gastritis', 'peptic_ulcer'],
      drugs: [
        { mnn: 'омепразол' }, { mnn: 'эзомепразол', note: 'Нексиум' }, { mnn: 'пантопразол' },
        { mnn: 'рабепразол' }, { mnn: 'лансопразол' }, { mnn: 'фамотидин' },
      ],
    },
    {
      group: 'Прокинетики / спазмолитики',
      relatedCategories: ['gerd', 'ibs'],
      drugs: [
        { mnn: 'домперидон' }, { mnn: 'итоприд' }, { mnn: 'мебеверин', note: 'Дюспаталин' },
        { mnn: 'тримебутин', note: 'Тримедат' }, { mnn: 'гиосцина бутилбромид', note: 'Бускопан' },
      ],
    },
    {
      group: 'Ферменты / гепатопротекторы',
      drugs: [
        { mnn: 'панкреатин', note: 'Креон 10000/25000/40000 ед липазы' },
        { mnn: 'урсодезоксихолевая кислота', note: 'Урсосан, Урсофальк' },
      ],
    },
    {
      group: 'Эрадикация Hp',
      relatedCategories: ['gastritis', 'peptic_ulcer'],
      drugs: [{ mnn: 'омепразол + амоксициллин + кларитромицин', note: 'тройная схема, 14 дней' }, { mnn: '+ метронидазол + висмут', note: 'квадротерапия' }],
    },
  ],
  dermatologist: [
    {
      group: 'Топические ГКС (по силе)',
      relatedCategories: ['atopic_dermatitis', 'psoriasis'],
      drugs: [
        // Классы по Stoughton (США): I — самый сильный, VII — самый слабый.
        // Метки I и VII раньше стояли наоборот, и «клобетазол — класс VII,
        // самый сильный» противоречил сам себе. В европейской шкале (I-IV,
        // где IV сильнейший) номер читается в обратную сторону, поэтому
        // указываем силу словами: на неё врач и ориентируется у постели.
        { mnn: 'гидрокортизон', note: 'слабый (класс VII по Stoughton)' },
        { mnn: 'бетаметазон', note: 'сильный (класс III-IV)' },
        { mnn: 'мометазон', note: 'умеренно сильный' },
        { mnn: 'клобетазол', note: 'сверхсильный (класс I) — не на лицо и складки' },
      ],
    },
    {
      group: 'Ингибиторы кальциневрина',
      relatedCategories: ['atopic_dermatitis'],
      drugs: [{ mnn: 'такролимус', note: 'Протопик' }, { mnn: 'пимекролимус', note: 'Элидел' }],
    },
    {
      group: 'Ретиноиды / антимикотики',
      relatedCategories: ['acne', 'dermatophytosis'],
      drugs: [
        { mnn: 'изотретиноин', note: 'Роаккутан, Акнекутан' }, { mnn: 'адапален', note: 'Дифферин' }, { mnn: 'третиноин' },
        { mnn: 'тербинафин' }, { mnn: 'итраконазол' }, { mnn: 'флуконазол' },
        // Системный кетоконазол при дерматофитиях отозван регуляторами по
        // гепатотоксичности; местные формы остаются рутинной терапией.
        { mnn: 'кетоконазол', note: 'только местно — шампунь, крем; системно при дерматофитиях не применяется' },
      ],
    },
    {
      group: 'Биологики (псориаз/АтД)',
      relatedCategories: ['psoriasis', 'atopic_dermatitis'],
      drugs: [
        { mnn: 'адалимумаб' }, { mnn: 'секукинумаб' }, { mnn: 'иксекизумаб' },
        { mnn: 'гуселькумаб' }, { mnn: 'дупилумаб' }, { mnn: 'рисанкизумаб' },
      ],
    },
  ],
  ophthalmologist: [
    {
      group: 'Гипотензивные (глаукома)',
      relatedCategories: ['glaucoma'],
      drugs: [
        { mnn: 'тимолол' }, { mnn: 'бетаксолол' }, { mnn: 'латанопрост', note: 'Ксалатан' },
        { mnn: 'травопрост', note: 'Траватан' }, { mnn: 'биматопрост' }, { mnn: 'тафлупрост' },
        { mnn: 'бримонидин', note: 'Альфаган' }, { mnn: 'дорзоламид', note: 'Трусопт' }, { mnn: 'бринзоламид', note: 'Азопт' },
      ],
    },
    {
      group: 'Антибактериальные',
      relatedCategories: ['conjunctivitis', 'keratitis'],
      drugs: [{ mnn: 'тобрамицин' }, { mnn: 'моксифлоксацин' }, { mnn: 'ципрофлоксацин' }],
    },
    {
      group: 'Анти-VEGF',
      relatedCategories: ['amd'],
      drugs: [{ mnn: 'ранибизумаб', note: 'Луцентис' }, { mnn: 'афлиберцепт', note: 'Эйлеа' }, { mnn: 'бролуцизумаб' }],
    },
  ],
  otolaryngologist: [
    {
      group: 'Антибиотики',
      relatedCategories: ['tonsillopharyngitis', 'otitis_media', 'sinusitis'],
      drugs: [{ mnn: 'амоксициллин/клавуланат' }, { mnn: 'цефиксим' }, { mnn: 'азитромицин' }, { mnn: 'кларитромицин' }, { mnn: 'левофлоксацин' }],
    },
    {
      group: 'Топические ГКС в нос',
      relatedCategories: ['sinusitis', 'allergic_rhinitis'],
      drugs: [{ mnn: 'мометазон', note: 'Назонекс' }, { mnn: 'флутиказон', note: 'Авамис, Назарел' }, { mnn: 'будесонид', note: 'Тафен Назаль' }],
    },
    {
      group: 'Деконгестанты (макс 5-7 дней)',
      relatedCategories: ['sinusitis'],
      drugs: [{ mnn: 'ксилометазолин', note: 'Отривин, Снуп' }, { mnn: 'оксиметазолин', note: 'Називин' }],
    },
    {
      group: 'Антигистаминные',
      relatedCategories: ['allergic_rhinitis'],
      drugs: [{ mnn: 'цетиризин' }, { mnn: 'дезлоратадин' }, { mnn: 'левоцетиризин' }, { mnn: 'эбастин' }],
    },
  ],
  urologist: [
    {
      group: 'ДГПЖ',
      relatedCategories: ['bph'],
      drugs: [
        { mnn: 'тамсулозин', note: 'Омник' }, { mnn: 'силодозин', note: 'Урорек' }, { mnn: 'доксазозин' }, { mnn: 'альфузозин' },
        { mnn: 'финастерид' }, { mnn: 'дутастерид', note: 'Аводарт' },
        { mnn: 'тамсулозин + дутастерид', note: 'Дуодарт' },
      ],
    },
    {
      group: 'Гиперактивный мочевой пузырь',
      drugs: [{ mnn: 'солифенацин', note: 'Везикар' }, { mnn: 'толтеродин' }, { mnn: 'троспий' }, { mnn: 'мирабегрон', note: 'Бетмига' }],
    },
    {
      group: 'ЭД / ИМП',
      relatedCategories: ['ed', 'cystitis_uti'],
      drugs: [
        { mnn: 'силденафил' }, { mnn: 'тадалафил' }, { mnn: 'варденафил' },
        { mnn: 'фосфомицин', note: 'Монурал' }, { mnn: 'нитрофурантоин', note: 'Фурамаг' }, { mnn: 'цефиксим' },
      ],
    },
  ],
  orthopedist: [
    {
      group: 'НПВС',
      relatedCategories: ['low_back_pain', 'joint_oa', 'lateral_epicondylitis'],
      drugs: [
        { mnn: 'диклофенак' }, { mnn: 'ибупрофен' }, { mnn: 'кетопрофен' }, { mnn: 'нимесулид' },
        { mnn: 'мелоксикам', note: 'Мовалис' }, { mnn: 'целекоксиб', note: 'Целебрекс' }, { mnn: 'эторикоксиб', note: 'Аркоксиа' },
      ],
    },
    {
      group: 'Миорелаксанты / хондропротекторы',
      relatedCategories: ['low_back_pain', 'joint_oa'],
      drugs: [
        { mnn: 'толперизон', note: 'Мидокалм' }, { mnn: 'тизанидин', note: 'Сирдалуд' }, { mnn: 'баклофен' },
        { mnn: 'глюкозамин + хондроитин', note: 'Терафлекс, Дона' }, { mnn: 'диацереин' },
      ],
    },
    {
      group: 'Инъекции в сустав',
      relatedCategories: ['joint_oa', 'lateral_epicondylitis'],
      drugs: [
        { mnn: 'бетаметазон', note: 'Дипроспан' }, { mnn: 'триамцинолон' },
        { mnn: 'гиалуроновая кислота', note: 'Ферматрон, Синвиск, Остенил' },
      ],
    },
  ],
};

export function getPharmaReference(specialtyId: string): PharmaGroup[] {
  return PHARMA_REFERENCE[specialtyId] ?? [];
}
