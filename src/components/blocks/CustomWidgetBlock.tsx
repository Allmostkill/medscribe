import { useState } from "react";
import { ClipboardList, StickyNote, Trash2 } from "lucide-react";
import BlockShell from "./BlockShell";
import { MAX_NOTE_LEN, type CustomWidgetKind } from "../../config/workspace";

interface CustomWidgetBlockProps {
  title: string;
  kind?: CustomWidgetKind;
  items: { id: string; label: string }[];
  editMode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Врач сам заводит виджет (заголовок + пункты, либо заголовок + свободный
// текст) в режиме редактирования рабочего поля — определение виджета хранится
// в раскладке (в базе). Содержимое конкретного приёма — отметки чек-боксов
// ИЛИ текст заметки — состояние конкретного приёма, НЕ персистится: родитель
// сбрасывает его между приёмами через key={`${block.id}-${sessionId}`} на
// этом компоненте.
export default function CustomWidgetBlock({ title, kind = 'checklist', items, editMode, onEdit, onDelete }: CustomWidgetBlockProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [noteText, setNoteText] = useState("");

  const Icon = kind === 'notes' ? StickyNote : ClipboardList;

  return (
    <BlockShell
      icon={Icon}
      title={title}
      actions={editMode && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onEdit} className="bl-label font-semibold text-primary-600 hover:text-primary-700">
            Изменить
          </button>
          <button onClick={onDelete} className="text-ds-600 hover:text-error-600 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    >
      {kind === 'notes' ? (
        <div className="p-[var(--bl-pad)] flex-1 bg-ds-50 flex flex-col min-h-0">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value.slice(0, MAX_NOTE_LEN))}
            maxLength={MAX_NOTE_LEN}
            placeholder="Заметки на время этого приёма — не сохраняются на сервере."
            className="flex-1 w-full resize-none bg-white border border-ds-400 rounded-lg p-2.5 bl-label leading-snug text-ds-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      ) : (
        <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack-sm)] overflow-y-auto flex-1 bg-ds-50">
          {items.length === 0 ? (
            <p className="text-center bl-label text-ds-600 mt-6">Пункты не добавлены</p>
          ) : (
            items.map(item => (
              <label
                key={item.id}
                className="flex items-start gap-2 px-2 py-2 rounded cursor-pointer bg-white border border-ds-150 hover:border-primary-200 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!!checked[item.id]}
                  onChange={() => setChecked(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="mt-0.5 flex-shrink-0 accent-primary-600"
                />
                <span className={`bl-label leading-snug ${checked[item.id] ? 'text-ds-600 line-through' : 'text-ds-900'}`}>
                  {item.label}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </BlockShell>
  );
}
