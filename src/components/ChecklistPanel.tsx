import { CheckCircle, Activity } from "lucide-react";
import type { TranscriptLine } from "../types";
import { getSpecialtyChecklists, SPECIALTY_UI } from "../config/checklists";

// Renders the standard-of-care checklist for the active consultation type.
// Items auto-check when their regex matches anywhere in the transcript. This is
// a quick visual nudge — the LLM final-pass in /api/ai/analyze does the
// authoritative check when the protocol is generated.
export function ChecklistPanel({
  transcript,
  type,
  specialtyId,
}: {
  transcript: TranscriptLine[];
  type: 'primary' | 'follow-up';
  specialtyId?: string;
}) {
  // Specialty-specific checklist (psychiatry, cardio, endocrine, etc.) Falls
  // back to the general Минздрав template for unknown specialties.
  const lists = getSpecialtyChecklists(specialtyId);
  const list = type === 'primary' ? lists.primary : lists.followUp;
  const ui = specialtyId ? SPECIALTY_UI[specialtyId] : undefined;
  const isSpecialized = !!ui;
  const fullText = transcript.map(t => t.text).join(' ');

  const items = list.map(item => ({ ...item, done: item.keywords.test(fullText) }));
  const doneCount = items.filter(i => i.done).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with progress — sticky */}
      <div className="px-4 py-3 bg-ds-100 border-b border-ds-200 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 bl-label text-ds-600 font-semibold uppercase tracking-wide">
            <CheckCircle size={12} className={ui ? ui.text : 'text-success-600'} />
            {isSpecialized
              ? `${ui!.label} · ${type === 'primary' ? 'первичный' : 'повторный'}`
              : (type === 'primary' ? 'Чек-лист' : 'Повторный')}
          </div>
          <span className="bl-label font-mono font-semibold text-ds-900">{doneCount}/{total}</span>
        </div>
        <div className="h-1.5 bg-ds-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              pct === 100 ? 'bg-success-500'
                : pct >= 50 ? (ui ? ui.bar : 'bg-primary-500')
                : 'bg-warning-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="bl-caption text-ds-600 mt-1.5">
          {isSpecialized
            ? `AI настроен на ${ui!.label.toLowerCase()}`
            : (type === 'primary' ? 'По стандарту Минздрава РФ' : 'Динамика и корректировка')}
        </div>
      </div>

      {/* Items — scrollable */}
      <div className="px-3 py-2 space-y-1 overflow-y-auto flex-1 bg-ds-50">
        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-start gap-2 px-2 py-2 rounded transition-colors ${
              item.done ? 'bg-success-50/60' : 'bg-white border border-ds-150'
            }`}
          >
            <div className={`mt-0.5 flex-shrink-0 ${item.done ? 'text-success-600' : 'text-ds-400'}`}>
              {item.done ? <CheckCircle size={14} /> : <Activity size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`bl-label font-semibold leading-tight ${item.done ? 'text-ds-900' : 'text-ds-600'}`}>
                {item.label}
              </div>
              {!item.done && (
                <div className="bl-caption text-ds-600 leading-snug mt-0.5">{item.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
