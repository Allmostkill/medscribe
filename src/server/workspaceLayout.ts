import { MAX_CUSTOM_WIDGETS, MAX_WIDGET_ITEMS, MAX_TITLE_LEN, MAX_ITEM_LABEL_LEN } from '../config/workspace';

// 'reference' — блок справочников с вкладками, в который слили прежние
// четыре. Его тут не было, из-за чего КАЖДАЯ раскладка отвергалась с 400:
// блок справочников есть в DEFAULT_LAYOUT, то есть у всех. Клиент ответ
// не проверял, и врач видел «Сохранение…», после которого ничего не
// сохранялось.
//
// Прежние четыре типа оставлены намеренно: клиент переводит на 'reference'
// старые сохранённые раскладки при чтении (migrateLayout), но вкладка,
// открытая со старым закэшированным бандлом, ещё может прислать их. По
// той же причине остался 'communication': блок переехал в историю.
export const ALLOWED_BLOCK_TYPES: readonly string[] = ['insights', 'pharma', 'transcript', 'checklist', 'custom',
  'reference', 'communication',
  'pharmaRef', 'icd10', 'dosageCalc', 'templates'];
// Открытая вкладка справочников — часть раскладки; пришла бы сюда любая
// строка, а фронт кладёт её в состояние без проверки.
export const ALLOWED_REFERENCE_TABS: readonly string[] = ['icd10', 'guidelines', 'pharmaRef', 'dosageCalc', 'templates'];

// ── Workspace layout (настраиваемое рабочее поле приёма) ───────────────────
// Одна строка JSON на врача: позиции/размеры/видимость блоков + определения
// кастомных чек-бокс виджетов. Отметки чек-боксов сюда не попадают — это
// состояние конкретного приёма, живёт только в браузере (см. CustomWidgetBlock).
export function isValidWorkspaceLayout(layout: any): boolean {
  if (!Array.isArray(layout) || layout.length > 20) return false;
  let customCount = 0;
  for (const block of layout) {
    if (!block || typeof block !== 'object') return false;
    if (typeof block.id !== 'string' || block.id.length === 0 || block.id.length > 100) return false;
    if (!ALLOWED_BLOCK_TYPES.includes(block.type)) return false;
    if (block.referenceTab !== undefined &&
        !ALLOWED_REFERENCE_TABS.includes(block.referenceTab)) return false;
    if (typeof block.visible !== 'boolean') return false;
    const l = block.layout;
    if (!l || typeof l !== 'object') return false;
    for (const k of ['x', 'y', 'w', 'h']) {
      if (typeof l[k] !== 'number' || !Number.isFinite(l[k]) || l[k] < 0 || l[k] > 200) return false;
    }
    if (block.type === 'custom') {
      customCount++;
      if (customCount > MAX_CUSTOM_WIDGETS) return false;
      const cfg = block.customConfig;
      if (!cfg || typeof cfg.title !== 'string' || cfg.title.length === 0 || cfg.title.length > MAX_TITLE_LEN) return false;
      if (cfg.kind !== undefined && cfg.kind !== 'checklist' && cfg.kind !== 'notes') return false;
      if (cfg.kind !== 'notes') {
        if (!Array.isArray(cfg.items) || cfg.items.length > MAX_WIDGET_ITEMS) return false;
        for (const item of cfg.items) {
          if (!item || typeof item.id !== 'string' || typeof item.label !== 'string' || item.label.length > MAX_ITEM_LABEL_LEN) return false;
        }
      }
    }
  }
  return true;
}
