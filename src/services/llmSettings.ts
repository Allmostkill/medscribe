/**
 * Настройка языковой модели из кабинета (/api/ai/llm-*).
 * Ключ сервер не отдаёт: приходит только hasKey и маска. Ключ и пароль
 * живут в состоянии формы и нигде не сохраняются.
 */
import { getStoredSession } from './auth';

export type LlmProvider = 'ollama' | 'cloud';

export interface LlmStatus {
  configured: boolean;
  /** Настройки не удалось прочитать (база временно недоступна): «не подключена» тут неверно. */
  unavailable?: boolean;
  source: 'cabinet' | 'env' | null;
  model?: string;
  host?: string;
  hasKey?: boolean;
  jsonMode?: boolean;
  timeoutMs?: number;
  envConfigured: boolean;
  settings: null | {
    provider: LlmProvider;
    baseUrl: string;
    model: string;
    hasKey: boolean;
    keyMask: string | null;
    jsonMode: boolean;
    timeoutMs: number;
    updatedAt: string;
    /** Когда подтверждена передача текста провайдеру (ISO); null — не подтверждалась. */
    transferAckAt?: string | null;
  };
}

export interface LlmDraft {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  /** undefined — не менять ключ; '' — убрать. */
  apiKey?: string;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface OllamaModel { name: string; sizeGb: number | null; parameterSize: string | null; cloud: boolean }
export type OllamaDiscovery =
  | { found: true; baseUrl: string; models: OllamaModel[] }
  | { found: false; hint: string };

export type LlmTestResult =
  | { ok: true; latencyMs: number; jsonOk: boolean }
  | { ok: false; code?: string; error: string };

export type LlmResult<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };

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

function failure(r: { res: Response; data: any } | null, fallback: string): { ok: false; error: string; code?: string } {
  if (!r) return { ok: false, error: OFFLINE };
  return { ok: false, error: r.data?.error || `${fallback} (HTTP ${r.res.status})`, code: r.data?.code };
}

export async function getLlmStatus(): Promise<LlmResult<LlmStatus>> {
  const r = await call('/api/ai/llm-status');
  if (!r || !r.res.ok) return failure(r, 'Не удалось узнать состояние модели');
  return { ok: true, value: r.data as LlmStatus };
}

export async function saveLlmSettings(
  draft: LlmDraft,
  password: string,
  acknowledgeTransfer: boolean,
): Promise<LlmResult<LlmStatus>> {
  const r = await call('/api/ai/llm-settings', {
    method: 'PUT',
    body: JSON.stringify({ ...draft, password, ...(acknowledgeTransfer ? { acknowledgeTransfer: true } : {}) }),
  });
  if (!r || !r.res.ok) return failure(r, 'Не удалось сохранить настройки модели');
  return { ok: true, value: r.data.status as LlmStatus };
}

export async function deleteLlmSettings(password: string): Promise<LlmResult<LlmStatus>> {
  const r = await call('/api/ai/llm-settings', { method: 'DELETE', body: JSON.stringify({ password }) });
  if (!r || !r.res.ok) return failure(r, 'Не удалось отключить модель');
  return { ok: true, value: r.data.status as LlmStatus };
}

/** Без черновика проверяет действующую конфигурацию. */
export async function testLlm(draft?: LlmDraft): Promise<LlmTestResult> {
  const r = await call('/api/ai/llm-test', { method: 'POST', body: draft ? JSON.stringify(draft) : undefined });
  if (!r) return { ok: false, error: OFFLINE };
  if (r.data?.ok === true) return { ok: true, latencyMs: r.data.latencyMs, jsonOk: r.data.jsonOk !== false };
  return { ok: false, code: r.data?.code, error: r.data?.error || `Проверка не удалась (HTTP ${r.res.status})` };
}

export async function discoverOllama(): Promise<LlmResult<OllamaDiscovery>> {
  const r = await call('/api/ai/ollama/discover');
  if (!r || !r.res.ok) return failure(r, 'Не удалось искать Ollama');
  return { ok: true, value: r.data as OllamaDiscovery };
}
