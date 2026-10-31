/**
 * Настройки языковой модели из личного кабинета: хранение в таблице llm_settings
 * (одна строка), ключ API шифруется, действующая конфигурация кешируется.
 *
 * Приоритет: кабинет → .env → не подключена. Ключ не попадает ни в журнал, ни в ответы.
 */
import os from 'node:os';
import { db } from '../context';
import { encryptData, decryptData } from '../crypto';
import { logWarn } from '../errors/logger';
import { safeErr } from '../logSafe';
import { resolveLlmConfig, createGuardedDispatcher, LlmError, type LlmConfig } from '../llm';
import type { Dispatcher } from 'undici';
import { checkLlmBaseUrl, type LlmProvider } from './llmSettingsRules';

export interface StoredLlmSettings {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  jsonMode: boolean;
  timeoutMs: number;
  transferAckAt: string | null;   // когда врач подтвердил передачу текста провайдеру
  updatedAt: string;
}

export interface EffectiveLlmConfig extends LlmConfig {
  source: 'cabinet' | 'env';
  provider: LlmProvider | null;
}

const CACHE_TTL_MS = 30_000;
const RETRY_AFTER_ERROR_MS = 5_000;
// Без своего срока клиент базы при сбое повторяет запрос около 7 секунд.
const DB_TIMEOUT_MS = 1500;

const dbSignal = () => AbortSignal.timeout(DB_TIMEOUT_MS);

export async function loadStoredLlmSettings(): Promise<StoredLlmSettings | null> {
  const { data, error } = await db.from('llm_settings').select('*').eq('id', 1)
    .abortSignal(dbSignal()).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let apiKey: string | null = null;
  if (data.api_key_enc) {
    try { apiKey = decryptData(String(data.api_key_enc)); }
    catch (e) { logWarn('AI_013', safeErr(e)); }
  }
  return {
    provider: data.provider === 'cloud' ? 'cloud' : 'ollama',
    baseUrl: String(data.base_url),
    model: String(data.model),
    apiKey,
    jsonMode: data.json_mode !== false,
    timeoutMs: Number(data.timeout_ms),
    transferAckAt: data.transfer_ack_at ? String(data.transfer_ack_at) : null,
    updatedAt: String(data.updated_at),
  };
}

// transferAck: врач поставил галочку «текст приёма уйдёт провайдеру» (время пишется в transfer_ack_at).
export async function saveStoredLlmSettings(s: Omit<StoredLlmSettings, 'updatedAt' | 'transferAckAt'> & { transferAck: boolean }): Promise<void> {
  const { error } = await db.from('llm_settings').upsert({
    id: 1,
    provider: s.provider,
    base_url: s.baseUrl,
    model: s.model,
    api_key_enc: s.apiKey ? encryptData(s.apiKey) : null,
    json_mode: s.jsonMode,
    timeout_ms: s.timeoutMs,
    transfer_ack_at: s.transferAck ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).abortSignal(dbSignal());
  invalidateLlmConfigCache();
  if (error) throw error;
}

export async function deleteStoredLlmSettings(): Promise<void> {
  const { error } = await db.from('llm_settings').delete().eq('id', 1).abortSignal(dbSignal());
  invalidateLlmConfigCache();
  if (error) throw error;
}

// ── Действующая конфигурация ─────────────────────────────────────────────────

// known=false: базу прочитать не удалось и прежнего значения нет. Тогда нельзя
// сказать, есть ли в кабинете строка; .env в этом случае не подставляем.
export interface LlmConfigState { config: EffectiveLlmConfig | null; known: boolean }

let cache: { value: EffectiveLlmConfig | null; at: number } | null = null;
let unknownAt = 0;
let inflight: Promise<LlmConfigState> | null = null;
let retryAt = 0;
let generation = 0;
let failing = false;

function fromEnv(): EffectiveLlmConfig | null {
  const cfg = resolveLlmConfig();
  return cfg ? { ...cfg, source: 'env', provider: null } : null;
}

// Один агент на адрес из кабинета: проверка адреса в момент каждого соединения.
let guarded: { baseUrl: string; allowPublic: boolean; dispatcher: Dispatcher } | null = null;
// allowPublic: подтверждение передачи есть; без него разрешены только локальные адреса.
export function guardedDispatcherFor(baseUrl: string, allowPublic: boolean): Dispatcher {
  if (guarded && guarded.baseUrl === baseUrl && guarded.allowPublic === allowPublic) return guarded.dispatcher;
  const old = guarded;
  guarded = { baseUrl, allowPublic, dispatcher: createGuardedDispatcher(baseUrl, { ...addressRules(), allowPublic }) };
  if (old) void old.dispatcher.close().catch(() => {});
  return guarded.dispatcher;
}

async function refresh(gen: number): Promise<LlmConfigState> {
  try {
    const s = await loadStoredLlmSettings();
    // Настройки изменились, пока читали базу: результат устарел и агент не создаётся
    // (иначе он закрыл бы агент нового адреса). Берём свежее значение.
    if (gen !== generation) return getLlmConfigState();
    const value: EffectiveLlmConfig | null = s
      ? { baseUrl: s.baseUrl, apiKey: s.apiKey ?? '', model: s.model, jsonMode: s.jsonMode, timeoutMs: s.timeoutMs,
          noThinking: s.provider === 'ollama', source: 'cabinet', provider: s.provider, dispatcher: guardedDispatcherFor(s.baseUrl, s.transferAckAt !== null) }
      : fromEnv();
    failing = false;
    retryAt = 0;
    cache = { value, at: Date.now() };
    unknownAt = 0;
    return { config: value, known: true };
  } catch (e) {
    // Пишем один раз за серию сбоев: проверка здоровья опрашивает сервер часто.
    if (!failing) logWarn('DB_012', safeErr(e));
    failing = true;
    if (cache) { retryAt = Date.now() + RETRY_AFTER_ERROR_MS; return { config: cache.value, known: true }; }
    if (gen === generation) unknownAt = Date.now();
    return { config: null, known: false };
  }
}

// Кабинет → .env → null. Запросы за свежим значением объединяются; при сбое базы
// отдаётся прежнее значение, а новая попытка — не раньше чем через 5 секунд.
// Если прежнего значения нет, ответ «не знаем» (known=false), а не .env.
export async function getLlmConfigState(): Promise<LlmConfigState> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return { config: cache.value, known: true };
  if (cache && now < retryAt) return { config: cache.value, known: true };
  if (!cache && unknownAt && now - unknownAt < RETRY_AFTER_ERROR_MS) return { config: null, known: false };
  if (!inflight) {
    const p: Promise<LlmConfigState> = refresh(generation).finally(() => { if (inflight === p) inflight = null; });
    inflight = p;
  }
  return inflight;
}

// Для показа состояния (health, кабинет): в состоянии «не знаем» — null, без .env.
export async function getEffectiveLlmConfig(): Promise<EffectiveLlmConfig | null> {
  return (await getLlmConfigState()).config;
}

// Для вызова модели: в состоянии «не знаем» текст приёма в модель из .env не уходит.
export async function requireLlmConfig(): Promise<EffectiveLlmConfig | null> {
  const st = await getLlmConfigState();
  if (!st.known) throw new LlmError('settings_unavailable', 'LLM: настройки из кабинета недоступны (база данных)');
  return st.config;
}

export function invalidateLlmConfigCache(): void {
  cache = null;
  unknownAt = 0;
  inflight = null;
  retryAt = 0;
  generation++;
}

// ── Проверка адреса внутри контейнера ────────────────────────────────────────

// Подсети самого контейнера: по IP из них можно достучаться до базы и соседних служб.
export function containerSubnets(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (!i.internal && i.cidr) out.push(i.cidr);
    }
  }
  return out;
}

// Серверный режим: задан PUBLIC_URL с https (за Caddy). Тогда шлюз Docker доступен только на порту Ollama.
const serverMode = (): boolean => /^https:\/\//i.test((process.env.PUBLIC_URL || '').trim());

export function addressRules() {
  return { localSubnets: containerSubnets(), serverMode: serverMode() };
}

export const checkLlmUrl = (raw: string) => checkLlmBaseUrl(raw, addressRules());
