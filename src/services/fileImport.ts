// ─── Загрузка аудиофайла приёма ──────────────────────────────────────────────
// Исходный файл уходит на сервер частями по 16 МБ (сырые байты, имя файла не передаём),
// сервер возвращает части записи по 20 мин (base64 ogg/opus), мы кладём их в IndexedDB
// как обычную сессию записи — дальше работает runBufferedTranscription.

import { ensureValidSession } from './auth';
import { importSession } from './audioBuffer';
import { errorFromResponse, importErrorMessage, maxAttempts, partRanges, retryDelayMs } from '../utils/fileImport';

export interface ImportProgress {
  phase: 'upload' | 'prepare';
  loaded?: number;
  total?: number;
}

export interface ImportOptions {
  consultationType: 'primary' | 'follow-up';
  doctorId: string;
  /** Дата приёма (ГГГГ-ММ-ДД) и «это был звонок»: хранятся в сессии для повтора из «Незавершённых». */
  visitDate?: string | null;
  wasCall?: boolean;
  signal?: AbortSignal;
  onProgress?: (p: ImportProgress) => void;
}

class ImportError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly code?: string) { super(message); }
}

function abortError(): Error {
  const e = new Error('Загрузка отменена');
  e.name = 'AbortError';
  return e;
}

async function authHeader(): Promise<string> {
  // Токен берём на каждый запрос: загрузка большого файла может идти дольше часа.
  const session = await ensureValidSession();
  if (!session?.token) throw new ImportError(importErrorMessage(401, undefined, ''), false);
  if (session.expiresAt <= Date.now()) throw new ImportError(importErrorMessage(0, undefined, ''), true);
  return `Bearer ${session.token}`;
}

/** Один запрос к серверу: тело ответа — JSON {error, code}; повтор — по shouldRetry. */
async function call(
  url: string, init: { method: string; body?: Blob }, signal: AbortSignal | undefined,
): Promise<any> {
  const headers: Record<string, string> = { Authorization: await authHeader() };
  if (init.body) headers['Content-Type'] = 'application/octet-stream';
  let res: Response;
  try {
    res = await fetch(url, { method: init.method, headers, body: init.body, signal });
  } catch (err) {
    if (signal?.aborted) throw abortError();
    console.warn('[Import] нет связи с сервером');
    throw new ImportError(importErrorMessage(0, undefined, ''), true);
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* тела нет */ }
  if (!res.ok) {
    const e = errorFromResponse(res.status, data);
    console.warn(`[Import] HTTP ${res.status}${e.code ? ` ${e.code}` : ''}`);
    throw new ImportError(e.message, e.retryable, e.code);
  }
  return data;
}

async function withRetry<T>(work: () => Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  // part_in_flight считаем отдельно от остальных сбоев: у него свой, более длинный запас.
  const tries = { inFlight: 0, other: 0 };
  for (;;) {
    if (signal?.aborted) throw abortError();
    try {
      return await work();
    } catch (err) {
      if (!(err instanceof ImportError) || !err.retryable) throw err;
      const key = err.code === 'part_in_flight' ? 'inFlight' : 'other';
      const attempt = ++tries[key];
      const limit = maxAttempts(err.code);
      if (attempt >= limit) throw err;
      console.warn(`[Import] попытка ${attempt}/${limit} не удалась`);
      await new Promise(r => setTimeout(r, retryDelayMs(err.code, attempt)));
    }
  }
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function importAudioFile(file: File, opts: ImportOptions): Promise<{ sessionId: string; totalSec: number }> {
  const { signal, onProgress } = opts;
  let uploadId: string | null = null;
  try {
    const started = await withRetry(() => call('/api/stt/file/start', { method: 'POST' }, signal), signal);
    uploadId = String(started?.uploadId ?? '');
    if (!uploadId) throw new ImportError('Сервер не принял файл', false);
    const base = `/api/stt/file/${encodeURIComponent(uploadId)}`;

    const total = file.size;
    let loaded = 0;
    onProgress?.({ phase: 'upload', loaded, total });
    for (const r of partRanges(total)) {
      // Повтор после обрыва шлёт ту же часть с тем же seq (замыкание на r), а не следующую.
      const part = file.slice(r.start, r.end);
      await withRetry(() => call(`${base}/part?seq=${r.seq}`, { method: 'POST', body: part }, signal), signal);
      loaded = r.end;
      onProgress?.({ phase: 'upload', loaded, total });
    }

    onProgress?.({ phase: 'prepare' });
    const fin = await withRetry(() => call(`${base}/finish`, { method: 'POST' }, signal), signal);
    const raw: any[] = Array.isArray(fin?.segments) ? fin.segments : [];
    if (raw.length === 0) throw new ImportError('Сервер не вернул запись', false);
    const segs = raw.map(s => ({
      blob: base64ToBlob(String(s.audio ?? ''), 'audio/ogg'),
      durationMs: Math.round((Number(s.durationSec) || 0) * 1000),
    }));
    const totalSec = Number(fin.totalSec) || segs.reduce((a, s) => a + s.durationMs, 0) / 1000;
    console.info(`[Import] файл ${total} байт, частей ${partRanges(total).length}, сегментов ${segs.length}, ${Math.round(totalSec)} с`);

    const sessionId = await importSession(
      { consultationType: opts.consultationType, doctorId: opts.doctorId, durationMs: Math.round(totalSec * 1000), source: 'file',
        visitDate: opts.visitDate ?? undefined, wasCall: opts.wasCall },
      segs,
    );
    return { sessionId, totalSec };
  } catch (err) {
    if (uploadId) {
      // Серверу не ждём: он сам чистит брошенные загрузки по сроку.
      authHeader()
        .then(h => fetch(`/api/stt/file/${encodeURIComponent(uploadId!)}`, { method: 'DELETE', headers: { Authorization: h } }))
        .catch(() => { /* не критично */ });
    }
    if (signal?.aborted) throw abortError();
    throw err instanceof Error ? err : new Error(String(err));
  }
}

