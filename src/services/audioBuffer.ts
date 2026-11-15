// ─── Audio buffer with IndexedDB persistence ─────────────────────────────────
// Используется режимом буферной записи (стенографист и параллельная запись).
// Звук пишется в IndexedDB кусочками (хранилище chunks) примерно раз в 5 с,
// пока идёт запись, поэтому при закрытии вкладки, сбое браузера или отключении
// компьютера теряется не больше ~5 с. Хранилище segments — запись прежней версии
// (целый сегмент одним Blob): новый код её не пишет, но читает и удаляет.
//
// После перезапуска listUnfinishedSessions() находит записи, которые не были
// удалены (статус 'recording'/'completed'), и предлагает продолжить расшифровку.
// Идущая сейчас запись (своя или в другой вкладке) в список не попадает:
// её держит Web Lock medscribe-rec:<sessionId>. Старые записи со статусом
// 'uploaded' не показываются, purgeOld удаляет их через 7 дней.

import {
  assembleSegments, nextSessionMeta, isSessionLive, sessionBelongsTo, LIVE_LOCK_PREFIX, type ChunkLike, type DoctorRef,
} from '../utils/audioPersist';

// Срок хранения записи: старше — не предлагаем продолжить, purgeOld удаляет.
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const DB_NAME = 'medscribe_audio';
const DB_VERSION = 2;
const STORE_SEGMENTS = 'segments';
const STORE_CHUNKS = 'chunks';
const STORE_SESSIONS = 'sessions';
// Открытие базы не должно висеть вечно: от него зависят очередь записи и stop().
const OPEN_TIMEOUT_MS = 10_000;

export interface SessionMeta {
  sessionId: string;
  startedAt: number;
  durationMs: number;
  segmentCount: number;
  status: 'recording' | 'completed' | 'transcribed';
  consultationType?: 'primary' | 'follow-up';
  doctorId?: string;
  /** Последнее обновление строки (сброс кусочка или смена статуса); нет у записей прежней версии. */
  updatedAt?: number;
}

/** Целый сегмент: прежняя запись из segments либо собранный из кусочков chunks. */
export interface SegmentRecord {
  sessionId: string;
  segmentIdx: number;
  blob: Blob;
  durationMs: number;
  recordedAt: number;
}

/** Кусочек сегмента: ключ [sessionId, segmentIdx, seq], seq с нуля в каждом сегменте. */
export interface ChunkRecord {
  sessionId: string;
  segmentIdx: number;
  seq: number;
  data: ArrayBuffer;
  mimeType: string;
  segmentMs: number;
  recordedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    let blocked = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(blocked
        ? 'хранилище записи занято другой вкладкой программы: закройте её'
        : 'хранилище записи в браузере не открылось за 10 секунд'));
    }, OPEN_TIMEOUT_MS);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SEGMENTS)) {
        const s = db.createObjectStore(STORE_SEGMENTS, { keyPath: ['sessionId', 'segmentIdx'] });
        s.createIndex('sessionId', 'sessionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const c = db.createObjectStore(STORE_CHUNKS, { keyPath: ['sessionId', 'segmentIdx', 'seq'] });
        c.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
    // Обновление схемы ждёт, пока другая вкладка закроет старое соединение (она закроет по versionchange).
    // Не отклоняем сразу: если не дождёмся, таймаут скажет, в чём дело.
    req.onblocked = () => { blocked = true; };
    req.onsuccess = () => {
      const db = req.result;
      // Другая вкладка обновляет схему — не мешаем ей.
      db.onversionchange = () => db.close();
      clearTimeout(timer);
      // Опоздали: вызывающий уже получил ошибку, соединение не нужно.
      if (settled) { db.close(); return; }
      settled = true;
      resolve(db);
    };
    req.onerror = () => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(req.error);
    };
  });
}

/**
 * Транзакция с результатом work. База закрывается при любом исходе, в том числе при ошибке.
 * work не должен ждать ничего, кроме запросов IndexedDB: чужой await закроет транзакцию.
 */
function tx<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
  durability?: IDBTransactionDurability,
): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(storeNames, mode, durability ? { durability } : undefined);
    } catch (err) {
      db.close();
      reject(err);
      return;
    }
    let result: T;
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new DOMException('Транзакция отменена', 'AbortError')); };
    try {
      Promise.resolve(work(transaction)).then(
        r => { result = r; },
        err => { try { transaction.abort(); } catch { /* уже завершена */ } db.close(); reject(err); },
      );
    } catch (err) {
      try { transaction.abort(); } catch { /* уже завершена */ }
      db.close();
      reject(err);
    }
  }));
}

// ─── Живая запись ────────────────────────────────────────────────────────────

/** sessionId идущих записей по Web Locks (всех вкладок); null — Web Locks нет. */
async function liveSessionIds(): Promise<Set<string> | null> {
  const locks = (typeof navigator !== 'undefined' ? (navigator as any).locks : undefined);
  if (!locks?.query) return null;
  try {
    const state = await locks.query();
    const ids = new Set<string>();
    for (const l of [...(state.held ?? []), ...(state.pending ?? [])]) {
      if (typeof l.name === 'string' && l.name.startsWith(LIVE_LOCK_PREFIX)) ids.add(l.name.slice(LIVE_LOCK_PREFIX.length));
    }
    return ids;
  } catch {
    return null;
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function makeSessionId(): string {
  // 12-byte random + timestamp prefix — easy to sort, no collisions
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${Date.now()}-${hex}`;
}

export async function createSession(meta: Omit<SessionMeta, 'segmentCount' | 'durationMs' | 'updatedAt'>): Promise<void> {
  return tx(STORE_SESSIONS, 'readwrite', t => {
    const store = t.objectStore(STORE_SESSIONS);
    store.put({ ...meta, segmentCount: 0, durationMs: 0, updatedAt: Date.now() } satisfies SessionMeta);
  });
}

export async function updateSession(sessionId: string, patch: Partial<SessionMeta>): Promise<void> {
  return tx(STORE_SESSIONS, 'readwrite', async t => {
    const store = t.objectStore(STORE_SESSIONS);
    const existing = await idbGet<SessionMeta>(store, sessionId);
    if (!existing) return;
    store.put({ ...existing, ...patch, updatedAt: Date.now() });
  });
}

/**
 * Sessions that were recording or completed and not yet deleted by the caller — eligible for recovery.
 * Идущая запись (эта вкладка или другая) пропускается; упавшая — статус 'recording' без блокировки — видна.
 * Только записи этого врача (см. sessionBelongsTo); врач неизвестен — пусто. Чужие не удаляются: их стирает purgeOld по сроку.
 */
export async function listUnfinishedSessions(doctor: DoctorRef | null | undefined): Promise<SessionMeta[]> {
  if (!(doctor?.id ?? '').trim()) return [];
  const all = await tx(STORE_SESSIONS, 'readonly', t => idbGetAll<SessionMeta>(t.objectStore(STORE_SESSIONS)));
  // Блокировки смотрим после чтения строк: запись, начатая позже, в список не попала,
  // а упавшая между чтением и проверкой честно окажется без блокировки.
  const locked = await liveSessionIds();
  const now = Date.now();
  const cutoff = now - RETENTION_MS;
  // Сессии без сегментов не показываем, но и не удаляем: только что начатая запись
  // ещё не успела сбросить первый кусочек. Старые заготовки уберёт purgeOld.
  return all
    .filter(s => (s.status === 'recording' || s.status === 'completed') && s.segmentCount > 0 && s.startedAt >= cutoff)
    .filter(s => !isSessionLive(s, locked, now))
    .filter(s => sessionBelongsTo(s, doctor))
    .sort((a, b) => b.startedAt - a.startedAt);
}

// ─── Chunks / Segments ───────────────────────────────────────────────────────

/**
 * Дописать кусочек записи. ArrayBuffer готов до вызова: транзакция не ждёт чужих await.
 * Строку сессии читаем первой, в той же транзакции: её нет (запись удалена) — ничего не пишем
 * и возвращаем 'session-gone', иначе поздний сброс воскресил бы удалённое аудио (152-ФЗ).
 * Транзакции readwrite на sessions+chunks идут строго по очереди создания, поэтому
 * deleteSession либо стирает уже записанное, либо отрабатывает раньше и тут видна пустота.
 */
export async function appendChunk(rec: ChunkRecord, sessionDurationMs: number): Promise<'saved' | 'session-gone'> {
  return tx([STORE_SESSIONS, STORE_CHUNKS], 'readwrite', async t => {
    const sessionStore = t.objectStore(STORE_SESSIONS);
    const meta = await idbGet<SessionMeta>(sessionStore, rec.sessionId);
    if (!meta) return 'session-gone' as const;
    t.objectStore(STORE_CHUNKS).put(rec);
    sessionStore.put({ ...meta, ...nextSessionMeta(meta, rec.segmentIdx, sessionDurationMs, Date.now()) });
    return 'saved' as const;
  }, 'strict');
}

/**
 * Все сегменты записи по порядку: прежние целые (segments) и собранные из кусочков (chunks).
 * Сегмент без первого кусочка не отдаётся (файл без заголовка не читается), кусочки
 * после дыры в seq отбрасываются — см. assembleSegments.
 */
export async function loadSegments(sessionId: string): Promise<SegmentRecord[]> {
  const { old, chunks } = await tx([STORE_SEGMENTS, STORE_CHUNKS], 'readonly', async t => ({
    old: await idbGetAllByKey<SegmentRecord>(t.objectStore(STORE_SEGMENTS).index('sessionId'), sessionId),
    chunks: await idbGetAllByKey<ChunkRecord>(t.objectStore(STORE_CHUNKS).index('sessionId'), sessionId),
  }));
  const assembled: SegmentRecord[] = assembleSegments(chunks as ChunkLike[]).map(seg => ({
    sessionId,
    segmentIdx: seg.segmentIdx,
    blob: new Blob(seg.parts, { type: seg.mimeType }),
    durationMs: seg.durationMs,
    recordedAt: seg.recordedAt,
  }));
  return [...old, ...assembled].sort((a, b) => a.segmentIdx - b.segmentIdx);
}

export async function deleteSession(sessionId: string): Promise<void> {
  return tx([STORE_SEGMENTS, STORE_CHUNKS, STORE_SESSIONS], 'readwrite', async t => {
    t.objectStore(STORE_SESSIONS).delete(sessionId);
    for (const name of [STORE_SEGMENTS, STORE_CHUNKS]) {
      const store = t.objectStore(name);
      const keys = await idbGetAllKeysByKey(store.index('sessionId'), sessionId);
      for (const k of keys) store.delete(k);
    }
  });
}

/**
 * Best-effort cleanup: delete sessions older than `maxAgeMs` (блокировка не спасает:
 * забытая вкладка не обходит срок; её поздний кусочек получит 'session-gone'),
 * а также сегменты и кусочки, у которых нет строки сессии.
 */
export async function purgeOld(maxAgeMs = RETENTION_MS): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;
  // Сироты: строку и ключи читаем в одной транзакции, чтобы не задеть только что созданную сессию.
  await tx([STORE_SEGMENTS, STORE_CHUNKS, STORE_SESSIONS], 'readwrite', async t => {
    const known = new Set(await idbGetAllKeys(t.objectStore(STORE_SESSIONS)) as string[]);
    for (const name of [STORE_SEGMENTS, STORE_CHUNKS]) {
      const store = t.objectStore(name);
      const keys = await idbGetAllKeys(store);
      for (const k of keys) {
        if (Array.isArray(k) && !known.has(k[0] as string)) store.delete(k);
      }
    }
  });
  const sessions = await tx(STORE_SESSIONS, 'readonly', async t => {
    return idbGetAll<SessionMeta>(t.objectStore(STORE_SESSIONS));
  });
  const old = sessions.filter(s => s.startedAt < cutoff);
  if (old.length === 0) return;
  for (const s of old) await deleteSession(s.sessionId);
}

// ─── IDB request → Promise helpers ───────────────────────────────────────────

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllKeys(store: IDBObjectStore): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllByKey<T>(index: IDBIndex, key: IDBValidKey): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = index.getAll(key);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllKeysByKey(index: IDBIndex, key: IDBValidKey): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const req = index.getAllKeys(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
