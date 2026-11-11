import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { CustomWidgetConfig, CustomWidgetKind } from "../../config/workspace";
import { MAX_WIDGET_ITEMS, MAX_TITLE_LEN, MAX_ITEM_LABEL_LEN } from "../../config/workspace";

interface WorkspaceWidgetModalProps {
  initial?: CustomWidgetConfig;
  onSave: (config: CustomWidgetConfig) => void;
  onClose: () => void;
}

let nextItemId = 0;
function makeItemId() {
  return `item_${Date.now()}_${nextItemId++}`;
}

// Модалка создания/редактирования кастомного виджета врача — либо чек-лист
// (заголовок + список пунктов), либо заметка (заголовок; текст заполняется
// потом прямо на рабочем поле и не персистится — см. CustomWidgetBlock).
// Открывается из тулбара режима редактирования рабочего поля (WorkspaceToolbar).
export default function WorkspaceWidgetModal({ initial, onSave, onClose }: WorkspaceWidgetModalProps) {
  const [kind, setKind] = useState<CustomWidgetKind>(initial?.kind ?? 'checklist');
  const [title, setTitle] = useState(initial?.title ?? "");
  const [items, setItems] = useState<{ id: string; label: string }[]>(
    initial?.items && initial.items.length > 0 ? initial.items : [{ id: makeItemId(), label: "" }]
  );

  const canSave = kind === 'notes'
    ? title.trim().length > 0
    : title.trim().length > 0 && items.some(i => i.label.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    if (kind === 'notes') {
      onSave({ kind: 'notes', title: title.trim().slice(0, MAX_TITLE_LEN) });
      return;
    }
    onSave({
      kind: 'checklist',
      title: title.trim().slice(0, MAX_TITLE_LEN),
      items: items
        .map(i => ({ ...i, label: i.label.trim().slice(0, MAX_ITEM_LABEL_LEN) }))
        .filter(i => i.label.length > 0),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ds-200 flex items-center justify-between">
          <h3 className="bl-body font-semibold text-ds-900">
            {initial ? "Редактировать виджет" : "Новый виджет"}
          </h3>
          <button onClick={onClose} className="text-ds-600 hover:text-ds-900">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="bl-label font-semibold text-ds-600 uppercase tracking-wide mb-1.5 block">
              Тип виджета
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setKind('checklist')}
                className={`flex-1 px-3 py-2 bl-label font-semibold rounded-lg border transition-colors ${
                  kind === 'checklist'
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-white border-ds-200 text-ds-800 hover:bg-ds-100'
                }`}
              >
                Чек-лист
              </button>
              <button
                onClick={() => setKind('notes')}
                className={`flex-1 px-3 py-2 bl-label font-semibold rounded-lg border transition-colors ${
                  kind === 'notes'
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-white border-ds-200 text-ds-800 hover:bg-ds-100'
                }`}
              >
                Заметка
              </button>
            </div>
          </div>

          <div>
            <label className="bl-label font-semibold text-ds-600 uppercase tracking-wide mb-1.5 block">
              Название виджета
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LEN}
              placeholder={kind === 'notes' ? 'Например: Заметки по анамнезу' : 'Например: Мои напоминания'}
              className="w-full bg-white border border-ds-400 px-3 py-2 bl-body rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {kind === 'notes' ? (
            <p className="bl-label text-ds-600 leading-relaxed">
              Текст заметки вводится прямо на рабочем поле во время приёма и не
              сохраняется на сервере — обнуляется на следующем приёме, как и
              отметки чек-листов.
            </p>
          ) : (
            <div>
              <label className="bl-label font-semibold text-ds-600 uppercase tracking-wide mb-1.5 block">
                Пункты
              </label>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.label}
                      onChange={e => {
                        const val = e.target.value;
                        setItems(prev => prev.map((it, i) => (i === idx ? { ...it, label: val } : it)));
                      }}
                      maxLength={MAX_ITEM_LABEL_LEN}
                      placeholder={`Пункт ${idx + 1}`}
                      className="flex-1 bg-white border border-ds-400 px-3 py-2 bl-body rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                      disabled={items.length <= 1}
                      className="text-ds-600 hover:text-error-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setItems(prev => [...prev, { id: makeItemId(), label: "" }])}
                disabled={items.length >= MAX_WIDGET_ITEMS}
                className="mt-2 flex items-center gap-1.5 bl-label font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={13} /> Добавить пункт
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-ds-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 bl-label font-semibold rounded-lg bg-ds-100 border border-ds-200 text-ds-800 hover:bg-ds-200 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-3.5 py-2 bl-label font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
