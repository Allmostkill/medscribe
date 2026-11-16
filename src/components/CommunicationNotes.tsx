import { Quote, ArrowRight, HelpCircle } from "lucide-react";
import type { CommunicationNote } from "../services/ai";

/**
 * Разбор общения, сохранённый в черновике приёма (content.communicationReview).
 *
 * Разбор делается после приёма и читается в истории, а не на рабочем поле:
 * читать замечание о собственной речи, сидя перед пациентом, — отдельная
 * нагрузка, а экран врача пациенту нередко виден.
 */
export interface CommunicationReview {
  notes: CommunicationNote[];
  createdAt: string;
}

export const COMMUNICATION_REVIEW_KEY = 'medscribe_communication_review';

// Это не оценка приёма и не оценка врача. Здесь нет баллов, «хорошо/плохо» и
// итогового вывода — только конкретные места с цитатой и вариантом
// формулировки. Оценка врача языковой моделью превращается в надзор ровно в
// тот момент, когда экран увидит кто-то ещё, и потому её тут нет вовсе.
//
// Каждая подсказка показывает цитату, к которой относится, и протокол, на
// который опирается (SPIKES, NURSE, мотивационное интервью, ask-tell-ask,
// teach-back): врач должен видеть основание и иметь возможность не согласиться.
export default function CommunicationNotes({ notes }: { notes: CommunicationNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-[13px] text-ds-600 leading-snug">
        Разбирать нечего: мест, где ту же мысль стоило сказать иначе, не нашлось.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {notes.map((n, idx) => (
        <div
          key={`${n.kind}-${idx}`}
          className={`bg-white rounded-lg p-3.5 border border-l-[4px] ${
            n.kind === 'gap'
              ? 'border-warning-200 border-l-warning-400'
              : 'border-primary-200 border-l-primary-400'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              n.kind === 'gap' ? 'bg-warning-100 text-warning-800' : 'bg-primary-100 text-primary-700'
            }`}>
              {n.kind === 'gap' ? 'Осталось непроговорённым' : 'Формулировка'}
            </span>
            <span className="text-[11px] text-ds-600 ml-auto">{n.protocol}</span>
          </div>

          {/* Цитата — основание подсказки. Сервер сверяет её со стенограммой
              и выбрасывает пункт, если такой реплики в разговоре не было. */}
          <div className="flex items-start gap-1.5 text-[14px] text-ds-700 italic leading-snug">
            <Quote size={12} className="flex-shrink-0 mt-1 text-ds-400" />
            <span>
              <span className="not-italic text-[11px] text-ds-600 mr-1">
                {n.speaker === 'patient' ? 'пациент:' : 'вы:'}
              </span>
              «{n.quote}»
            </span>
          </div>

          {n.alternative && (
            <div className="flex items-start gap-1.5 mt-2 text-[14px] text-ds-900 leading-snug">
              <ArrowRight size={12} className="flex-shrink-0 mt-1 text-primary-500" />
              <span>«{n.alternative}»</span>
            </div>
          )}

          <div className="flex items-start gap-1.5 mt-2 text-[12px] text-ds-600 leading-snug">
            <HelpCircle size={11} className="flex-shrink-0 mt-0.5" />
            <span>{n.why}</span>
          </div>
        </div>
      ))}

      <p className="text-[12px] text-ds-600 leading-snug pt-1">
        Это варианты, а не замечания. Решение, как говорить с пациентом, остаётся за вами.
      </p>
    </div>
  );
}
