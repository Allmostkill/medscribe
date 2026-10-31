// «Завершить и сформировать протокол» посреди записи: какую стенограмму брать
// в протокол — уточнённую по полной записи (с метками голосов) или живую.

/** Запись режется на сегменты по 20 минут (как SEGMENT_MS в bufferedRecorder). */
export const REFINE_SEGMENT_MS = 20 * 60 * 1000;
/** Запас на расшифровку одного сегмента: обычно ~30 с на 5 минут, берём с большим запасом. */
export const REFINE_PER_SEGMENT_MS = 3 * 60 * 1000;
/** GigaAM на CPU считает дольше T-one: запас на сегмент больше. */
export const REFINE_PER_SEGMENT_MS_GIGAAM = 6 * 60 * 1000;

export const FALLBACK_NOTICE =
  'Не удалось разделить реплики по голосу — протокол по живой стенограмме. Запись сохранена в «Незавершённых».';
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
 */
export function canRefineOnFinish(prefixLines: number): boolean {
  return prefixLines <= 0;
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
