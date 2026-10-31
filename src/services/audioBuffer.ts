// ─── Audio buffer with IndexedDB persistence ─────────────────────────────────
// Used by stenographer/buffered-record mode. Every audio segment is written to
// IndexedDB the moment MediaRecorder produces it, so the recording survives:
//   - Network loss during a long consultation
//   - Browser tab crash
//   - Accidental tab close
//
// On the next visit, listUnfinishedSessions() finds any segments that were
// never marked "uploaded" and offers the doctor to resume transcription.

const DB_NAME = 'medscribe_audio';
const DB_VERSION = 1;
const STORE_SEGMENTS = 'segments';
const STORE_SESSIONS = 'sessions';

export interface SessionMeta {
  sessionId: string;
  startedAt: number;
  durationMs: number;
  segmentCount: number;
  status: 'recording' | 'completed' | 'uploaded' | 'transcribed';
  consultationType?: 'primary' | 'follow-up';
  doctorId?: string;
}

export interface SegmentRecord {
  sessionId: string;
  segmentIdx: number;
  blob: Blob;
  durationMs: number;
  recordedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SEGMENTS)) {
        const s = db.createObjectStore(STORE_SEGMENTS, { keyPath: ['sessionId', 'segmentIdx'] });
        s.createIndex('sessionId', 'sessionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeNames: string | string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDb();
      const transaction = db.transaction(storeNames, mode);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      const result = await Promise.resolve(work(transaction));
      transaction.oncomplete = () => { db.close(); resolve(result); };
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function makeSessionId(): string {
  // 12-byte random + timestamp prefix — easy to sort, no collisions
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${Date.now()}-${hex}`;
}

export async function createSession(meta: Omit<SessionMeta, 'segmentCount' | 'durationMs'>): Promise<void> {
  return tx(STORE_SESSIONS, 'readwrite', t => {
    const store = t.objectStore(STORE_SESSIONS);
    store.put({ ...meta, segmentCount: 0, durationMs: 0 } satisfies SessionMeta);
  });
}

export async function updateSession(sessionId: string, patch: Partial<SessionMeta>): Promise<void> {
  return tx(STORE_SESSIONS, 'readwrite', async t => {
    const store = t.objectStore(STORE_SESSIONS);
    const existing = await idbGet<SessionMeta>(store, sessionId);
    if (!existing) return;
    store.put({ ...existing, ...patch });
  });
}

/** Sessions that were recording or completed but not uploaded — eligible for recovery. */
export async function listUnfinishedSessions(): Promise<SessionMeta[]> {
  return tx(STORE_SESSIONS, 'readonly', async t => {
    const all = await idbGetAll<SessionMeta>(t.objectStore(STORE_SESSIONS));
    // Сессии без сегментов не показываем, но и не удаляем: сегмент пишется в базу
    // только при остановке записи (или раз в 20 минут), поэтому идущая сейчас
    // запись тоже выглядит как «0 сегментов». Старые заготовки уберёт purgeOld.
    return all
      .filter(s => (s.status === 'recording' || s.status === 'completed') && s.segmentCount > 0)
      .sort((a, b) => b.startedAt - a.startedAt);
  });
}

// ─── Segments ────────────────────────────────────────────────────────────────

export async function saveSegment(rec: SegmentRecord): Promise<void> {
  return tx([STORE_SEGMENTS, STORE_SESSIONS], 'readwrite', async t => {
    t.objectStore(STORE_SEGMENTS).put(rec);
    // Keep session meta in sync
    const sessionStore = t.objectStore(STORE_SESSIONS);
    const meta = await idbGet<SessionMeta>(sessionStore, rec.sessionId);
    if (meta) {
      sessionStore.put({
        ...meta,
        segmentCount: Math.max(meta.segmentCount, rec.segmentIdx + 1),
        durationMs: meta.durationMs + rec.durationMs,
      });
    }
  });
}

export async function loadSegments(sessionId: string): Promise<SegmentRecord[]> {
  return tx(STORE_SEGMENTS, 'readonly', async t => {
    const store = t.objectStore(STORE_SEGMENTS);
    const idx = store.index('sessionId');
    const all = await idbGetAllByKey<SegmentRecord>(idx, sessionId);
    return all.sort((a, b) => a.segmentIdx - b.segmentIdx);
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  return tx([STORE_SEGMENTS, STORE_SESSIONS], 'readwrite', async t => {
    t.objectStore(STORE_SESSIONS).delete(sessionId);
    const segStore = t.objectStore(STORE_SEGMENTS);
    const idx = segStore.index('sessionId');
    const keys = await idbGetAllKeysByKey(idx, sessionId);
    for (const k of keys) segStore.delete(k);
  });
}

/** Best-effort cleanup: delete sessions older than `maxAgeMs`. */
export async function purgeOld(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;
  const sessions = await tx(STORE_SESSIONS, 'readonly', async t => {
    return idbGetAll<SessionMeta>(t.objectStore(STORE_SESSIONS));
  });
  for (const s of sessions) {
    if (s.startedAt < cutoff) await deleteSession(s.sessionId);
  }
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
