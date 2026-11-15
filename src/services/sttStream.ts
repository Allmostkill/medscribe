/**
 * SecureMedicalSTT — клиент STT через self-host T-one. Режимы: микрофон врача
 * (очный приём) или звонок — звук вкладки браузера, смешанный с микрофоном
 * врача в один поток. Стриминг настоящий: непрерывный PCM int16 8 кГц гоним в
 * /ws/stt/tone (WebSocket), сервер проксирует в tone-service, тот тянет state
 * через всю запись и отдаёт фразы по готовности.
 *
 * Диаризация не делается на лету: реплики помечаются 'unknown',
 * финальная LLM-обработка в /api/ai/analyze расставит Врач/Пациент по содержанию.
 */

import { getStoredSession } from './auth';
import { mediaErrorMessage } from './mediaErrors';
import { openMic } from './micCapture';

export interface TranscriptionPayload {
  id: string;
  text: string;
  speaker: 'doctor' | 'patient' | 'unknown';
  isFinal: boolean;
}

export type SttStatusEvent =
  | { type: 'source-ended' }
  | { type: 'stream-lost'; reason: 'auth' | 'unavailable' };

// connect() отменили (disconnect) пока открыт диалог доступа: не ошибка для врача.
class ConnectCancelled extends Error {}

export class SecureMedicalSTT {
  // Номер попытки connect(); disconnect() его увеличивает, и опоздавший захват
  // понимает, что запись уже не нужна.
  private connectGen = 0;
  private mediaStream: MediaStream | null = null;
  // Исходные захваты (показ вкладки, микрофон) и контекст, где они смешаны, —
  // в режиме звонка mediaStream это выход микшера, а не сами захваты.
  private sourceStreams: MediaStream[] = [];
  private mixCtx: AudioContext | null = null;
  // T-one streaming (real-time стенограмма)
  private toneWs: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private onMessage: (payload: TranscriptionPayload) => void;
  private specialty: string;
  private isRecording: boolean = false;
  private mode: 'microphone' | 'system';
  private onStatus?: (e: SttStatusEvent) => void;

  constructor(
    specialty: string,
    onMessage: (payload: TranscriptionPayload) => void,
    mode: 'microphone' | 'system' = 'microphone',
    onStatus?: (e: SttStatusEvent) => void,
  ) {
    this.specialty = specialty;
    this.onMessage = onMessage;
    this.mode = mode;
    this.onStatus = onStatus;
    void this.specialty; // suppress unused-warn — пригодится для key-term boost
  }

  // ─── Media acquisition ───────────────────────────────────────────────────

  private async _acquireMediaStream(gen: number): Promise<void> {
    if (this.mediaStream && this.mediaStream.active) return;
    // Если disconnect() вызвали, пока открыт диалог getDisplayMedia/getUserMedia,
    // захват нельзя оставлять активным: глушим всё полученное и выходим.
    const cancelled = () => gen !== this.connectGen;
    const abort = (streams: MediaStream[], ctx?: AudioContext): never => {
      streams.forEach((st) => st.getTracks().forEach((t) => t.stop()));
      if (ctx) { try { void ctx.close(); } catch {} }
      throw new ConnectCancelled();
    };

    if (this.mode === 'system') {
      // getDisplayMedia обязан быть первым await в цепочке от клика: иначе
      // браузер потеряет жест пользователя и откажет в показе вкладки.
      let display: MediaStream;
      try {
        display = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { width: 1, height: 1 },
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          systemAudio: 'include',
          selfBrowserSurface: 'exclude',
        } as any);
      } catch (err) {
        throw new Error(mediaErrorMessage(err, 'tab'));
      }
      if (cancelled()) abort([display]);
      display.getVideoTracks().forEach((t) => t.stop());
      const tabTracks = display.getAudioTracks();
      if (tabTracks.length === 0) {
        display.getTracks().forEach((t) => t.stop());
        throw new Error(
          'Звук вкладки не выбран. Нажмите «Записать звонок» ещё раз, выберите вкладку со звонком и включите «Также поделиться звуком вкладки».',
        );
      }

      let mic: MediaStream;
      try {
        mic = (await openMic('call-mic')).stream;
      } catch (err) {
        if (cancelled()) abort([display]);
        display.getTracks().forEach((t) => t.stop());
        throw new Error(mediaErrorMessage(err, 'microphone'));
      }
      if (cancelled()) abort([display, mic]);

      // Смешиваем вкладку и микрофон в один поток. К ctx.destination НЕ
      // подключаем: иначе голос собеседника зазвучит из колонок второй раз.
      const Ctx: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
      if (cancelled()) abort([display, mic], ctx);
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(new MediaStream(tabTracks)).connect(dest);
      ctx.createMediaStreamSource(mic).connect(dest);

      this.mixCtx = ctx;
      this.sourceStreams = [display, mic];
      this.mediaStream = dest.stream;

      tabTracks[0].addEventListener('ended', () => {
        if (this.isRecording) this.onStatus?.({ type: 'source-ended' });
      });
    } else {
      let mic: MediaStream;
      try {
        mic = (await openMic('in-person')).stream;
      } catch (err) {
        if (cancelled()) throw new ConnectCancelled();
        throw new Error(mediaErrorMessage(err, 'microphone'));
      }
      if (cancelled()) abort([mic]);
      this.mediaStream = mic;
      this.sourceStreams = [this.mediaStream];
    }
  }

  private _getToken(): string {
    return getStoredSession()?.token ?? '';
  }

  // ─── T-one (потоковый PCM через WebSocket) ───────────────────────────────
  // T-one — стриминговая модель: гоним непрерывный PCM int16 8 кГц в /ws/stt/tone,
  // сервер проксирует в tone-service, который тянет state через всю запись и
  // отдаёт фразы по мере готовности. Это и есть «база» real-time стенограммы.

  private _downsampleTo8k(input: Float32Array, inRate: number): Float32Array {
    if (inRate === 8000) return input;
    const ratio = inRate / 8000;
    const outLen = Math.floor(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      let sum = 0, c = 0;
      for (let j = start; j < end && j < input.length; j++) { sum += input[j]; c++; }
      out[i] = c ? sum / c : (input[start] || 0); // усреднение даёт грубый анти-алиас
    }
    return out;
  }

  private async _startToneStream(): Promise<void> {
    const token = this._getToken();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    // Токен уходит подпротоколом, а не в query: nginx пишет полный URI в
    // access_log, и восьмичасовой токен врача оседал там при каждом старте
    // записи, а заодно в истории браузера.
    const wsUrl = `${proto}://${location.host}/ws/stt/tone`;
    const socket = new WebSocket(wsUrl, ['bearer', token]);
    socket.binaryType = 'arraybuffer';
    this.toneWs = socket;

    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.text?.trim()) {
          this.onMessage({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            text: data.text.trim(),
            speaker: 'unknown', // T-one не диаризует — Врач/Пациент разметит LLM в конце
            isFinal: true,
          });
        }
      } catch { /* ignore non-JSON frames */ }
    };
    socket.onerror = (e) => console.warn('[STT T-one] ws error:', e);
    socket.onclose = (ev) => {
      if (this.isRecording && this.toneWs === socket) {
        this.onStatus?.({ type: 'stream-lost', reason: ev.code === 1008 ? 'auth' : 'unavailable' });
      }
    };

    // AudioContext на 8 кГц — частота модели. Chrome/Edge ресемплят микрофон сами;
    // Safari может проигнорить sampleRate → подстрахуемся ручным даунсемплом.
    const Ctx: typeof AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    let ctx: AudioContext;
    try { ctx = new Ctx({ sampleRate: 8000 }); } catch { ctx = new Ctx(); }
    this.audioCtx = ctx;

    const source = ctx.createMediaStreamSource(this.mediaStream!);
    this.sourceNode = source;
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    this.processorNode = processor;
    const ctxRate = ctx.sampleRate;

    processor.onaudioprocess = (e) => {
      if (!this.isRecording || socket.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const samples = this._downsampleTo8k(input, ctxRate);
      const pcm = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      socket.send(pcm.buffer);
    };

    // ScriptProcessor должен быть в графе до destination, но звук возвращать в
    // колонки нельзя (фидбэк) → пропускаем через gain=0.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);
  }

  private _stopToneStream(): void {
    if (this.toneWs) {
      try { if (this.toneWs.readyState === WebSocket.OPEN) this.toneWs.send(JSON.stringify({ type: 'flush' })); } catch {}
      try { this.toneWs.close(); } catch {}
      this.toneWs = null;
    }
    if (this.processorNode) {
      try { this.processorNode.onaudioprocess = null; this.processorNode.disconnect(); } catch {}
      this.processorNode = null;
    }
    if (this.sourceNode) { try { this.sourceNode.disconnect(); } catch {} this.sourceNode = null; }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; }
  }

  // ─── Connect / disconnect ────────────────────────────────────────────────

  /**
   * Поток, захваченный в connect(): микрофон врача, а в режиме звонка —
   * смешанный (звук вкладки + микрофон). Нужен параллельной записи
   * полного аудио (BufferedRecorder), чтобы не открывать второй getUserMedia
   * на тот же источник: два независимых захвата — это лишняя обработка
   * (эхоподавление считается дважды) и лишний расход батареи на ноутбуке
   * врача. Владелец потока — этот класс: он же его и останавливает в
   * disconnect(), потребитель треки не трогает.
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  async connect(): Promise<void> {
    this.isRecording = true;
    const gen = ++this.connectGen;
    try {
      await this._acquireMediaStream(gen);
      if (gen !== this.connectGen) return;
      await this._startToneStream();
    } catch (err) {
      // disconnect() уже вызвали (врач нажал «стоп» при открытом диалоге) —
      // это не ошибка, показывать её нечего.
      if (gen !== this.connectGen) return;
      this.disconnect();
      throw err;
    }
  }

  disconnect(): void {
    this.connectGen++;
    this.isRecording = false;
    this._stopToneStream();
    const all = [...this.sourceStreams, ...(this.mediaStream ? [this.mediaStream] : [])];
    all.forEach((st) => st.getTracks().forEach((t) => t.stop()));
    if (this.mixCtx) { try { void this.mixCtx.close(); } catch {} this.mixCtx = null; }
    this.sourceStreams = [];
    this.mediaStream = null;
  }
}
