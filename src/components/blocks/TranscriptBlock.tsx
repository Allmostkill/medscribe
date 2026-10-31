import type { RefObject } from "react";
import { CheckCircle, AlertCircle, Activity, Send } from "lucide-react";
import BlockShell from "./BlockShell";
import type { TranscriptLine } from "../../types";
import type { TranscriptionProgress } from "../../services/sttFull";
import type { BufferedRecorder } from "../../services/bufferedRecorder";
import { getSpecialtyChecklists, SPECIALTY_UI } from "../../config/checklists";
import { formatDuration } from "../../utils/format";
import { speakerLabel } from "../../utils/speakers";

interface TranscriptBlockProps {
  specialtyId?: string;
  consultationType: 'primary' | 'follow-up';
  transcript: TranscriptLine[];
  onOpenChecklistModal: () => void;

  isRecording: boolean;
  stenographerMode: boolean;
  bufferedRef: RefObject<BufferedRecorder | null>;
  bufferedElapsedMs: number;
  bufferedLevel: number;
  bufferedSegments: number;
  stopBufferedAndTranscribe: () => void;

  transcriptionProgress: TranscriptionProgress | null;
  isDiarizing: boolean;
  isRefiningTranscript: boolean;
  transcribingError: string | null;
  bufferedSessionId: string | null;
  retryTranscription: () => void;

  currentSpeech: string;
  transcriptEndRef: RefObject<HTMLDivElement | null>;

  manualInput: string;
  onManualInputChange: (value: string) => void;
  onManualSubmit: (e: React.FormEvent) => void;
}

// Извлечено 1:1 из Dashboard.tsx (было COLUMN 3: LIVE TRANSCRIPT).
export default function TranscriptBlock({
  specialtyId,
  consultationType,
  transcript,
  onOpenChecklistModal,
  isRecording,
  stenographerMode,
  bufferedRef,
  bufferedElapsedMs,
  bufferedLevel,
  bufferedSegments,
  stopBufferedAndTranscribe,
  transcriptionProgress,
  isDiarizing,
  isRefiningTranscript,
  transcribingError,
  bufferedSessionId,
  retryTranscription,
  currentSpeech,
  transcriptEndRef,
  manualInput,
  onManualInputChange,
  onManualSubmit,
}: TranscriptBlockProps) {
  const hasLabelledLines = transcript.some(t => t.speaker !== 'unknown');
  return (
    // relative — под оверлей записи, он позиционируется абсолютно в теле блока.
    <BlockShell
      className="relative"
      title="Стенограмма приёма"
      actions={
          // Чип прогресса чек-листа — только на мобильных (<lg), где чек-лист
          // не показан отдельным блоком. Клик открывает модалку чек-листа.
          (() => {
            const lists = getSpecialtyChecklists(specialtyId);
            const list = consultationType === 'primary' ? lists.primary : lists.followUp;
            const ui = specialtyId ? SPECIALTY_UI[specialtyId] : undefined;
            const fullText = transcript.map(t => t.text).join(' ');
            const done = list.filter(i => i.keywords.test(fullText)).length;
            const pct = list.length === 0 ? 0 : Math.round((done / list.length) * 100);
            return (
              <button
                onClick={onOpenChecklistModal}
                className="lg:hidden flex items-center gap-2 px-2.5 py-1 rounded-md bg-white border border-ds-200 bl-label font-semibold hover:border-primary-300 transition-colors"
              >
                <CheckCircle size={12} className={pct === 100 ? 'text-success-600' : ui ? ui.text : 'text-primary-500'} />
                <span className="text-ds-900">{ui ? ui.emoji : 'Чек-лист'}</span>
                <span className="font-mono text-ds-600">{done}/{list.length}</span>
              </button>
            );
          })()
      }
    >

      <div className="flex-1 p-[var(--bl-pad-lg)] overflow-y-auto bg-white bl-body leading-relaxed relative break-words">
        {/* ── Buffered (stenographer) recording — large status panel ───────
            Replaces live transcript with timer + level meter while recording.
            After stop, shows transcription progress, then text appears. */}
        {isRecording && stenographerMode && bufferedRef.current && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-error-500 rounded-full animate-pulse" />
              <span className="bl-label font-semibold uppercase tracking-widest text-error-600">Идёт запись</span>
            </div>
            <div className="bl-display font-mono font-bold text-ds-900 mb-2 tabular-nums">
              {formatDuration(bufferedElapsedMs)}
            </div>
            <div className="bl-label text-ds-600 mb-6">
              Стенограф · T-one · до 60 минут
            </div>

            {/* Audio level meter */}
            <div className="flex items-end gap-1 h-12 mb-6">
              {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((threshold, i) => (
                <div
                  key={i}
                  className={`w-2 rounded-sm transition-all duration-100 ${
                    bufferedLevel >= threshold
                      ? threshold >= 0.75 ? 'bg-error-500' : threshold >= 0.5 ? 'bg-warning-500' : 'bg-success-500'
                      : 'bg-ds-200'
                  }`}
                  style={{ height: `${20 + i * 8}px` }}
                />
              ))}
            </div>

            <div className="bl-label text-ds-600 mb-6 font-mono">
              Сегментов сохранено: {bufferedSegments + 1}
              {bufferedSegments + 1 > 1 && <span className="ml-2 text-warning-700">(длинная запись — авто-split)</span>}
            </div>

            <button
              onClick={stopBufferedAndTranscribe}
              className="px-6 py-3 bg-primary-600 text-white font-semibold bl-body rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Завершить и расшифровать
            </button>

            <p className="bl-label text-ds-600 mt-3 max-w-sm text-center leading-relaxed">
              Подсказок не будет — запись сохраняется локально и расшифруется целиком при завершении (max точность).
            </p>
          </div>
        )}

        {/* Фоновое уточнение стенограммы. Намеренно НЕ блокирует экран, в
            отличие от индикаторов ниже: живая стенограмма остаётся читаемой и
            рабочей всё время прохода, а подменится сама, когда он закончится. */}
        {isRefiningTranscript && (
          <div className="mx-4 mb-3 flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
            <div className="w-3.5 h-3.5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin flex-shrink-0" />
            <span className="bl-label text-primary-800 leading-snug">
              Уточняем стенограмму по полной записи приёма — текст ниже обновится сам.
            </span>
          </div>
        )}

        {/* Transcription progress (after recording stopped) */}
        {transcriptionProgress && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-5" />
            <div className="bl-lead font-semibold text-ds-900 mb-2">
              Этап 1 из 2: Расшифровка
            </div>
            <div className="bl-label text-ds-600 mb-4">
              Сегмент {transcriptionProgress.segmentIdx + 1} из {transcriptionProgress.totalSegments} · T-one
            </div>
            <div className="w-64 h-1.5 bg-ds-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-500"
                style={{ width: `${((transcriptionProgress.segmentIdx + (transcriptionProgress.status === 'done' ? 1 : 0.5)) / transcriptionProgress.totalSegments) * 100}%` }}
              />
            </div>
            <p className="bl-label text-ds-600 mt-4 max-w-sm text-center leading-relaxed">
              Обычно ~30 секунд на каждые 5 минут. После этого AI разметит спикеров.
            </p>
          </div>
        )}

        {/* Diarization progress (after ASR, before showing diarized text) */}
        {isDiarizing && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-5" />
            <div className="bl-lead font-semibold text-ds-900 mb-2">
              Этап 2 из 2: AI размечает спикеров
            </div>
            <div className="bl-label text-ds-600 mb-4">
              Языковая модель определяет Врача и Пациента · ~10-15 сек
            </div>
            <p className="bl-label text-ds-600 mt-2 max-w-sm text-center leading-relaxed">
              После этого вы увидите разделённый диалог и сможете сохранить протокол.
            </p>
          </div>
        )}

        {/* Transcription failed — retry / download fallback */}
        {transcribingError && !transcriptionProgress && bufferedSessionId && (
          <div className="bg-error-50 border border-error-200 rounded-lg p-5 mx-4">
            <div className="flex items-center gap-2 text-error-700 font-semibold bl-body mb-2">
              <AlertCircle size={16} />
              Не удалось расшифровать
            </div>
            <p className="bl-body text-error-800 mb-4">{transcribingError}</p>
            <p className="bl-label text-error-700 mb-4">
              Аудио сохранено локально в браузере. Можете попробовать ещё раз — оно не потеряется до перезагрузки.
            </p>
            <button
              onClick={retryTranscription}
              className="px-4 py-2 bg-error-600 text-white bl-body font-semibold rounded-lg hover:bg-error-700 transition-colors"
            >
              Повторить расшифровку
            </button>
          </div>
        )}

        {/* Движок не умеет диаризацию в чанк-режиме — спикеров расставляет
            LLM после завершения приёма. Этот хинт исчезает, как только
            диаризованный транскрипт заменяет сырой. */}
        {isRecording && !stenographerMode &&
          transcript.length > 0 && transcript.every(t => t.speaker === 'unknown') && (
          <div className="mb-3 px-3 py-2 bg-info-50/60 border border-info-100 rounded-lg bl-label text-info-900 flex items-center gap-2">
            <Activity size={13} className="flex-shrink-0" />
            <span>Спикеры будут размечены автоматически после завершения приёма (Врач / Пациент).</span>
          </div>
        )}

        <div className="space-y-4">
          {transcript.map((line) => {
            const isDoctor = line.speaker === 'doctor';
            const isUnknown = line.speaker === 'unknown';
            const label = speakerLabel(line.speaker);
            const isLeft = isDoctor || line.speaker === 'speaker_1';

            // Живые и сырые строки — без подписи. Но когда рядом есть размеченные
            // (часть записи не разделилась по голосу), неразмеченная реплика
            // подписана явно: её нельзя принять за речь соседнего участника.
            if (isUnknown && (isRecording || !hasLabelledLines)) {
              return (
                <div key={line.id} className="p-3.5 bg-ds-100 border-l-2 border-ds-300 rounded-r-lg">
                  <span className="bl-body leading-relaxed text-ds-600 font-mono">
                    {line.text}
                  </span>
                </div>
              );
            }

            return (
              <div key={line.id}
                className={`p-3.5 border rounded-lg ${
                  isUnknown
                    ? 'bg-ds-100 border-ds-300'
                    : isLeft
                    ? 'bg-primary-50 border-primary-100 mr-8'
                    : 'bg-white border-ds-200 ml-8 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <strong className={`bl-caption uppercase font-semibold tracking-wide ${isLeft ? 'text-primary-700' : 'text-ds-600'}`}>
                    {label}
                  </strong>
                  <span className="bl-caption text-ds-600 font-mono">
                    {line.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <span className="bl-body leading-relaxed text-ds-900">
                  {line.text}
                </span>
              </div>
            );
          })}
          {currentSpeech && (
            <div className="mb-3 p-3.5 bg-primary-50 border border-dashed border-primary-200 text-primary-700 bl-body font-medium rounded-lg">
              <i>... {currentSpeech}</i>
            </div>
          )}
          {isRecording && !currentSpeech && (
            <p className="text-center text-ds-600 font-mono bl-label mt-6 uppercase tracking-widest">Анализ аудиопотока...</p>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Manual Input */}
      <div className="p-3 border-t border-ds-200 bg-ds-100">
        <form onSubmit={onManualSubmit} className="flex gap-2 relative z-10 w-full">
          <input
            type="text"
            value={manualInput}
            onChange={e => onManualInputChange(e.target.value)}
            placeholder="Дописать реплику врача вручную…"
            className="flex-1 bg-white border border-ds-400 px-4 py-2 bl-body rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all placeholder:text-ds-600"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="px-3.5 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-40 hover:bg-primary-700 transition-colors"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </BlockShell>
  );
}
