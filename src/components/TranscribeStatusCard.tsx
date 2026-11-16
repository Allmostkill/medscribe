import { AlertCircle } from "lucide-react";
import type { TranscriptionProgress } from "../services/sttFull";

interface TranscribeStatusCardProps {
  progress: TranscriptionProgress | null;
  error: string | null;
  onCancel: () => void;   // отмена идущей расшифровки
  onDismiss: () => void;  // закрыть сообщение об ошибке
}

export default function TranscribeStatusCard({
  progress,
  error,
  onCancel,
  onDismiss,
}: TranscribeStatusCardProps) {
  if (!progress && !error) return null;

  if (progress) {
    return (
      <div aria-live="polite" className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-primary-800 font-semibold text-[13px]">
              Расшифровываем запись…
            </div>
            <div className="text-[11px] text-ds-600 font-mono">
              Часть {progress.segmentIdx + 1} из {progress.totalSegments}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-[11px] font-semibold px-2.5 py-1.5 bg-white border border-primary-200 text-primary-700 rounded hover:bg-primary-100 flex-shrink-0"
          >
            Отменить
          </button>
        </div>
        <div className="w-full h-1.5 bg-ds-200 rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-primary-500 transition-all duration-500"
            style={{ width: `${((progress.segmentIdx + (progress.status === 'done' ? 1 : 0.5)) / progress.totalSegments) * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-ds-600 mt-2 leading-relaxed">
          Запись сохранена в браузере. Не закрывайте вкладку, пока идёт расшифровка.
        </p>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="bg-error-50 border border-error-200 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-2 mb-3">
        <AlertCircle size={14} className="text-error-800 mt-0.5 flex-shrink-0" />
        <p className="text-[12px] text-error-800 leading-relaxed">{error}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-[11px] font-semibold px-2.5 py-1.5 bg-white border border-error-200 text-error-700 rounded hover:bg-error-100"
      >
        Закрыть
      </button>
    </div>
  );
}
