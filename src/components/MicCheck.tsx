import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { mediaErrorMessage } from '../services/mediaErrors';
import { openMic } from '../services/micCapture';
import { describeProcessingForDoctor } from '../utils/micConstraints';

const CHECK_MS = 5000;
const HEARD_RMS = 0.02;

type Phase = 'idle' | 'checking' | 'heard' | 'quiet' | 'error';

export default function MicCheck() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const start = async () => {
    cleanupRef.current?.();
    setPhase('checking');
    setLevel(0);
    setError('');
    setProcessing('');

    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const cleanup = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
      if (ctx) { try { void ctx.close(); } catch { /* уже закрыт */ } }
      stream = null;
      ctx = null;
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;

    try {
      const opened = await openMic('in-person');
      stream = opened.stream;
      setProcessing(describeProcessingForDoctor(opened.line));
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }

      const Ctx: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let peak = 0;

      const tick = () => {
        if (stopped) return;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        if (rms > peak) peak = rms;
        setLevel(Math.min(1, rms * 8));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      timer = setTimeout(() => {
        const heard = peak > HEARD_RMS;
        cleanup();
        setLevel(0);
        setPhase(heard ? 'heard' : 'quiet');
      }, CHECK_MS);
    } catch (err) {
      cleanup();
      setError(mediaErrorMessage(err, 'microphone'));
      setPhase('error');
    }
  };

  return (
    <div className="bg-white border border-ds-200 rounded-xl shadow-sm mb-3 px-5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-ds-900 font-semibold">
          <Mic size={14} className="text-ds-600" />
          Микрофон
        </div>
        <button
          type="button"
          onClick={start}
          disabled={phase === 'checking'}
          className="text-[11px] font-semibold px-2.5 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          {phase === 'checking' ? 'Говорите…' : 'Проверить микрофон'}
        </button>
      </div>
      {phase === 'checking' && (
        <div className="mt-2 h-2 bg-ds-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-[width] duration-75"
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
      )}
      {phase === 'heard' && (
        <p className="mt-2 text-[12px] text-success-700">Микрофон вас слышит.</p>
      )}
      {(phase === 'heard' || phase === 'quiet') && processing && (
        <p className="mt-1 text-[11px] text-ds-600">{processing}</p>
      )}
      {phase === 'quiet' && (
        <p className="mt-2 text-[12px] text-warning-900">
          Звук очень тихий или его нет — проверьте, какой микрофон выбран в системе и в браузере (значок замка в адресной строке).
        </p>
      )}
      {phase === 'error' && (
        <p className="mt-2 text-[12px] text-error-600">{error}</p>
      )}
    </div>
  );
}
