// Сверка чисел памятки пациенту с утверждённым протоколом.
//
// Зачем. Памятка — единственный текст в продукте, который читает не врач, а
// пациент, и исполняет буквально. Самый тяжёлый отказ модели здесь — не
// «коряво написано», а подменённая дозировка: в протоколе «эналаприл 5-10 мг»,
// в памятке «принимайте 10 мг». Врач такое пропускает глазами легко, потому
// что текст выглядит правдоподобно.
//
// Проверка намеренно тупая и детерминированная: каждое число, стоящее рядом с
// единицей измерения или кратностью, обязано встречаться в исходном тексте
// протокола — В ТОЙ ЖЕ РАЗМЕРНОСТИ. Это не проверка смысла, а проверка того,
// что модель не придумала новое число.
//
// Числа БЕЗ единиц (даты визита, номер кабинета, возраст) сознательно
// пропускаем: они законно появляются в памятке, которой нет в протоколе, и
// ложные срабатывания быстро приучают врача жать «всё равно печатать».

/**
 * Класс размерности. Сравнение идёт по паре «значение + класс», а не по одному
 * значению: раньше учитывалось только число, и доза «10 мг», которой в
 * протоколе не было, считалась подтверждённой, если где-то в протоколе стояло
 * «курс 10 дней». Протокол склеивается из всех полей, включая жалобы и осмотр
 * («температура 38», «болит 3 дня»), так что прикрыть чужую дозу посторонним
 * числом было легко — и это ровно тот отказ, ради которого модуль написан.
 */
type UnitClass = 'mass' | 'perkg' | 'volume' | 'iu' | 'freq' | 'count' | 'duration' | 'other';

interface UnitDef {
  /** Фрагмент регулярки для единицы. */
  re: string;
  cls: UnitClass;
  /** Множитель к канонической единице класса (мг для mass, дни для duration). */
  k?: number;
}

// Порядок важен: длинные варианты идут первыми, иначе «мг» съест начало
// «мг/кг», а «ме» — начало «месяца».
const UNITS: UnitDef[] = [
  { re: 'мг/кг/сут', cls: 'perkg' }, { re: 'мкг/кг', cls: 'perkg' },
  { re: 'мг/кг', cls: 'perkg' }, { re: 'ед/кг', cls: 'perkg' },

  { re: 'мкг', cls: 'mass', k: 0.001 }, { re: 'мг', cls: 'mass', k: 1 },
  { re: 'г/сут', cls: 'mass', k: 1000 },
  // Одиночная «г» требует границы: иначе «2 года» читалось бы как 2 грамма.
  { re: 'г(?![а-яё])', cls: 'mass', k: 1000 },

  { re: 'мл', cls: 'volume' },

  { re: 'р/сут', cls: 'freq' }, { re: 'р/д', cls: 'freq' }, { re: 'раз/сут', cls: 'freq' },
  { re: 'раза в день', cls: 'freq' }, { re: 'раз в день', cls: 'freq' },
  { re: 'раза в сутки', cls: 'freq' }, { re: 'раз в сутки', cls: 'freq' },

  { re: 'таблетк', cls: 'count' }, { re: 'таб', cls: 'count' },
  { re: 'капсул', cls: 'count' }, { re: 'капл', cls: 'count' }, { re: 'доз', cls: 'count' },

  { re: 'месяцев', cls: 'duration', k: 30 }, { re: 'месяца', cls: 'duration', k: 30 },
  { re: 'месяц', cls: 'duration', k: 30 }, { re: 'мес', cls: 'duration', k: 30 },
  { re: 'недель', cls: 'duration', k: 7 }, { re: 'недели', cls: 'duration', k: 7 },
  { re: 'неделю', cls: 'duration', k: 7 }, { re: 'нед', cls: 'duration', k: 7 },
  { re: 'дней', cls: 'duration', k: 1 }, { re: 'дня', cls: 'duration', k: 1 },
  { re: 'день', cls: 'duration', k: 1 }, { re: 'суток', cls: 'duration', k: 1 },
  { re: 'сутки', cls: 'duration', k: 1 },
  { re: 'часов', cls: 'duration', k: 1 / 24 }, { re: 'часа', cls: 'duration', k: 1 / 24 },
  { re: 'час', cls: 'duration', k: 1 / 24 },
  { re: 'минут', cls: 'duration', k: 1 / 1440 }, { re: 'мин', cls: 'duration', k: 1 / 1440 },

  // Международные единицы — только с границей, иначе «ме» съело бы «месяц».
  { re: 'ме(?![а-яё])', cls: 'iu' }, { re: 'ед', cls: 'iu' },

  { re: '%', cls: 'other' }, { re: '°c', cls: 'other' },
];

const UNIT_ALTERNATION = UNITS.map(u => u.re).join('|');

// Число (целое или дробное, запятая и точка равноправны), затем необязательный
// пробел, затем единица. Диапазоны «5-10 мг» разбираются на 5 и 10 — единица
// относится к обоим.
//
// Первая группа — символ перед числом. Она отсекает число, являющееся хвостом
// другого: «1/2 таблетки» больше не читается как «2 таблетки», а «0,5 мг» не
// даёт лишней записи «5». Это могла бы сделать ретроспективная проверка
// (?<!...), но она падает на Safari до 16.4 прямо при разборе модуля — то есть
// белым экраном на всём приложении, а не деградацией одной проверки.
const MEASURED_NUMBER = new RegExp(
  `(^|[^\\d.,/])(\\d+(?:[.,]\\d+)?)(?:\\s*[-–—]\\s*(\\d+(?:[.,]\\d+)?))?\\s*(${UNIT_ALTERNATION})`,
  'gi'
);

export interface MeasuredValue {
  /** Число в нормализованном виде: точка как разделитель, без хвостовых нулей. */
  value: string;
  /** Единица, как она написана в тексте. */
  unit: string;
  /** Класс размерности — по нему идёт сравнение. */
  cls: UnitClass;
  /** Значение, приведённое к канонической единице класса. */
  canonical: string;
  /** Кусок исходного текста — чтобы показать врачу, где именно. */
  raw: string;
}

const normalize = (n: string): string => String(parseFloat(n.replace(',', '.')));

/** Определение единицы по тексту совпадения — первое подходящее по порядку. */
function classify(unitText: string): UnitDef {
  const u = unitText.toLowerCase();
  for (const def of UNITS) {
    const bare = def.re.replace(/\(\?![^)]*\)/g, '');
    if (u.startsWith(bare)) return def;
  }
  return { re: u, cls: 'other' };
}

/**
 * Каноническое значение: мг для массы, дни для длительности. Нужно, чтобы
 * «через 2 недели» в памятке совпало с «контроль через 14 дней» в протоколе —
 * это законный пересчёт врача, а не выдуманное число.
 */
function canonicalize(value: string, def: UnitDef): string {
  const n = parseFloat(value);
  if (!def.k || !isFinite(n)) return value;
  return String(Number((n * def.k).toPrecision(10)));
}

/** Все числа с единицами измерения, встречающиеся в тексте. */
export function extractMeasuredValues(text: string): MeasuredValue[] {
  if (!text) return [];
  const out: MeasuredValue[] = [];
  for (const m of text.matchAll(MEASURED_NUMBER)) {
    const [whole, prefix, from, to, unit] = m;
    const raw = whole.slice(prefix.length).trim();
    const def = classify(unit);
    const push = (num: string) => {
      const value = normalize(num);
      out.push({ value, unit: unit.toLowerCase(), cls: def.cls, canonical: canonicalize(value, def), raw });
    };
    push(from);
    if (to) push(to);
  }
  return out;
}

export interface DoseMismatch {
  value: string;
  unit: string;
  raw: string;
}

/**
 * Числа из `summary`, которых нет в `protocol`.
 *
 * Ключ сравнения — «каноническое значение + класс размерности». Кратность
 * при этом не страдает: врач законно переписывает «2 р/сут» как «2 раза в
 * день» — единица другая, класс тот же, значение то же.
 *
 * Пустой массив — расхождений нет. Это НЕ означает, что памятка верна: она
 * может быть неточной по смыслу. Проверка отвечает ровно на один вопрос —
 * не появилось ли в памятке числа, которого врач не утверждал.
 */
export function findDoseMismatches(summary: string, protocol: string): DoseMismatch[] {
  const key = (v: MeasuredValue) => `${v.cls}|${v.canonical}`;
  const inProtocol = new Set(extractMeasuredValues(protocol).map(key));
  const seen = new Set<string>();
  const out: DoseMismatch[] = [];

  for (const v of extractMeasuredValues(summary)) {
    if (inProtocol.has(key(v))) continue;
    const k = `${v.value}|${v.unit}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ value: v.value, unit: v.unit, raw: v.raw });
  }
  return out;
}
