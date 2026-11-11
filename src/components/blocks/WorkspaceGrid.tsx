import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import RGL, { WidthProvider, type Layout, type LayoutItem } from "react-grid-layout/legacy";
import { GripVertical, X } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  GRID_COLS, GRID_ROWS, MIN_BLOCK_W, MIN_BLOCK_H,
  resolveBlockDrop, resolveBlockResize, blockDensity, type LayoutBlock,
} from "../../config/workspace";
import { BlockDensityContext } from "./blockDensity";

const GridLayout = WidthProvider(RGL);

// Зазор между блоками по обеим осям. Вынесен в константу, потому что от него
// зависит расчёт rowHeight — см. useEffect ниже.
const MARGIN_X = 12;
const MARGIN_Y = 12;

interface WorkspaceGridProps {
  blocks: LayoutBlock[];
  editMode: boolean;
  onLayoutChange: (blocks: LayoutBlock[]) => void;
  onDeleteBlock: (id: string) => void;
  renderContent: (block: LayoutBlock) => ReactNode;
}

// Обёртка над react-grid-layout: рабочее поле приёма как реестр
// перетаскиваемых/растягиваемых блоков. Drag/resize включены только в
// editMode — во время приёма сетка статична, чтобы врач не сдвинул блок
// случайно. Drag-хендл — отдельная полоска сверху карточки (не сам заголовок
// блока), поэтому блок-компоненты остаются агностичными к тому, что их
// рендерит грид, а не мобильные табы.
export default function WorkspaceGrid({ blocks, editMode, onLayoutChange, onDeleteBlock, renderContent }: WorkspaceGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(40);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Высота, которую занимает сетка = GRID_ROWS строк + отступ между каждой
    // парой строк + отступы сверху и снизу (containerPadding по умолчанию
    // равен margin), то есть GRID_ROWS + 1 промежутков. Делить clientHeight
    // на одно только число строк нельзя: блок во всю высоту вылезает за
    // контейнер на все эти промежутки, а overflow: hidden срезает ему низ —
    // вместе с нижней границей и ручкой растягивания.
    const update = () => {
      const gaps = MARGIN_Y * (GRID_ROWS + 1);
      setRowHeight(Math.max(24, (el.clientHeight - gaps) / GRID_ROWS));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleBlocks = useMemo(() => blocks.filter(b => b.visible), [blocks]);
  const rglLayout: Layout = useMemo(
    () => visibleBlocks.map(b => ({
      i: b.id, x: b.layout.x, y: b.layout.y, w: b.layout.w, h: b.layout.h,
      minW: MIN_BLOCK_W, minH: MIN_BLOCK_H,
    })),
    [visibleBlocks]
  );

  // Если раскладку отклонили, react-grid-layout уже успел записать её себе во
  // внутренний state, а props.layout при этом не изменился — библиотека
  // синхронизируется только на deep-diff пропса, поэтому сама назад не
  // откатится. Меняем key и монтируем сетку заново из props: грубо, но
  // случается только на заведомо невозможном перетаскивании.
  const [revertKey, setRevertKey] = useState(0);
  const revert = () => setRevertKey(k => k + 1);

  const handleDragStop = (_next: Layout, _old: LayoutItem, item: LayoutItem) => {
    const resolved = resolveBlockDrop(blocks, item.i, item.x, item.y);
    if (resolved) onLayoutChange(resolved); else revert();
  };

  const handleResizeStop = (_next: Layout, _old: LayoutItem, item: LayoutItem) => {
    const resolved = resolveBlockResize(blocks, item.i, item.w, item.h);
    if (resolved) onLayoutChange(resolved); else revert();
  };

  return (
    <div ref={containerRef} className="h-full min-h-0 overflow-hidden">
      <GridLayout
        key={revertKey}
        className="layout workspace-grid"
        layout={rglLayout}
        cols={GRID_COLS}
        maxRows={GRID_ROWS}
        rowHeight={rowHeight}
        margin={[MARGIN_X, MARGIN_Y]}
        isDraggable={editMode}
        isResizable={editMode}
        isBounded={true}
        draggableHandle=".workspace-drag-handle"
        // Ручки по нижней и правой границе, а не только уголок: уменьшить блок
        // по высоте иначе нечем — а это то, зачем в режим правки и заходят.
        resizeHandles={['s', 'e', 'se']}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        compactType={null}
        // Коллизии разруливаем сами в handleDragStop (обмен местами вместо
        // расталкивания вниз — см. resolveBlockDrop). Библиотеке во время
        // перетаскивания велим не трогать соседей вовсе: иначе они прыгают
        // под курсором и уезжают за нижний край поля.
        allowOverlap={true}
      >
        {visibleBlocks.map(block => (
          <div key={block.id} className="relative">
            {editMode && (
              <div className="workspace-drag-handle absolute top-0 left-0 right-0 h-6 z-20 flex items-center justify-center cursor-grab active:cursor-grabbing bg-black/5 hover:bg-black/10 rounded-t-xl transition-colors">
                <GripVertical size={14} className="text-ds-600" />
                <button
                  type="button"
                  title="Убрать блок с поля"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onDeleteBlock(block.id); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ds-600 hover:text-error-600 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <div className={`h-full ${editMode ? 'pt-6' : ''}`}>
              {/* Ярус плотности считается здесь: размер блока в клетках знает
                  только раскладка, а нужен он оболочке блока. */}
              <BlockDensityContext.Provider value={blockDensity(block.layout.w, block.layout.h)}>
                {renderContent(block)}
              </BlockDensityContext.Provider>
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
