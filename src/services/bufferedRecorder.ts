// ─── Buffered audio recorder ──────────────────────────────────────────────────
// Used by stenographer mode: records the entire consultation locally first,
// then sends the full audio to T-one for high-accuracy offline transcription
// when the doctor presses "Завершить".
//
// Key features:
//   - Auto-split into 20-minute segments (запас под лимит размера файла STT)
//   - Each segment written to IndexedDB as soon as it's complete — survives
//     network drops, tab close, browser crash
//   - Live audio level metering (for the recording-in-progress UI)
//   - Hard cap configurable (default 60 min)

import { saveSegment, updateSession, createSession, makeSessionId, type SessionMeta } from './audioBuffer';

const SEGMENT_MS = 20 * 60 * 1000;   // 20 min per segment — запас под лимиты STT
const DEFAULT_MAX_MS = 60 * 60 * 1000; // 60 min hard cap by default

export interface BufferedRecorderEvents {
  onTick?: (elapsedMs: number) => void;
  onLevel?: (level: number) => void;
  onSegmentSaved?: (idx: number, totalMs: number) => void;
  onMaxReached?: () => void;
  onError?: (err: Error) => void;
}

export class BufferedRecorder {
  readonly sessionId: string;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private events: BufferedRecorderEvents;

  private startedAt: number = 0;
  private segmentStartedAt: number = 0;
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

  private finalSegmentResolve: (() => void) | null = null;
  private chunkBuffer: BlobPart[] = [];

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
    this.stream = this.externalStream ?? await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000, channelCount: 1 },
    });

    this.startedAt = Date.now();
    this.segmentStartedAt = this.startedAt;
    this.elapsedMs = 0;
    this.currentSegmentIdx = 0;

    await createSession({
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      status: 'recording',
      consultationType,
      doctorId,
    });

    this._startSegmentRecorder();
    this._startTick();
    this._startLevelMeter();
  }

  /** Stop recording, flush the final segment to IndexedDB, mark session completed. */
  async stop(): Promise<SessionMeta> {
    this._stopTick();
    this._stopLevelMeter();

    // Wait for the final segment to fully save before resolving
    if (this.recorder && this.recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        this.finalSegmentResolve = resolve;
        this.recorder!.stop();
      });
    }

    // Внешний поток глушить нельзя — им продолжает пользоваться живой STT,
    // который сам его и закроет в disconnect().
    if (this.stream && !this.externalStream) {
      for (const track of this.stream.getTracks()) track.stop();
    }
    this.stream = null;

    await updateSession(this.sessionId, { status: 'completed' });

    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      durationMs: Date.now() - this.startedAt,
      segmentCount: this.currentSegmentIdx + 1,
      status: 'completed',
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private _startSegmentRecorder(): void {
    if (!this.stream) return;

    // Prefer Opus in WebM — best compression
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 32_000 });
    this.recorder = recorder;
    this.chunkBuffer = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunkBuffer.push(e.data);
    };

    recorder.onstop = async () => {
      // Flush this segment to IndexedDB
      try {
        const blob = new Blob(this.chunkBuffer, { type: mimeType });
        const segmentMs = Date.now() - this.segmentStartedAt;
        await saveSegment({
          sessionId: this.sessionId,
          segmentIdx: this.currentSegmentIdx,
          blob,
          durationMs: segmentMs,
          recordedAt: Date.now(),
        });
        this.events.onSegmentSaved?.(this.currentSegmentIdx, this.elapsedMs);
      } catch (err) {
        this.events.onError?.(err as Error);
      }

      // If we were rolling over, start the next segment immediately
      if (this.finalSegmentResolve) {
        const r = this.finalSegmentResolve;
        this.finalSegmentResolve = null;
        r();
      } else if (this.elapsedMs < this.maxMs && this.stream?.active) {
        this.currentSegmentIdx++;
        this.segmentStartedAt = Date.now();
        this.chunkBuffer = [];
        this._startSegmentRecorder();
      }
    };

    // Request a data chunk every 1s so we have something to flush on crash
    recorder.start(1000);

    // Schedule segment rollover at 20 min mark
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, SEGMENT_MS);
  }

  private _startTick(): void {
    this.tickHandle = window.setInterval(() => {
      this.elapsedMs = Date.now() - this.startedAt;
      this.events.onTick?.(this.elapsedMs);

      if (this.elapsedMs >= this.maxMs) {
        this.events.onMaxReached?.();
        this.stop().catch(() => {});
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
