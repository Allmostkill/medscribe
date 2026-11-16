/**
 * Выбор движка итоговой расшифровки из кабинета (/api/ai/stt-engine*).
 * Живая стенограмма во время приёма всегда от T-one; тут только то, чем
 * расшифровывается запись после «Завершить».
 */
import { getStoredSession } from './auth';

export type SttEngine = 'tone' | 'gigaam';
export type GigaamState = 'absent' | 'downloading' | 'verifying' | 'loading' | 'ready' | 'failed' | 'unknown';

export interface SttEngineStatus {
  selected: SttEngine;
  /** Чем реально расшифровывается запись (GigaAM выбран, но не готов → tone). */
  effective: SttEngine;
  toneReachable: boolean;
  /** Выбор не удалось прочитать (база недоступна): показан T-one по умолчанию. */
  settingsUnavailable?: true;
  gigaam: {
    state: GigaamState;
    downloadedBytes: number;
    totalBytes: number;
    /** Текст ошибки по-русски. */
    error: string | null;
    errorCode: string | null;
  };
}

export type SttResult<T> = { ok: true; value: T } | { ok: false; error: string };

const OFFLINE = 'Нет связи с сервером';

async function call(path: string, init: RequestInit = {}): Promise<{ res: Response; data: any } | null> {
  const token = getStoredSession()?.token;
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch {
    return null;
  }
}

function failure(r: { res: Response; data: any } | null, fallback: string): { ok: false; error: string } {
  if (!r) return { ok: false, error: OFFLINE };
  return { ok: false, error: r.data?.error || `${fallback} (HTTP ${r.res.status})` };
}

export async function getSttEngineStatus(): Promise<SttResult<SttEngineStatus>> {
  const r = await call('/api/ai/stt-engine');
  if (!r || !r.res.ok) return failure(r, 'Не удалось узнать состояние распознавания речи');
  return { ok: true, value: r.data as SttEngineStatus };
}

export async function setSttEngine(engine: SttEngine): Promise<SttResult<SttEngineStatus>> {
  const r = await call('/api/ai/stt-engine', { method: 'PUT', body: JSON.stringify({ engine }) });
  if (!r || !r.res.ok) return failure(r, 'Не удалось сохранить выбор распознавания речи');
  return { ok: true, value: r.data.status as SttEngineStatus };
}

/** Повторить загрузку модели GigaAM (после сбоя). */
export async function retryGigaamDownload(): Promise<SttResult<SttEngineStatus>> {
  const r = await call('/api/ai/stt-engine/download', { method: 'POST' });
  if (!r || !r.res.ok) return failure(r, 'Не удалось начать загрузку модели');
  return { ok: true, value: r.data.status as SttEngineStatus };
}
