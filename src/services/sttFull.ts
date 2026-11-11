// ─── High-accuracy full-segment transcription ────────────────────────────────
// Sends a recorded audio segment to /api/stt/full (T-one, offline decoding).
// Handles retries with exponential backoff so a brief network blip doesn't
// throw away the doctor's hour-long consultation.

import { loadSegments } from './audioBuffer';
import { ensureValidSession } from './auth';
import { mergeSessionSegments, type DiarizationStatus, type SessionPart, type SttSegment } from '../utils/speakers';

export interface TranscriptionProgress {
  segmentIdx: number;
  totalSegments: number;
  status: 'uploading' | 'transcribing' | 'done' | 'failed';
  text?: string;
}

export interface FullTranscriptionResult {
  text: string;
  segments: SttSegment[];
  /** true, если в сегментах есть метки голосов (speaker_N) */
  diarized: boolean;
  diarization?: DiarizationStatus;
}

/**
 * Transcribe a single audio blob via T-one. Retries up to 3 times
 * with exponential backoff (2s → 4s → 8s) before throwing.
 */
async function transcribeOne(audio: Blob, signal?: AbortSignal): Promise<Omit<FullTranscriptionResult, 'diarized'>> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Токен берём на каждую попытку: после долгого таймаута прежний мог истечь.
    // Токен живёт 8 ч, вкладка открыта дольше — продлеваем на каждый сегмент
    const session = await ensureValidSession();
    const token = session?.token;
    if (!token) throw new Error('Сессия истекла, войдите заново');
    // Временный сбой обновления: сессия цела, но токен просрочен — запрос заведомо вернул бы 401
    if (session.expiresAt <= Date.now()) throw new Error('Нет связи с сервером');
    // Окончательные ошибки (повтор не поможет) — не ловим общим catch
    let fatal: Error | null = null;
    try {
      const res = await fetch('/api/stt/full', {
        method: 'POST',
        signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': audio.type || 'audio/webm',
        },
        body: audio,
      });

      if (res.status === 400 || res.status === 401 || res.status === 413 || res.status === 429) {
        console.warn(`[STT full] попытка ${attempt}/3: HTTP ${res.status}`);
        if (res.status === 401) fatal = new Error('Сессия истекла, войдите заново');
        else if (res.status === 413) {
          let body: any = {};
          try { body = await res.json(); } catch {}
          fatal = new Error(body?.error || 'Сегмент слишком большой (>25MB)');
        }
        else if (res.status === 429) {
          // rate-limit IP
          let body: any = {};
          try { body = await res.json(); } catch {}
          fatal = new Error(body?.error || 'Слишком много запросов, попробуйте позже');
        } else {
          let errText = '';
          try { errText = await res.text(); } catch {}
          fatal = new Error(`Сервер вернул ${res.status}: ${errText.slice(0, 100)}`);
        }
      } else if (!res.ok) {
        console.warn(`[STT full] попытка ${attempt}/3: HTTP ${res.status}`);
        const errText = await res.text();
        throw new Error(`Сервер вернул ${res.status}: ${errText.slice(0, 100)}`);
      } else {
        const data = await res.json();
        return {
          text: data.text || '',
          segments: Array.isArray(data.segments) ? data.segments : [],
          diarization: data.diarization,
        };
      }
    } catch (err: any) {
      if (signal?.aborted) throw new Error('Отменено');
      if (!String(err?.message ?? '').startsWith('Сервер вернул')) {
        console.warn(`[STT full] попытка ${attempt}/3: ${err?.name || 'Error'}`);
      }
      lastErr = err instanceof TypeError ? new Error('Нет связи с сервером') : err;
      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
        await new Promise(r => setTimeout(r, delay));
      }
    }
    if (fatal) throw fatal;
  }
  throw lastErr || new Error('Не удалось расшифровать сегмент');
}

/**
 * Transcribe an entire recorded session: loads all segments from IndexedDB,
 * transcribes them sequentially, concatenates the results.
 * Calls `onProgress` after each segment so the UI can show "2 of 3 done".
 */
export async function transcribeSession(
  sessionId: string,
  onProgress?: (p: TranscriptionProgress) => void,
  signal?: AbortSignal,
): Promise<FullTranscriptionResult> {
  const segments = await loadSegments(sessionId);
  if (segments.length === 0) throw new Error('Нет аудио сегментов для расшифровки');

  const allText: string[] = [];
  const parts: SessionPart[] = [];

  for (let i = 0; i < segments.length; i++) {
    onProgress?.({ segmentIdx: i, totalSegments: segments.length, status: 'uploading' });

    try {
      const result = await transcribeOne(segments[i].blob, signal);
      allText.push(result.text);
      parts.push({ segments: result.segments, diarization: result.diarization, durationSec: segments[i].durationMs / 1000 });
      onProgress?.({ segmentIdx: i, totalSegments: segments.length, status: 'done' });
    } catch (err: any) {
      onProgress?.({ segmentIdx: i, totalSegments: segments.length, status: 'failed' });
      throw err;
    }
  }

  // Время и номера голосов — сквозные по всей записи (см. mergeSessionSegments)
  const merged = mergeSessionSegments(parts);

  // Запись остаётся в «незавершённых», пока вызывающий код сам её не удалит

  return {
    text: allText.join(' '),
    segments: merged.segments,
    diarized: merged.segments.some(s => s.speaker),
    diarization: merged.diarization,
  };
}
