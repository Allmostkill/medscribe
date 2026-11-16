import { AlertCircle } from "lucide-react";
import BlockShell from "./BlockShell";

interface PharmaBlockProps {
  pharmaHints: string[];
  isGeneratingHints: boolean;
}

// Извлечено 1:1 из Dashboard.tsx (было COLUMN 2: PHARMA SAFETY).
export default function PharmaBlock({ pharmaHints, isGeneratingHints }: PharmaBlockProps) {
  return (
    <BlockShell icon={AlertCircle} title="Фарма-безопасность" tone="danger">
      <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack)] overflow-y-auto flex-1 bg-ds-50">
        {pharmaHints.length === 0 && !isGeneratingHints ? (
          <div className="text-center mt-5">
            <AlertCircle size={22} className="mx-auto text-ds-300 mb-2" />
            <p className="bl-label font-mono uppercase text-ds-600 tracking-widest">Нет предупреждений</p>
          </div>
        ) : (
          pharmaHints.map((hint, idx) => (
            <div key={idx} className="bg-white p-3.5 bl-body shadow-sm border border-error-200 border-l-[3px] border-l-error-600 rounded-r-lg">
              <div className="font-semibold mb-1.5 flex items-center gap-1.5 bl-caption uppercase tracking-wide text-error-700">
                <span className="px-1.5 py-0.5 bg-error-50 rounded text-error-700">Внимание</span>
              </div>
              <span className="text-ds-900 font-medium leading-relaxed">{hint}</span>
            </div>
          ))
        )}
      </div>
    </BlockShell>
  );
}
