import { Plus, RotateCcw, Save, X } from "lucide-react";
import { BLOCK_TITLES, MAX_CUSTOM_WIDGETS, type LayoutBlock } from "../../config/workspace";

interface WorkspaceToolbarProps {
  blocks: LayoutBlock[];
  onToggleVisibility: (id: string) => void;
  onAddWidget: () => void;
  onReset: () => void;
  onSave: () => void;
  onExit: () => void;
  saving: boolean;
}

function blockLabel(block: LayoutBlock): string {
  if (block.type === 'custom') return block.customConfig?.title || 'Виджет врача';
  return BLOCK_TITLES[block.type];
}

// Панель режима редактирования рабочего поля: видимость блоков, добавление
// кастомных виджетов, сохранение раскладки на сервер (Dashboard.tsx владеет
// состоянием layoutBlocks и решает, когда реально бить PUT /api/workspace-layout).
export default function WorkspaceToolbar({ blocks, onToggleVisibility, onAddWidget, onReset, onSave, onExit, saving }: WorkspaceToolbarProps) {
  const customCount = blocks.filter(b => b.type === 'custom').length;

  return (
    <div className="bg-white border border-ds-200 rounded-xl shadow-sm px-4 py-3 mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="bl-label font-semibold text-ds-600 uppercase tracking-wide">
        Настройка рабочего поля
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {blocks.map(block => (
          <label key={block.id} className="flex items-center gap-1.5 bl-label text-ds-800 cursor-pointer">
            <input
              type="checkbox"
              checked={block.visible}
              onChange={() => onToggleVisibility(block.id)}
              className="accent-primary-600"
            />
            {blockLabel(block)}
          </label>
        ))}
      </div>

      <button
        onClick={onAddWidget}
        disabled={customCount >= MAX_CUSTOM_WIDGETS}
        className="flex items-center gap-1.5 bl-label font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={13} /> Добавить виджет
      </button>

      <button
        onClick={() => { if (confirm('Вернуть стандартную раскладку блоков? Кастомные виджеты останутся.')) onReset(); }}
        className="flex items-center gap-1.5 bl-label font-semibold text-ds-600 hover:text-ds-800"
      >
        <RotateCcw size={13} /> Сбросить к стандарту
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1.5 bl-label font-semibold rounded-lg bg-ds-100 border border-ds-200 text-ds-800 hover:bg-ds-200 transition-colors"
        >
          <X size={13} /> Отмена
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bl-label font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Save size={13} /> {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
