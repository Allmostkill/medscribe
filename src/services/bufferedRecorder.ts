// ─── Buffered audio recorder ──────────────────────────────────────────────────
// Used by stenographer mode: records the entire consultation locally first,
// then sends the full audio to T-one for high-accuracy offline transcription
// when the doctor presses "Завершить".
//
// Key features:
//   - Auto-split into 20-minute segments (запас под лимит размера файла STT)
//   - Звук копится кусочками (MediaRecorder отдаёт их раз в секунду) и сбрасывается
//     в IndexedDB не реже раза в ~5 с, пока идёт запись: при закрытии вкладки,
//     сбое браузера или отключении компьютера теряется не больше этого окна.
//     Сброс запускается из ondataavailable, а не таймером: Chrome режет таймеры
//     скрытой вкладки. Запись в базу идёт одной очередью, строго по порядку.
//   - Пока запись идёт, её держит Web Lock medscribe-rec:<sessionId>: другие вкладки
//     и плашка «незавершённые» не считают её упавшей. При крахе блокировка снимается сама.
//   - Live audio level metering (for the recording-in-progress UI)
//   - Hard cap configurable (default 60 min)

import {
  appendChunk, updateSession, createSession, deleteSession, makeSessionId, type SessionMeta,
} from './audioBuffer';
import { openMic } from './micCapture';
import { shouldFlush, LIVE_LOCK_PREFIX } from '../utils/audioPersist';

const SEGMENT_MS = 20 * 60 * 1000;   // 20 min per segment — запас под лимиты STT
const DEFAULT_MAX_MS = 60 * 60 * 1000; // 60 min hard cap by default
// Сколько звука держим в памяти, пока диск не принимает записи. Выше — запись не прекращаем и
// старые кусочки не выбрасываем (дыра сделала бы сегмент нечитаемым), только предупреждаем один раз.
// 32 кбит/с = ~14 МБ за час, так что порог достижим лишь при сбое записи на диск почти весь приём.
const MAX_PENDING_BYTES = 14 * 1024 * 1024;

/** Итог stop(): incomplete — в расшифровке будет не весь звук приёма, живой текст подменять им нельзя. */
export type StopResult = SessionMeta & { incomplete: boolean };

export interface BufferedRecorderEvents {
  onTick?: (elapsedMs: number) => void;
  onLevel?: (level: number) => void;
  onSegmentSaved?: (idx: number, totalMs: number) => void;
  onMaxReached?: () => void;
  onError?: (err: Error) => void;
}

interface PendingChunk {
  segmentIdx: number;
  blob: Blob;
  mimeType: string;
  segmentMs: number;
  recordedAt: number;
}

export class BufferedRecorder {
  readonly sessionId: string;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  // Завершение onstop текущего рекордера: stop() ждёт его, даже если рекордер уже inactive.
  private recorderStopped: Promise<void> | null = null;
  private events: BufferedRecorderEvents;

  private startedAt: number = 0;
  private endedAt: number = 0;
  private currentSegmentIdx: number = 0;
  private elapsedMs: number = 0;
  private maxMs: number;
  // Поток пришёл снаружи (режим параллельной записи поверх живой расшифровки) —
  // владелец не мы, треки в stop() не глушим, иначе оборвём живой STT.
  private externalStream: MediaStream | null;

  private tickHandle: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelHandle: number | null = null;
  private segmentTimer: number | null = null;

  // Состояние остановки
  private stopRequested = false;
  private captureHalted = false;
  private stopPromise: Promise<StopResult> | null = null;
  private limitHit = false;      // остановлены по лимиту времени
  private captureLost = false;   // не смогли начать следующий сегмент
  private sessionReady: Promise<void> | null = null;

  // Блокировка живой записи
  private releaseLock: (() => void) | null = null;

  // Запись на диск: кусочки в памяти → одна очередь → appendChunk
  private pending: PendingChunk[] = [];
  private pendingBytes = 0;
  private nextSeq = new Map<number, number>();   // segmentIdx → seq следующей записи
  private queue: Promise<void> = Promise.resolve();
  private lastFlushAt = 0;
  private flushOnNextData = false;
  private sessionGone = false;
  private errorActive = false;
  private memoryWarned = false;
  private savedSegments = 0;   // сколько сегментов реально лежит в базе

  private onHide = (e: Event) => {
    // Попытка успеть: сброс без гарантий, ничего не блокирует.
    try {
      if (e.type === 'pagehide' || document.visibilityState === 'hidden') this._requestFlush();
    } catch { /* не критично */ }
  };

  constructor(
    events: BufferedRecorderEvents = {},
    opts: { maxMs?: number; stream?: MediaStream } = {},
  ) {
    this.sessionId = makeSessionId();
    this.events = events;
    this.maxMs = opts.maxMs ?? DEFAULT_MAX_MS;
    this.externalStream = opts.stream ?? null;
  }

  /** Begin recording from the microphone. Persists a session in IndexedDB. */
  async start(consultationType: 'primary' | 'follow-up', doctorId?: string): Promise<void> {
    try {
      await this._start(consultationType, doctorId);
    } catch (err) {
      await this._abortStart();
      throw err;
    }
  }

  private async _start(consultationType: 'primary' | 'follow-up', doctorId?: string): Promise<void> {
    this.stream = this.externalStream ?? (await openMic('in-person')).stream;

    // stop() пришёл, пока ждали микрофон: свой поток отпускаем, захват не начинаем.
    if (this.stopRequested) {
      this._releaseOwnTracks();
      this.stream = null;
      return;
    }

    // Блокировка — до createSession: плашка не должна увидеть идущую запись упавшей.
    await this._acquireLock();
    // stop() мог прийти, пока ждали микрофон: захват не начинаем, stop() всё уже закрыл.
    if (this.stopRequested) {
      this._releaseLock();
      this._releaseOwnTracks();
      this.stream = null;
      return;
    }

    this.startedAt = Date.now();
    this.lastFlushAt = this.startedAt;
    this.elapsedMs = 0;
    this.currentSegmentIdx = 0;

    this.sessionReady = createSession({
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      status: 'recording',
      consultationType,
      doctorId,
    });
    await this.sessionReady;
    if (this.stopRequested) return;   // stop() ждал sessionReady и сам завершит запись

    this._startSegmentRecorder();
    this._startTick();
    this._startLevelMeter();
    try {
      document.addEventListener('visibilitychange', this.onHide);
      window.addEventListener('pagehide', this.onHide);
    } catch { /* не критично */ }
  }

  /**
   * Старт не удался (MediaRecorder, createSession, база): отпускаем свой микрофон (внешний не трогаем),
   * блокировку и убираем пустую заготовку сессии, чтобы она не висела в «Незавершённых». Не бросает.
   */
  private async _abortStart(): Promise<void> {
    this.stopRequested = true;
    this.sessionGone = true;   // кусочки больше не копим и не пишем
    this.pending = [];
    this.pendingBytes = 0;
    this._haltCapture();
    const rec = this.recorder;
    this.recorder = null;
    if (rec) {
      rec.ondataavailable = null;
      rec.onstop = null;
      try { if (rec.state !== 'inactive') rec.stop(); } catch { /* уже остановлен */ }
    }
    this._releaseOwnTracks();
    this.stream = null;
    try { document.removeEventListener('visibilitychange', this.onHide); window.removeEventListener('pagehide', this.onHide); } catch { /* не критично */ }
    this._releaseLock();
    this.startedAt = 0;
    try { await this.sessionReady; } catch { /* createSession упал */ }
    try { await deleteSession(this.sessionId); } catch { /* best effort: purgeOld уберёт */ }
  }

  /**
   * Stop recording, flush the final segment to IndexedDB, mark session completed.
   * Идемпотентен и никогда не отклоняется: сбой записи не должен приводить к стиранию
   * единственной копии. segmentCount — сколько сегментов реально сохранено.
   */
  stop(): Promise<StopResult> {
    if (!this.stopPromise) this.stopPromise = this._doStop();
    return this.stopPromise;
  }

  private async _doStop(): Promise<StopResult> {
    this.stopRequested = true;
    this._haltCapture();

    // Ждём последний кусочек сегмента (stop → dataavailable → onstop). Рекордер мог быть уже остановлен
    // сменой сегмента или лимитом, а его onstop ещё в пути: ждём и его, иначе хвост уйдёт мимо.
    const rec = this.recorder;
    const stopped = this.recorderStopped;
    if (rec) {
      if (rec.state !== 'inactive') { try { rec.stop(); } catch { /* onstop не придёт — выручит таймаут */ } }
      if (stopped) {
        let t: number | undefined;
        await Promise.race([
          stopped,
          new Promise<void>((resolve) => { t = window.setTimeout(resolve, 5000); }),   // onstop не пришёл — не зависаем
        ]);
        clearTimeout(t);
      }
    }

    // Внешний поток глушить нельзя — им продолжает пользоваться живой STT,
    // который сам его и закроет в disconnect().
    this._releaseOwnTracks();
    this.stream = null;

    try { await this.sessionReady; } catch { /* createSession упал — start() уже сообщил */ }

    try { document.removeEventListener('visibilitychange', this.onHide); window.removeEventListener('pagehide', this.onHide); } catch { /* не критично */ }

    // Последний сброс; при сбое одна повторная попытка.
    await this._enqueueFlush();
    if (this.pending.length > 0 && !this.sessionGone) await this._enqueueFlush();

    if (!this.sessionGone && this.sessionReady && this.startedAt) {
      try { await updateSession(this.sessionId, { status: 'completed' }); } catch { /* запись в базе уже есть */ }
    }
    this._releaseLock();

    // Не весь звук в базе: есть несохранённые кусочки, не поднялся следующий сегмент, либо захват кончился
    // по лимиту, а живой текст (внешний поток) шёл дальше.
    const incomplete = this.pending.length > 0 || this.captureLost || (this.limitHit && !!this.externalStream);

    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      durationMs: this.startedAt ? (this.endedAt || Date.now()) - this.startedAt : 0,
      segmentCount: this.savedSegments,
      status: 'completed',
      incomplete,
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /** Остановить захват (не блокировку): лимит времени и stop(). Повторный вызов безвреден. */
  private _haltCapture(): void {
    if (this.captureHalted) return;
    this.captureHalted = true;
    this.endedAt = Date.now();
    this._stopTick();
    this._stopLevelMeter();
    if (this.segmentTimer !== null) { clearTimeout(this.segmentTimer); this.segmentTimer = null; }
  }

  private _acquireLock(): Promise<void> {
    const locks = (typeof navigator !== 'undefined' ? (navigator as any).locks : undefined);
    if (!locks?.request) return Promise.resolve();
    return new Promise<void>((resolve) => {
      try {
        const p = locks.request(`${LIVE_LOCK_PREFIX}${this.sessionId}`, () => new Promise<void>((release) => {
          this.releaseLock = release;
          resolve();
        }));
        Promise.resolve(p).catch(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  /** Свой микрофон отпускаем; внешний поток принадлежит живой расшифровке, его не трогаем. */
  private _releaseOwnTracks(): void {
    if (this.stream && !this.externalStream) for (const track of this.stream.getTracks()) track.stop();
  }

  private _releaseLock(): void {
    const r = this.releaseLock;
    this.releaseLock = null;
    r?.();
  }

  private _startSegmentRecorder(): void {
    if (!this.stream || this.captureHalted) return;

    // Prefer Opus in WebM — best compression
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    // Состояние сегмента — в замыкании: onstop старого рекордера не путается с новым.
    const segmentIdx = this.currentSegmentIdx;
    const segmentStartedAt = Date.now();

    const recorder = new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 32_000 });
    this.recorder = recorder;

    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0 || this.sessionGone) return;
      const now = Date.now();
      this.pending.push({ segmentIdx, blob: e.data, mimeType, segmentMs: now - segmentStartedAt, recordedAt: now });
      this.pendingBytes += e.data.size;
      if (this.pendingBytes > MAX_PENDING_BYTES && !this.memoryWarned) {
        this.memoryWarned = true;
        this.events.onError?.(new Error('Запись не сохраняется на диск и накапливается в памяти браузера'));
      }
      if (this.flushOnNextData || shouldFlush(this.pending.length, this.lastFlushAt, now)) {
        this.flushOnNextData = false;
        this.lastFlushAt = now;
        void this._enqueueFlush();
      }
    };

    let markStopped!: () => void;
    this.recorderStopped = new Promise<void>((resolve) => { markStopped = resolve; });

    recorder.onstop = () => {
      // Последний кусочек сегмента уже пришёл (dataavailable идёт перед stop).
      // Следующий рекордер стартуем сразу и синхронно: звук не прерывается на время записи в базу.
      // После запрошенного стопа или лимита нового не заводим.
      if (!this.stopRequested && !this.captureHalted && this.elapsedMs < this.maxMs && this.stream?.active) {
        this.currentSegmentIdx = segmentIdx + 1;
        try {
          this._startSegmentRecorder();
        } catch (err) {
          // Следующий сегмент не завёлся: запись оборвалась, stop() скажет, что звук неполный.
          this.captureLost = true;
          this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      } else if (!this.stopRequested) {
        // Лимит: захват кончился, свой микрофон гасим (при stop() это сделает он сам).
        this._releaseOwnTracks();
      }
      void this._enqueueFlush(segmentIdx);
      markStopped();
    };

    // Request a data chunk every 1s; на диск они уходят пачками (см. shouldFlush)
    try {
      recorder.start(1000);
    } catch (err) {
      markStopped();   // onstop не придёт: stop() не должен ждать таймаут
      throw err;
    }

    // Schedule segment rollover at 20 min mark
    this.segmentTimer = window.setTimeout(() => {
      this.segmentTimer = null;
      if (recorder.state === 'recording') recorder.stop();
    }, SEGMENT_MS);
  }

  /** Сбросить накопленное как можно скорее: на скрытии вкладки забрать ещё не выданный кусочек и сохранить. */
  private _requestFlush(): void {
    const rec = this.recorder;
    if (rec && rec.state === 'recording') {
      this.flushOnNextData = true;
      try { rec.requestData(); } catch { this.flushOnNextData = false; }
    }
    if (this.pending.length > 0) {
      this.lastFlushAt = Date.now();
      void this._enqueueFlush();
    }
  }

  /** Поставить сброс в единую очередь; afterSegment — сообщить onSegmentSaved, если всё записалось. */
  private _enqueueFlush(afterSegment?: number): Promise<void> {
    const run = async () => {
      await this._flushPending();
      if (afterSegment !== undefined && !this.errorActive && !this.sessionGone) {
        this.events.onSegmentSaved?.(afterSegment, this.elapsedMs);
      }
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  /**
   * Пишем кусочки по порядку, пачками одного сегмента (одна пачка — одна запись, seq без дыр).
   * seq продвигается только после успеха: при сбое пачка остаётся в памяти и уходит со следующим сбросом
   * под тем же seq (put перезапишет, дыры не будет). Не бросает.
   */
  private async _flushPending(): Promise<void> {
    if (this.sessionGone || this.pending.length === 0) return;
    try {
      while (this.pending.length > 0) {
        const first = this.pending[0];
        let n = 1;
        while (n < this.pending.length && this.pending[n].segmentIdx === first.segmentIdx) n++;
        const group = this.pending.slice(0, n);
        const last = group[n - 1];
        const size = group.reduce((a, c) => a + c.blob.size, 0);
        // ArrayBuffer готовим до транзакции IndexedDB
        const data = await new Blob(group.map(c => c.blob), { type: first.mimeType }).arrayBuffer();
        const seq = this.nextSeq.get(first.segmentIdx) ?? 0;
        const res = await appendChunk({
          sessionId: this.sessionId,
          segmentIdx: first.segmentIdx,
          seq,
          data,
          mimeType: first.mimeType,
          segmentMs: last.segmentMs,
          recordedAt: last.recordedAt,
        }, last.recordedAt - this.startedAt);
        if (res === 'session-gone') {
          // Запись удалена (deleteSession): ничего не воскрешаем и больше не пытаемся.
          this.sessionGone = true;
          this.pending = [];
          this.pendingBytes = 0;
          return;
        }
        this.nextSeq.set(first.segmentIdx, seq + 1);
        this.pending.splice(0, n);
        this.pendingBytes -= size;
        this.savedSegments = Math.max(this.savedSegments, first.segmentIdx + 1);
        this.errorActive = false;
        this.memoryWarned = false;
      }
    } catch (err) {
      // Запись продолжается, кусочки остаются в памяти до следующего сброса; сообщаем один раз за эпизод.
      if (!this.errorActive) {
        this.errorActive = true;
        this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private _startTick(): void {
    this.tickHandle = window.setInterval(() => {
      this.elapsedMs = Date.now() - this.startedAt;
      this.events.onTick?.(this.elapsedMs);

      if (this.elapsedMs >= this.maxMs) {
        // Захват останавливаем здесь, блокировку и завершение сессии отпускает только stop().
        this.limitHit = true;
        this.events.onMaxReached?.();
        this._haltCapture();
        const rec = this.recorder;
        if (rec && rec.state === 'recording') { try { rec.stop(); } catch { /* уже остановлен */ } }
        else this._releaseOwnTracks();
      }
    }, 250);
  }

  private _stopTick(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private _startLevelMeter(): void {
    if (!this.stream) return;
    // Некому показывать уровень (параллельная запись поверх живой расшифровки —
    // там свой индикатор) — не крутим requestAnimationFrame впустую весь приём.
    if (!this.events.onLevel) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const src = ctx.createMediaStreamSource(this.stream);
      src.connect(analyser);
      this.audioContext = ctx;
      this.analyser = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser) return;
        analyser.getByteFrequencyData(data);
        // RMS → 0..1
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length) / 255;
        this.events.onLevel?.(rms);
        this.levelHandle = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // AudioContext can fail on some browsers / autoplay policies — non-fatal
    }
  }

  private _stopLevelMeter(): void {
    if (this.levelHandle !== null) {
      cancelAnimationFrame(this.levelHandle);
      this.levelHandle = null;
    }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    if (this.audioContext) { this.audioContext.close().catch(() => {}); this.audioContext = null; }
  }
}
