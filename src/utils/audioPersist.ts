// ─── Чистая логика сохранения записи (без браузерных API) ────────────────────
// Вынесена из audioBuffer/bufferedRecorder, чтобы проверяться в node:
//   tsx scripts/check-audio-persist.ts

/** Как часто сбрасывать накопленные кусочки на диск: потеря при сбое — не больше этого. */
export const FLUSH_INTERVAL_MS = 5000;
/** Без Web Locks запись считаем живой, если строку сессии обновляли недавно. */
export const LIVE_FRESH_MS = 30 * 1000;
/** Имя блокировки идущей записи: видна всем вкладкам, снимается сама при крахе. */
export const LIVE_LOCK_PREFIX = 'medscribe-rec:';

export interface ChunkLike {
  segmentIdx: number;
  seq: number;
  data: ArrayBuffer;
  mimeType: string;
  /** Сколько прошло от начала сегмента к моменту этого кусочка. */
  segmentMs: number;
  recordedAt: number;
}

export interface AssembledSegment {
  segmentIdx: number;
  parts: ArrayBuffer[];
  mimeType: string;
  durationMs: number;
  recordedAt: number;
  /** После дыры в seq кусочки отброшены: сегмент короче, чем был записан. */
  truncated: boolean;
}

/**
 * Собирает сегменты из кусочков в порядке (segmentIdx, seq).
 * У сегмента без кусочка seq=0 нет EBML-заголовка — файл не читается (ffmpeg rc=183),
 * поэтому такой сегмент не отдаём вовсе. Дыра в середине: берём кусочки до неё,
 * остальные отбрасываем (после дыры склеенный файл ломается).
 */
export function assembleSegments(chunks: readonly ChunkLike[]): AssembledSegment[] {
  const sorted = [...chunks].sort((a, b) => a.segmentIdx - b.segmentIdx || a.seq - b.seq);
  const out: AssembledSegment[] = [];
  let i = 0;
  while (i < sorted.length) {
    const idx = sorted[i].segmentIdx;
    let j = i;
    while (j < sorted.length && sorted[j].segmentIdx === idx) j++;
    const group = sorted.slice(i, j);
    i = j;

    const good: ChunkLike[] = [];
    for (const c of group) {
      if (c.seq !== good.length) break;   // первая дыра (в том числе нет seq=0)
      good.push(c);
    }
    if (good.length === 0) continue;      // заголовка нет — сегмент негоден
    const last = good[good.length - 1];
    out.push({
      segmentIdx: idx,
      parts: good.map(c => c.data),
      mimeType: good[0].mimeType,
      durationMs: last.segmentMs,
      recordedAt: last.recordedAt,
      truncated: good.length < group.length,
    });
  }
  return out;
}

export interface SessionCounters { durationMs: number; segmentCount: number }

/** Новые поля строки сессии после сброса кусочка: длительность абсолютная (не сумма), число сегментов — максимум. */
export function nextSessionMeta(
  existing: SessionCounters,
  segmentIdx: number,
  sessionDurationMs: number,
  now: number,
): SessionCounters & { updatedAt: number } {
  const dur = Number.isFinite(sessionDurationMs) ? Math.max(0, sessionDurationMs) : existing.durationMs;
  return {
    durationMs: Math.max(existing.durationMs, dur),
    segmentCount: Math.max(existing.segmentCount, segmentIdx + 1),
    updatedAt: now,
  };
}

export interface LiveCheckSession { sessionId: string; status: string; startedAt: number; updatedAt?: number }

/**
 * Идёт ли запись прямо сейчас (в этой или другой вкладке).
 * lockedIds — множество sessionId с удерживаемой блокировкой, либо null, если Web Locks нет:
 * тогда судим по свежести updatedAt у статуса 'recording'.
 */
export function isSessionLive(s: LiveCheckSession, lockedIds: ReadonlySet<string> | null, now: number): boolean {
  if (lockedIds) return lockedIds.has(s.sessionId);
  if (s.status !== 'recording') return false;
  return now - (s.updatedAt ?? s.startedAt) < LIVE_FRESH_MS;
}

export interface DoctorRef { id?: string | null; name?: string | null }

/**
 * Чья запись: врач видит свои. Старые записи хранили в doctorId имя врача или ничего:
 * имя совпало либо поля нет — показываем, чтобы не потерять. Врач неизвестен (нет id) — ничего.
 */
export function sessionBelongsTo(s: { doctorId?: string | null }, doctor: DoctorRef | null | undefined): boolean {
  const id = (doctor?.id ?? '').trim();
  if (!id) return false;
  const owner = (s.doctorId ?? '').trim();
  if (owner === '' || owner === id) return true;
  const name = (doctor?.name ?? '').trim();
  return name !== '' && owner === name;
}

/** Пора ли сбрасывать накопленное на диск: есть что сбрасывать и прошло ≥ интервала. */
export function shouldFlush(pendingCount: number, lastFlushAt: number, now: number, intervalMs = FLUSH_INTERVAL_MS): boolean {
  return pendingCount > 0 && now - lastFlushAt >= intervalMs;
}

/** Длительность в плашке «незавершённые»: «40 с» до минуты, дальше «~7 мин». */
export function formatSessionDuration(ms: number): string {
  const sec = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000));
  if (sec < 60) return `${sec} с`;
  return `~${Math.max(1, Math.round(sec / 60))} мин`;
}
