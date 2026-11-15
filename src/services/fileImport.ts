// ─── Загрузка аудиофайла приёма ──────────────────────────────────────────────
// Исходный файл уходит на сервер частями по 16 МБ (сырые байты, имя файла не передаём),
// сервер возвращает части записи по 20 мин (base64 ogg/opus), мы кладём их в IndexedDB
// как обычную сессию записи — дальше работает runBufferedTranscription.

import { ensureValidSession } from './auth';
import { importSession } from './audioBuffer';
import {
  errorFromResponse, forgetUploadId, importErrorMessage, maxAttempts, partRanges, recallUploadId, rememberUploadId, retryDelayMs,
} from '../utils/fileImport';

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

// Последний выданный заголовок: на pagehide ждать токен асинхронно нельзя.
let lastAuth: string | null = null;

function store(): Storage | null {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
}

/** Снять загрузку на сервере; keepalive — чтобы запрос пережил закрытие страницы. */
function dropUpload(id: string, auth: string, keepalive: boolean): Promise<unknown> {
  return fetch(`/api/stt/file/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: auth }, keepalive })
    .catch(() => { /* не критично: сервер снимет брошенную сам */ });
}

const UPLOAD_LOCK_PREFIX = 'medscribe-upload:';

function locksApi(): any {
  return typeof navigator !== 'undefined' ? (navigator as any).locks : undefined;
}

/**
 * Пока идёт загрузка, вкладка держит Web Lock на её uploadId (браузер отпускает замок при выгрузке страницы).
 * Дубль вкладки копирует sessionStorage вместе с ключом: по замку видно, что загрузка ещё живая. Web Locks нет — null.
 */
function holdUploadLock(id: string): (() => void) | null {
  const locks = locksApi();
  if (!locks?.request) return null;
  let release: () => void = () => {};
  try {
    locks.request(UPLOAD_LOCK_PREFIX + id, () => new Promise<void>(res => { release = res; })).catch(() => {});
  } catch { return null; }
  return () => release();
}

/**
 * Загрузка прошлой страницы (обновили или закрыли вкладку) ещё числится на сервере: снимаем до нового start.
 * Замок занят — загрузку ведёт другая вкладка (дубль с копией sessionStorage): ключ и сервер не трогаем.
 */
async function dropStaleUpload(): Promise<void> {
  const id = recallUploadId(store());
  if (!id) return;
  const drop = async () => {
    forgetUploadId(store());
    try { await dropUpload(id, await authHeader(false), false); } catch { /* не критично */ }
  };
  const locks = locksApi();
  if (!locks?.request) return drop();
  try {
    await locks.request(UPLOAD_LOCK_PREFIX + id, { ifAvailable: true }, async (lock: unknown) => {
      if (lock) await drop();
    });
  } catch {
    await drop();
  }
}

async function authHeader(remember = true): Promise<string> {
  // Токен берём на каждый запрос: загрузка большого файла может идти дольше часа.
  const session = await ensureValidSession();
  if (!session?.token) throw new ImportError(importErrorMessage(401, undefined, ''), false);
  if (session.expiresAt <= Date.now()) throw new ImportError(importErrorMessage(0, undefined, ''), true);
  const header = `Bearer ${session.token}`;
  if (remember) lastAuth = header;
  return header;
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
  let releaseLock: (() => void) | null = null;
  // Ключ не стираем: дошёл ли keepalive-DELETE, неизвестно, повторный DELETE при следующем start безвреден (404).
  // persisted — страница уходит в bfcache и может вернуться продолжать загрузку: ничего не делаем.
  const onPageHide = (e: PageTransitionEvent) => {
    if (e.persisted) return;
    const id = recallUploadId(store());
    if (id && lastAuth) void dropUpload(id, lastAuth, true);
  };
  try {
    await dropStaleUpload();
    const started = await withRetry(() => call('/api/stt/file/start', { method: 'POST' }, signal), signal);
    uploadId = String(started?.uploadId ?? '');
    if (!uploadId) throw new ImportError('Сервер не принял файл', false);
    const base = `/api/stt/file/${encodeURIComponent(uploadId)}`;
    rememberUploadId(store(), uploadId);
    releaseLock = holdUploadLock(uploadId);
    window.addEventListener('pagehide', onPageHide);

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
    // finish принят: сервер сам снял задачу, чистить на сервере нечего.
    forgetUploadId(store());
    window.removeEventListener('pagehide', onPageHide);
    releaseLock?.();
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
    window.removeEventListener('pagehide', onPageHide);
    forgetUploadId(store());
    if (uploadId) {
      // Серверу не ждём: он сам снимает брошенные загрузки.
      authHeader(false).then(h => dropUpload(uploadId!, h, false)).catch(() => { /* не критично */ });
    }
    if (signal?.aborted) throw abortError();
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    releaseLock?.();
    lastAuth = null;   // токен после загрузки не держим
  }
}

