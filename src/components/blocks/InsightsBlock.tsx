import { Activity } from "lucide-react";
import BlockShell from "./BlockShell";
import type { ClinicalHint } from "../../services/ai";

interface InsightsBlockProps {
  hints: ClinicalHint[];
  isGeneratingHints: boolean;
  hasTranscript: boolean;
  onRefresh: () => void;
}

// Извлечено 1:1 из Dashboard.tsx (было COLUMN 1: CLINICAL INSIGHTS).
export default function InsightsBlock({ hints, isGeneratingHints, hasTranscript, onRefresh }: InsightsBlockProps) {
  return (
    <BlockShell
      tone="assistant"
      icon={Activity}
      title="Клинические инсайты"
      actions={
        <button
          onClick={onRefresh}
          disabled={isGeneratingHints || !hasTranscript}
          className="flex-shrink-0 bl-label font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent cursor-pointer transition-colors"
        >
          {isGeneratingHints ? "Анализ..." : "Обновить"}
        </button>
      }
    >
      <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack)] overflow-y-auto flex-1 bg-ds-50">
        {hints.length === 0 && !isGeneratingHints ? (
          <div className="text-center mt-6">
            <Activity size={24} className="mx-auto text-ds-300 mb-2" />
            <p className="bl-label font-mono uppercase text-ds-600 tracking-widest">Ожидание данных...</p>
          </div>
        ) : (
          hints.map((hint, idx) => {
            const severityStyles = {
              high: { border: 'border-error-200 border-l-[4px] border-l-error-500', badge: 'bg-error-100 text-error-700', label: 'Критично' },
              medium: { border: 'border-warning-200 border-l-[4px] border-l-warning-500', badge: 'bg-warning-100 text-warning-700', label: 'Важно' },
              low: { border: 'border-info-200 border-l-[4px] border-l-info-400', badge: 'bg-info-50 text-info-600', label: 'К сведению' },
            };
            const style = severityStyles[hint.severity] || severityStyles.low;
            return (
              <div key={idx} className={`p-4 bl-body border bg-white shadow-sm ${style.border}`}>
                <div className="font-bold mb-2 flex items-center gap-2">
                  <span className={`px-2 py-0.5 bl-caption font-bold uppercase tracking-widest ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
                <span className="text-black font-medium leading-relaxed">{hint.text}</span>
              </div>
            );
          })
        )}
      </div>
    </BlockShell>
  );
}
