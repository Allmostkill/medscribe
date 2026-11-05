/**
 * Клиент языковой модели: любой OpenAI-совместимый /chat/completions.
 *
 * Конфигурация: из личного кабинета (см. ai/llmSettings.ts) или из env —
 * LLM_BASE_URL + LLM_MODEL (+ LLM_API_KEY).
 * Промпт и ответ модели не логируются — в них медицинские данные.
 */
import { Agent, fetch as undiciFetch, type Dispatcher } from 'undici';
import { makeGuardedLookup, LLM_BLOCKED_CODE, LLM_UNCONFIRMED_CODE, type AddressRules } from './ai/llmSettingsRules';

export type LlmErrorCode = 'not_configured' | 'auth' | 'payment' | 'rate_limit' | 'not_found'
  | 'bad_request' | 'bad_url' | 'blocked_url' | 'redirect' | 'server' | 'timeout' | 'network' | 'bad_response'
  | 'settings_unavailable' | 'transfer_unconfirmed';

// Типизированная ошибка модели: message остаётся прежним (начинается с «LLM», без данных),
// а code позволяет показать врачу понятную причину (см. llmErrorMessage).
export class LlmError extends Error {
  code: LlmErrorCode;
  status?: number;
  constructor(code: LlmErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'LlmError';
    this.code = code;
    this.status = status;
  }
}

const LLM_ERROR_MESSAGES: Record<LlmErrorCode | 'bad_json', string> = {
  not_configured: 'Языковая модель не подключена. Подключите её: Профиль → Настройки ИИ.',
  auth: 'Провайдер языковой модели отклонил ключ. Проверьте ключ в Профиль → Настройки ИИ: нет ли лишних пробелов, не отозван ли ключ.',
  payment: 'У провайдера языковой модели закончились средства. Пополните баланс.',
  rate_limit: 'Провайдер временно ограничил запросы. Подождите минуту и повторите; если повторяется — проверьте баланс.',
  not_found: 'Модель не найдена. Проверьте название модели и адрес в Профиль → Настройки ИИ (адрес без /chat/completions на конце).',
  bad_request: 'Провайдер не принял запрос. Если модель не поддерживает JSON-режим, выключите его в Профиль → Настройки ИИ → Дополнительно.',
  bad_url: 'Адрес модели не должен содержать логин и пароль — ключ вводится в отдельном поле (Профиль → Настройки ИИ).',
  blocked_url: 'Этот адрес нельзя использовать для языковой модели: он указывает на служебный адрес.',
  redirect: 'Адрес модели перенаправляет на другой адрес. Укажите конечный адрес API из документации провайдера.',
  server: 'Сервис языковой модели сейчас недоступен (ошибка на стороне провайдера). Повторите позже.',
  timeout: 'Языковая модель не ответила вовремя. Повторите; для локальной модели увеличьте время ожидания в Профиль → Настройки ИИ → Дополнительно.',
  network: 'Нет связи с сервисом языковой модели. Проверьте интернет и адрес в Профиль → Настройки ИИ (для Ollama — запущена ли она).',
  bad_response: 'Модель вернула ответ в неожиданном формате. Повторите; если повторяется — выключите JSON-режим в Профиль → Настройки ИИ → Дополнительно.',
  settings_unavailable: 'Не удалось прочитать настройки языковой модели из личного кабинета (база данных недоступна). Текст приёма не отправлен. Повторите через минуту.',
  transfer_unconfirmed: 'Адрес модели стал указывать в интернет; подтвердите передачу в Профиль → Настройки ИИ.',
  bad_json: 'Модель вернула ответ в неожиданном формате. Повторите; если повторяется — выключите JSON-режим в Профиль → Настройки ИИ → Дополнительно.',
};

export function llmErrorMessage(code: LlmErrorCode | 'bad_json'): string {
  return LLM_ERROR_MESSAGES[code];
}

function codeForStatus(status: number): LlmErrorCode {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'payment';
  if (status === 429) return 'rate_limit';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 422) return 'bad_request';
  return 'server';
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  jsonMode: boolean;
  timeoutMs: number;
  // Ollama: просим модель отвечать без рассуждений (иначе ответ уходит в reasoning).
  noThinking?: boolean;
  // Соединение с проверкой адреса в момент подключения (для адресов из кабинета).
  dispatcher?: Dispatcher;
}

// Агент, который при каждом соединении заново разрешает имя и проверяет все адреса
// (DNS-rebinding): запрещённый адрес → ошибка соединения, которую callLlm превращает
// в blocked_url. Один агент на адрес модели.
export function createGuardedDispatcher(baseUrl: string, rules: AddressRules & {
  allowPublic?: boolean;
  resolve?: (host: string) => Promise<{ address: string; family: number }[]>;
} = {}): Dispatcher {
  return new Agent({
    connect: { lookup: makeGuardedLookup(baseUrl, rules) as any },
    // Время ожидания задаёт callLlm (до 10 минут); встроенные 5 минут не мешают.
    headersTimeout: 0,
    bodyTimeout: 0,
  });
}

// В цепочке причин ошибки соединения есть отказ проверки адреса?
function causeHasCode(err: any, code: string, depth = 0): boolean {
  if (!err || depth > 4) return false;
  if (err.code === code) return true;
  if (causeHasCode(err.cause, code, depth + 1)) return true;
  return Array.isArray(err.errors) && err.errors.some((e: any) => causeHasCode(e, code, depth + 1));
}

// Ответ модели больше этого размера не читаем: нормальный ответ — килобайты.
export const MAX_LLM_RESPONSE_BYTES = 5 * 1024 * 1024;

async function readLimitedText(res: { headers: { get(n: string): string | null }; body: ReadableStream<Uint8Array> | null },
  max: number): Promise<string> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    void res.body?.cancel().catch(() => {});
    throw new LlmError('bad_response', 'LLM: ответ слишком большой');
  }
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      void reader.cancel().catch(() => {});
      throw new LlmError('bad_response', 'LLM: ответ слишком большой');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function resolveLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const jsonMode = env.LLM_JSON_MODE !== 'false';
  const timeoutMs = Number(env.LLM_TIMEOUT_MS) || 60000;
  const baseUrlRaw = (env.LLM_BASE_URL || '').trim();
  const model = (env.LLM_MODEL || '').trim();

  if (baseUrlRaw && model) {
    return {
      baseUrl: baseUrlRaw.replace(/\/+$/, ''),
      apiKey: (env.LLM_API_KEY || '').trim(),
      model,
      jsonMode,
      timeoutMs,
    };
  }

  return null;
}

// Некоторые модели оборачивают JSON в ```json … ``` даже в json-режиме.
function stripCodeFence(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  return m ? m[1].trim() : text;
}

export async function callLlm(cfg: LlmConfig, prompt: string, systemInstruction?: string): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const body: Record<string, unknown> = { model: cfg.model, messages, temperature: 0.3 };
  if (cfg.jsonMode) body.response_format = { type: 'json_object' };
  if (cfg.noThinking) body.reasoning_effort = 'none';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

  // fetch не принимает адрес с user:pass@ и падает как «нет связи» — говорим причину прямо.
  try {
    const u = new URL(cfg.baseUrl);
    if (u.username || u.password) throw new LlmError('bad_url', 'LLM: адрес модели содержит логин или пароль');
  } catch (e) {
    if (e instanceof LlmError) throw e;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    // Один запрос с заданным телом; перенаправление и ошибки HTTP разбираются здесь.
    const send = async (reqBody: Record<string, unknown>): Promise<any> => {
      const init = {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
        signal: controller.signal,
        // Перенаправление могло бы унести ключ и текст приёма на другой адрес.
        redirect: 'manual' as const,
      };
      // С проверяющим агентом идём через fetch самого undici: так версия агента и клиента совпадает.
      const r: any = cfg.dispatcher
        ? await undiciFetch(`${cfg.baseUrl}/chat/completions`, { ...init, dispatcher: cfg.dispatcher })
        : await fetch(`${cfg.baseUrl}/chat/completions`, init);
      if (r.status >= 300 && r.status < 400) {
        void r.body?.cancel().catch(() => {});
        throw new LlmError('redirect', 'LLM: перенаправление', r.status);
      }
      return r;
    };
    let res = await send(body);
    // Часть моделей Ollama (gpt-oss, *-cloud) не принимает reasoning_effort: 'none' — один повтор без него.
    if (res.status === 400 && cfg.noThinking) {
      void res.body?.cancel().catch(() => {});
      const { reasoning_effort: _drop, ...plain } = body;
      res = await send(plain);
    }
    if (!res.ok) {
      void res.body?.cancel().catch(() => {});
      throw new LlmError(codeForStatus(res.status), `LLM HTTP ${res.status}`, res.status);
    }
    // Ответ модели содержит медицинские данные: при невалидном JSON в ошибку идёт только имя.
    const raw = await readLimitedText(res, MAX_LLM_RESPONSE_BYTES);
    let data: any;
    try { data = JSON.parse(raw); }
    catch (parseErr: any) { throw new LlmError('bad_response', `LLM: ответ не JSON (${parseErr?.name || 'Error'})`); }
    const message = data?.choices?.[0]?.message;
    let text = stripCodeFence(String(message?.content ?? ''));
    // Думающие модели Ollama кладут ответ в reasoning, а content оставляют пустым: только для Ollama,
    // в JSON-режиме и при штатном завершении (не 'length') берём из рассуждения объект от первой { до последней }.
    const finish = data?.choices?.[0]?.finish_reason;
    if (!text.trim() && cfg.jsonMode && cfg.noThinking && (finish == null || finish === 'stop')) {
      for (const r of [message?.reasoning, message?.reasoning_content]) {
        if (typeof r !== 'string' || !r.trim()) continue;
        const a = r.indexOf('{'), b = r.lastIndexOf('}');
        if (a < 0 || b <= a) continue;
        const cand = r.slice(a, b + 1);
        try { JSON.parse(cand); text = cand; break; } catch { /* не JSON */ }
      }
    }
    if (!text.trim()) throw new LlmError('bad_response', 'LLM: пустой ответ');
    return text;
  } catch (err: any) {
    if (err instanceof LlmError) throw err;
    if (err?.name === 'AbortError') throw new LlmError('timeout', `LLM: таймаут ${cfg.timeoutMs} мс`);
    if (causeHasCode(err, LLM_UNCONFIRMED_CODE)) throw new LlmError('transfer_unconfirmed', 'LLM: адрес стал внешним, передача не подтверждена');
    if (causeHasCode(err, LLM_BLOCKED_CODE)) throw new LlmError('blocked_url', 'LLM: адрес не прошёл проверку при соединении');
    // fetch при сбое соединения бросает TypeError, undici — свои ошибки (в том числе ClientClosedError
    // при смене адреса): наружу идёт только код сети, без текста исходной ошибки.
    throw new LlmError('network', 'LLM: нет связи с сервисом');
  } finally {
    clearTimeout(timer);
  }
}
