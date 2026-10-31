// Настраиваемое рабочее поле приёма: реестр блоков + раскладка по умолчанию.
// DEFAULT_LAYOUT воспроизводит сегодняшние 4 колонки (Dashboard.tsx:2081),
// чтобы врач без сохранённой раскладки не заметил визуальной разницы.

export type BlockType =
  | 'insights' | 'pharma' | 'transcript' | 'checklist' | 'custom'
  | 'reference';

// Четыре справочных инструмента живут одним блоком с вкладками, а не четырьмя
// блоками. Они однотипны (поиск по перечню), одного размера, и главное —
// связаны по цепочке: код МКБ-10 фильтрует фарм-справочник, препарат оттуда
// подставляется в калькулятор доз. Четыре отдельных блока занимали половину
// поля, чтобы показать один и тот же путь.
export type ReferenceTab = 'icd10' | 'guidelines' | 'pharmaRef' | 'dosageCalc' | 'templates';

// Порядок клинический: код → документ, на основании которого лечим → препараты
// → доза → шаблон. «Клинреки» стоят сразу за МКБ-10, потому что код и есть ключ
// поиска по рубрикатору.
export const REFERENCE_TABS: ReferenceTab[] = ['icd10', 'guidelines', 'pharmaRef', 'dosageCalc', 'templates'];

// Короткие подписи — вкладок четыре, и они должны помещаться в блок шириной
// в четыре клетки. Полные названия остаются в title кнопки.
export const REFERENCE_TAB_LABELS: Record<ReferenceTab, string> = {
  icd10: 'МКБ-10', guidelines: 'Клинреки', pharmaRef: 'Препараты', dosageCalc: 'Расчёты', templates: 'Шаблоны',
};

export const REFERENCE_TAB_TITLES: Record<ReferenceTab, string> = {
  icd10: 'Справочник МКБ-10', guidelines: 'Клинические рекомендации Минздрава',
  pharmaRef: 'Фарм-справочник',
  dosageCalc: 'Клинические калькуляторы и дозы', templates: 'Шаблоны назначений',
};

// kind отсутствует = 'checklist' (обратная совместимость с уже сохранёнными
// виджетами, у которых этого поля никогда не было). items — только для
// checklist; text заметки НЕ хранится здесь — он живёт в локальном состоянии
// CustomWidgetBlock и не персистится (см. CustomWidgetBlock.tsx).
export type CustomWidgetKind = 'checklist' | 'notes';

export interface CustomWidgetConfig {
  kind?: CustomWidgetKind;
  title: string;
  items?: { id: string; label: string }[];
}

export interface LayoutBlock {
  id: string;
  type: BlockType;
  visible: boolean;
  layout: { x: number; y: number; w: number; h: number };
  customConfig?: CustomWidgetConfig;
  /** Вкладка справочного блока, открытая последней. Только для type: 'reference'. */
  referenceTab?: ReferenceTab;
}

// Сетка WorkspaceGrid: 12 колонок × 12 строк на весь доступный размер
// контейнера (см. GRID_ROWS/rowHeight в WorkspaceGrid.tsx).
export const GRID_COLS = 12;
export const GRID_ROWS = 12;

// ── Плотность блока ─────────────────────────────────────────────────────────
// Блок в 3×3 клетки и блок в 8×10 не должны быть набраны одинаково: в первом
// шапка и отступы съедают почти всё место, во втором тот же мелкий кегль
// выглядит потерянным. Ярус считается арифметически из размера в клетках —
// он уже известен раскладке. ResizeObserver на каждый блок здесь не нужен:
// это девять наблюдателей ради числа, которое и так есть.
export type BlockDensity = 'compact' | 'cozy' | 'roomy';

// Пороги выбраны так, чтобы ВСЕ блоки DEFAULT_LAYOUT попадали в 'cozy':
// 2×12, 6×12 и 4×6 — это сегодняшний вид, и он обязан остаться прежним у
// врача, который ничего не двигал. Другие ярусы включаются только после
// того, как врач сам изменил размер блока.
export function blockDensity(w: number, h: number): BlockDensity {
  // Низкий блок: шапка + отступы забирают долю высоты, которой уже жалко.
  if (h <= 4) return 'compact';
  // Узкий и невысокий одновременно — строке негде развернуться.
  if (w <= 3 && h <= 6) return 'compact';
  // Крупный по обеим осям. w >= 7 намеренно выше ширины стенограммы (6):
  // иначе главный блок дефолтной раскладки сменил бы вид сам собой.
  if (w >= 7 && h >= 9) return 'roomy';
  return 'cozy';
}

export const BLOCK_TITLES: Record<BlockType, string> = {
  insights: 'Клинические инсайты',
  pharma: 'Фарма-безопасность',
  transcript: 'Стенограмма приёма',
  checklist: 'Чек-лист',
  custom: 'Виджет врача',
  reference: 'Справочники',
};

export const DEFAULT_LAYOUT: LayoutBlock[] = [
  { id: 'insights', type: 'insights', visible: true, layout: { x: 0, y: 0, w: 2, h: GRID_ROWS } },
  { id: 'pharma', type: 'pharma', visible: true, layout: { x: 2, y: 0, w: 2, h: GRID_ROWS } },
  { id: 'transcript', type: 'transcript', visible: true, layout: { x: 4, y: 0, w: 6, h: GRID_ROWS } },
  { id: 'checklist', type: 'checklist', visible: true, layout: { x: 10, y: 0, w: 2, h: GRID_ROWS } },
  // Справочный блок скрыт по умолчанию (visible: false), чтобы экран не
  // менялся ни для новых, ни для существующих врачей. Включается вручную
  // чекбоксом в WorkspaceToolbar. Высота 7, а не 6: строку забирает полоса
  // вкладок.
  { id: 'reference', type: 'reference', visible: false, layout: { x: 0, y: 0, w: 4, h: 7 } },
  // Разбора общения здесь больше нет: он включается галочкой в настройках,
  // делается после приёма и читается в истории (см. CommunicationNotes.tsx).
];

// Идентификаторы блоков, которые были до объединения. Раскладки с ними лежат
// в базе у врачей, успевших включить эти блоки.
const LEGACY_REFERENCE_IDS: string[] = ['pharmaRef', 'icd10', 'dosageCalc', 'templates'];

/**
 * Схлопывает четыре прежних справочных блока в один блок с вкладками.
 *
 * Геометрию берём у самого крупного из ВИДИМЫХ прежних блоков, а его же
 * вкладку открываем первой: врач возвращается к тому, чем пользовался. Если
 * видимых не было — блок остаётся скрытым, как и был.
 *
 * Клетки от остальных прежних блоков просто освобождаются. Двигать соседей
 * сюда нельзя: раскладку врач составлял сам, и самовольный переезд блоков
 * хуже пустого места, которое он заполнит одним движением.
 */
export function migrateLayout(stored: LayoutBlock[]): LayoutBlock[] {
  // Блок «Разбор общения» переехал из рабочего поля в историю приёмов. Его
  // клетка у тех, кто успел его включить, просто освобождается.
  const saved = stored.filter(b => (b.type as string) !== 'communication');
  const legacy = saved.filter(b => LEGACY_REFERENCE_IDS.includes(b.id));
  if (legacy.length === 0) return saved;

  const visible = legacy.filter(b => b.visible);
  const anchor = [...visible].sort((a, b) => b.layout.w * b.layout.h - a.layout.w * a.layout.h)[0];

  const reference: LayoutBlock = {
    id: 'reference',
    type: 'reference',
    visible: visible.length > 0,
    layout: anchor ? { ...anchor.layout } : { x: 0, y: 0, w: 4, h: 7 },
    referenceTab: anchor ? (anchor.id as ReferenceTab) : undefined,
  };

  return [...saved.filter(b => !LEGACY_REFERENCE_IDS.includes(b.id)), reference];
}

// Для врачей, у кого раскладка уже сохранена в базе ДО появления новых
// блоков (pharmaRef/icd10/dosageCalc/templates) — добьёт недостающие id из
// DEFAULT_LAYOUT (скрытыми), иначе новые блоки никогда не появятся в чекбоксах
// WorkspaceToolbar для таких врачей. Вызывается сразу после fetchWorkspaceLayout.
export function mergeWithDefaults(saved: LayoutBlock[]): LayoutBlock[] {
  const missing = DEFAULT_LAYOUT.filter(d => !saved.some(b => b.id === d.id));
  return [...saved, ...missing];
}

export interface Rect { x: number; y: number; w: number; h: number }

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Помещается ли прямоугольник в поле целиком. Поле не скроллится, поэтому
// всё, что вылезло за GRID_COLS/GRID_ROWS, будет обрезано контейнером и для
// врача просто исчезнет — такие раскладки не принимаем.
function fitsInGrid(r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= GRID_COLS && r.y + r.h <= GRID_ROWS;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function withLayouts(blocks: LayoutBlock[], patch: Record<string, Rect>): LayoutBlock[] {
  return blocks.map(b => (patch[b.id] ? { ...b, layout: { ...patch[b.id] } } : b));
}

/**
 * Первая свободная (x, y) для блока размера w×h, не пересекающая ни один
 * видимый блок из `others`. Нужна везде, где блок появляется в раскладке не
 * через drag (у которого коллизии уже решает react-grid-layout), а
 * программно — включение видимости чекбоксом, сброс к стандарту: без этого
 * блок просто накладывается на уже видимый и визуально исчезает под ним.
 *
 * Поиск ограничен GRID_ROWS — рабочее поле не скроллится и не растёт вниз
 * бесконечно, весь набор видимых блоков должен помещаться в экран. Если
 * места нет — возвращает null, вызывающий код должен отказать в показе
 * блока/добавлении виджета, а не расширять сетку.
 */
export function findFreePosition(w: number, h: number, others: LayoutBlock[]): { x: number; y: number } | null {
  const occupied = others.filter(o => o.visible);
  for (let y = 0; y <= GRID_ROWS - h; y++) {
    for (let x = 0; x <= GRID_COLS - w; x++) {
      const collides = occupied.some(o => rectsOverlap({ x, y, w, h }, o.layout));
      if (!collides) return { x, y };
    }
  }
  return null;
}

/**
 * Место под блок w×h, а если целиком он не помещается — под уменьшенную его
 * версию, которая помещается. Нужно при ВКЛЮЧЕНИИ блока (чекбокс в тулбаре,
 * добавление виджета, сброс раскладки): поле не скроллится, и раньше врач в
 * ответ на галочку получал «нет свободного места» вместо блока — хотя место
 * было, просто меньше стандартного размера этого блока.
 *
 * Блок только УМЕНЬШАЕТСЯ (cw <= w, ch <= h) и никогда не растёт: врач просил
 * вписать модуль в пустоту, а не растянуть его на весь экран. Из подходящих
 * размеров берём самый большой по площади, при равной площади — ближайший по
 * пропорциям к исходному, чтобы блок не превращался в узкую полоску, когда
 * рядом лежит такой же по площади нормальный прямоугольник.
 *
 * null — места нет даже под MIN_BLOCK_W×MIN_BLOCK_H, вот тогда действительно
 * надо отказать врачу и попросить освободить место.
 */
export function findFreePlacement(w: number, h: number, others: LayoutBlock[]): Rect | null {
  const exact = findFreePosition(w, h, others);
  if (exact) return { ...exact, w, h };

  const ratio = w / h;
  let best: Rect | null = null;
  let bestArea = 0;
  let bestDistortion = Infinity;

  // Раскладка приходит с сервера и размеры не валидируются ни там, ни здесь.
  // Блок с w или h меньше минимума не давал циклам ни одной итерации, и
  // findFreePlacement отвечала «места нет» даже на пустом поле — то есть такой
  // блок навсегда переставал включаться чекбоксом. Поднимаем до минимума.
  const startW = Math.max(MIN_BLOCK_W, Math.min(w, GRID_COLS));
  const startH = Math.max(MIN_BLOCK_H, Math.min(h, GRID_ROWS));

  for (let cw = startW; cw >= MIN_BLOCK_W; cw--) {
    for (let ch = startH; ch >= MIN_BLOCK_H; ch--) {
      const area = cw * ch;
      const distortion = Math.abs(cw / ch - ratio);
      // Заведомо не лучше уже найденного — не тратим перебор позиций.
      if (area < bestArea || (area === bestArea && distortion >= bestDistortion)) continue;
      const pos = findFreePosition(cw, ch, others);
      if (!pos) continue;
      best = { ...pos, w: cw, h: ch };
      bestArea = area;
      bestDistortion = distortion;
    }
  }
  return best;
}

/**
 * Раскладка после того, как блок `draggedId` отпустили в клетке (x, y).
 *
 * Своя реализация вместо штатного разрешения коллизий в react-grid-layout, и
 * вот почему. Рабочее поле не скроллится: ровно GRID_ROWS строк, контейнер с
 * overflow: hidden, а блоки по умолчанию высотой во весь экран (h = GRID_ROWS).
 * Штатное «расталкивание» сдвигает соседа ВНИЗ — при полной высоте ему некуда
 * ехать, кроме как за нижнюю границу, где его обрезает контейнер. Со стороны
 * это выглядит как исчезновение блока.
 *
 * Поэтому вместо расталкивания — обмен местами: сосед занимает клетку, которую
 * перетаскиваемый блок только что освободил. Для поля из колонок во всю высоту
 * это ровно то, чего ждёшь, когда тащишь один блок на место другого.
 *
 * Возвращает null, если разложить без наложений и выходов за поле нельзя —
 * тогда вызывающий код обязан откатить перетаскивание. Показать кашу или
 * потерять блок хуже, чем не двигать ничего.
 */
export function resolveBlockDrop(
  blocks: LayoutBlock[],
  draggedId: string,
  x: number,
  y: number
): LayoutBlock[] | null {
  const dragged = blocks.find(b => b.id === draggedId);
  if (!dragged) return null;

  const origin = dragged.layout;
  const target: Rect = {
    w: origin.w,
    h: origin.h,
    x: clamp(x, 0, Math.max(0, GRID_COLS - origin.w)),
    y: clamp(y, 0, Math.max(0, GRID_ROWS - origin.h)),
  };

  const others = blocks.filter(b => b.visible && b.id !== dragged.id);
  const displaced = others.filter(o => rectsOverlap(target, o.layout));

  if (displaced.length === 0) return withLayouts(blocks, { [dragged.id]: target });

  // Меняемся местами только с одним соседом. Если блок накрыл сразу нескольких,
  // однозначного «места, куда их всех девать» нет — честнее откатить, чем
  // раскидать чужие блоки по полю на своё усмотрение.
  if (displaced.length > 1) return null;

  const other = displaced[0];
  const rest = others.filter(o => o.id !== other.id);
  // Сосед встаёт туда, откуда блок ушёл, сохраняя свои размеры: менять чужую
  // высоту и ширину врач не просил.
  const swapped: Rect = { w: other.layout.w, h: other.layout.h, x: origin.x, y: origin.y };

  const free =
    fitsInGrid(swapped) &&
    !rectsOverlap(swapped, target) &&
    rest.every(r => !rectsOverlap(swapped, r.layout))
      ? swapped
      : null;

  // Прямой обмен не сошёлся (блоки разного размера) — ищем соседу любое
  // свободное место, лишь бы он остался на виду.
  const spot =
    free ??
    (() => {
      const pos = findFreePosition(other.layout.w, other.layout.h, [
        ...rest,
        { ...dragged, layout: target },
      ]);
      return pos ? { ...pos, w: other.layout.w, h: other.layout.h } : null;
    })();

  if (!spot) return null;
  return withLayouts(blocks, { [dragged.id]: target, [other.id]: spot });
}

/**
 * Раскладка после растягивания блока до w×h. Размер подрезается по границам
 * поля (вниз и вправо расти некуда — поле в размер экрана), а если новый
 * размер накрыл соседа, изменение отклоняется: возвращается null.
 *
 * Уменьшение блока не может ни с кем столкнуться, поэтому проходит всегда —
 * а это основной сценарий, ради которого ручки и нужны.
 */
export function resolveBlockResize(
  blocks: LayoutBlock[],
  id: string,
  w: number,
  h: number
): LayoutBlock[] | null {
  const block = blocks.find(b => b.id === id);
  if (!block) return null;

  const { x, y } = block.layout;
  const next: Rect = {
    x, y,
    w: clamp(w, MIN_BLOCK_W, GRID_COLS - x),
    h: clamp(h, MIN_BLOCK_H, GRID_ROWS - y),
  };
  if (!fitsInGrid(next)) return null;

  const others = blocks.filter(b => b.visible && b.id !== id);
  if (others.some(o => rectsOverlap(next, o.layout))) return null;

  return withLayouts(blocks, { [id]: next });
}

// Меньше этого блок перестаёт быть читаемым: заголовок и пара строк содержимого
// уже не помещаются, остаётся пустой прямоугольник.
export const MIN_BLOCK_W = 2;
export const MIN_BLOCK_H = 2;

export const MAX_CUSTOM_WIDGETS = 8;
export const MAX_WIDGET_ITEMS = 20;
export const MAX_TITLE_LEN = 60;
export const MAX_ITEM_LABEL_LEN = 120;
export const MAX_NOTE_LEN = 4000;
