// «Завершить и сформировать протокол» посреди записи: какую стенограмму брать
// в протокол — уточнённую по полной записи (с метками голосов) или живую.
import type { TranscriptLine } from '../types';
import type { SttSegment } from './speakers';

/** Запись режется на сегменты по 20 минут (как SEGMENT_MS в bufferedRecorder). */
export const REFINE_SEGMENT_MS = 20 * 60 * 1000;
/** Запас на расшифровку одного сегмента: обычно ~30 с на 5 минут, берём с большим запасом. */
export const REFINE_PER_SEGMENT_MS = 3 * 60 * 1000;
/** GigaAM на CPU считает дольше T-one: запас на сегмент больше. */
export const REFINE_PER_SEGMENT_MS_GIGAAM = 6 * 60 * 1000;

export const FALLBACK_NOTICE =
  'Не удалось разделить реплики по голосу — протокол по живой стенограмме. Запись сохранена в «Незавершённых».';
/** Часть звука не сохранилась (нет места, лимит): расшифровка охватит только сохранённое. */
export const INCOMPLETE_AUDIO_NOTICE =
  'Часть записи не удалось сохранить: в расшифровке будет только сохранённое.';
export const FALLBACK_NOTICE_NO_AUDIO =
  'Не удалось разделить реплики по голосу — протокол по живой стенограмме.';

/** Сколько ждать полную расшифровку записи длиной durationMs, прежде чем идти по живой стенограмме. */
export function refineTimeoutMs(durationMs: number, engine: 'tone' | 'gigaam' = 'tone'): number {
  const segments = Math.max(1, Math.ceil((Number.isFinite(durationMs) ? durationMs : 0) / REFINE_SEGMENT_MS));
  return segments * (engine === 'gigaam' ? REFINE_PER_SEGMENT_MS_GIGAAM : REFINE_PER_SEGMENT_MS);
}

export type RefineOutcome<L> =
  | { kind: 'ok'; lines: L[]; voiceLabelled: boolean }
  | { kind: 'empty' }     // модель не нашла речи
  | { kind: 'failed' }    // ошибка расшифровки / отмена
  | { kind: 'timeout' };  // не уложились в refineTimeoutMs

export interface FinishPlan<L> {
  source: 'refined' | 'live';
  lines: L[];
  voiceLabelled: boolean;
  /** Аудио остаётся в «Незавершённых» (расшифровка не удалась). */
  keepAudio: boolean;
  /** Короткое неблокирующее сообщение врачу или null. */
  notice: string | null;
}

/**
 * refine === null — записи не было вовсе (параллельная запись не завелась):
 * протокол по живой стенограмме, как раньше, но врача об этом предупреждаем.
 * Живую стенограмму не теряем никогда: refined берётся только при непустых строках.
 */
export function planFinishTranscript<L>(
  live: L[],
  liveVoiceLabelled: boolean,
  refine: RefineOutcome<L> | null,
): FinishPlan<L> {
  if (refine && refine.kind === 'ok' && refine.lines.length > 0) {
    return { source: 'refined', lines: refine.lines, voiceLabelled: refine.voiceLabelled, keepAudio: false, notice: null };
  }
  return {
    source: 'live',
    lines: live,
    voiceLabelled: liveVoiceLabelled,
    keepAudio: refine !== null,
    notice: refine === null ? FALLBACK_NOTICE_NO_AUDIO : FALLBACK_NOTICE,
  };
}

/** Дождаться promise не дольше ms. Таймер всегда снимается. */
export function raceWithTimeout<T>(p: Promise<T>, ms: number): Promise<{ timedOut: boolean; value?: T }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve({ timedOut: true }), ms);
    p.then(
      (value) => { clearTimeout(t); resolve({ timedOut: false, value }); },
      (err) => { clearTimeout(t); reject(err); },
    );
  });
}

/** Идущее уточнение можно подхватить, только если оно из текущего приёма (иначе чужая речь попадёт в протокол). */
export function isPendingForVisit(pendingGen: number | null | undefined, currentGen: number): boolean {
  return pendingGen !== null && pendingGen !== undefined && pendingGen === currentGen;
}

/**
 * Продолженная запись («Продолжить запись»): полная запись покрывает только
 * последний отрезок, а номера голосов в каждой записи свои — склейка небезопасна.
 * Тогда запись не расшифровываем, протокол по живой стенограмме целиком.
 * incompleteAudio — часть звука не сохранилась: то же самое, по живой стенограмме.
 */
export function canRefineOnFinish(prefixLines: number, incompleteAudio = false): boolean {
  // Неполный звук тоже не годится: обрезок заменил бы полный живой текст.
  return prefixLines <= 0 && !incompleteAudio;
}

/** Запись стирается только когда протокол есть и лёг в историю; иначе остаётся в «Незавершённых». */
export function shouldDeleteAudio(hasProtocol: boolean, draftSaved: boolean): boolean {
  return hasProtocol && draftSaved;
}

/**
 * Решение «Завершить» для продолженной записи не зависит от того, идёт ли запись:
 * после «Стоп» второго отрезка его уточнение ещё может быть в работе.
 */
export function isResumedFinish(withRefine: boolean, prefixLines: number): boolean {
  return withRefine && !canRefineOnFinish(prefixLines);
}

/** Причина для пустого результата расшифровки (текст сообщения «Расшифровать не удалось»). */
export const EMPTY_STT_REASON = 'речь в записи не распознана';

/**
 * Строки стенограммы из результата расшифровки: по строке на сегмент, пустые отбрасываются;
 * сегментов нет — одна строка из полного текста; нечего показать — [].
 * Порядок строк задаёт порядок массива, timestamp нужен только для показа времени.
 */
export function sttResultToLines(r: { text: string; segments: SttSegment[] }): TranscriptLine[] {
  const now = Date.now();
  const segments = (r.segments ?? []).filter((s) => s.text.trim() !== '');
  if (segments.length > 0) {
    return segments.map((s, idx) => ({
      id: `${now}_${idx}`,
      speaker: s.speaker ?? 'unknown',
      text: s.text,
      timestamp: new Date(),
    }));
  }
  if (r.text.trim() === '') return [];
  return [{ id: now.toString(), speaker: 'unknown', text: r.text, timestamp: new Date() }];
}

/** Сообщение врачу, когда расшифровка не удалась; kept — запись осталась для повторной попытки. */
export function transcribeFailureMessage(reason: string, kept: boolean): string {
  const r = reason.trim().replace(/\.+$/, '').trim() || 'неизвестная ошибка';
  return kept
    ? `Расшифровать не удалось: ${r}. Запись сохранена — нажмите «Расшифровать» на стартовом экране.`
    : `Расшифровать не удалось: ${r}.`;
}

/**
 * Старт записи: контекст «Из МИС» сбрасывается, если экран пуст (новый приём), а контекст уже
 * уходил в прошлую запись. Продолжение записи в том же приёме контекст не трогает.
 */
export function shouldClearPriorContextOnStart(opts: { screenEmpty: boolean; used: boolean }): boolean {
  return opts.screenEmpty && opts.used;
}
