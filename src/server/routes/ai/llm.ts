import express from "express";
import bcrypt from "bcryptjs";
import { resolveLlmConfig, callLlm, createGuardedDispatcher, LlmError, llmErrorMessage, type LlmConfig } from "../../llm";
import { db } from "../../context";
import { rateLimit } from "../../middleware/rateLimit";
import { logInfo, logWarn, logError } from "../../errors/logger";
import { safeErr } from "../../logSafe";
import {
  loadStoredLlmSettings, saveStoredLlmSettings, deleteStoredLlmSettings, getLlmConfigState,
  checkLlmUrl, addressRules, type StoredLlmSettings,
} from "../../ai/llmSettings";
import {
  validateLlmSettingsInput, keyAfterUpdate, maskApiKey, isOllamaCloudModel, LLM_SETTINGS_MESSAGES,
} from "../../ai/llmSettingsRules";
import { keyRequired } from "../../../utils/llmForm";

// Только hostname[:port] из адреса модели: без схемы, пути, query и учётных данных.
function llmHost(baseUrl: string): string {
  try { return new URL(baseUrl).host; } catch { return ''; }
}

// Состояние подключения для личного кабинета. Ключ в ответ не попадает — только hasKey и маска.
async function buildStatus() {
  const envConfigured = !!resolveLlmConfig();
  let stored: StoredLlmSettings | null = null;
  try {
    stored = await loadStoredLlmSettings();
  } catch (e) {
    // Карточка должна открыться и без таблицы настроек. Если прежнего значения нет, мы не
    // знаем, что задано в кабинете, и модель из .env не показываем как действующую.
    logError('DB_012', safeErr(e));
    const st = await getLlmConfigState();
    const eff = st.config;
    if (!st.known || !eff) return { configured: false, source: null, envConfigured, settings: null, unavailable: !st.known };
    return {
      configured: true, source: eff.source, model: eff.model, host: llmHost(eff.baseUrl), hasKey: !!eff.apiKey,
      jsonMode: eff.jsonMode, timeoutMs: eff.timeoutMs, envConfigured, settings: null,
      // Модель работает по кешу, но сохранённые значения прочитать нельзя: форму не предлагаем.
      unavailable: true,
    };
  }
  if (stored) {
    return {
      configured: true, source: 'cabinet' as const, model: stored.model, host: llmHost(stored.baseUrl),
      hasKey: !!stored.apiKey, jsonMode: stored.jsonMode, timeoutMs: stored.timeoutMs, envConfigured,
      settings: {
        provider: stored.provider, baseUrl: stored.baseUrl, model: stored.model, hasKey: !!stored.apiKey,
        keyMask: maskApiKey(stored.apiKey), jsonMode: stored.jsonMode, timeoutMs: stored.timeoutMs,
        transferAckAt: stored.transferAckAt, updatedAt: stored.updatedAt,
      },
    };
  }
  const env = resolveLlmConfig();
  if (!env) return { configured: false, source: null, envConfigured, settings: null };
  return {
    configured: true, source: 'env' as const, model: env.model, host: llmHost(env.baseUrl), hasKey: !!env.apiKey,
    jsonMode: env.jsonMode, timeoutMs: env.timeoutMs, envConfigured, settings: null,
  };
}

// Один короткий запрос без медицинских данных (поэтому callLlm напрямую, без деидентификации).
async function runLlmTest(cfg: LlmConfig, res: express.Response, ownDispatcher?: LlmConfig['dispatcher']) {
  const startedAt = Date.now();
  try {
    const text = await callLlm(cfg, 'Ответь строго JSON-объектом {"ok": true}');
    let jsonOk = false;
    try { jsonOk = JSON.parse(text)?.ok === true; } catch { /* модель ответила не JSON */ }
    res.json({ ok: true, latencyMs: Date.now() - startedAt, jsonOk });
  } catch (e: any) {
    const code = e instanceof LlmError ? e.code : 'network';
    logWarn('AI_001', e instanceof LlmError ? e.message : String(e?.name || 'Error'));
    res.json({ ok: false, code, error: llmErrorMessage(code) });
  } finally {
    void ownDispatcher?.close().catch(() => {});
  }
}

// Текущий пароль врача: без него угнанная сессия не сможет менять или снимать настройки модели.
async function passwordMatches(userId: string, password: unknown): Promise<boolean> {
  const { data: owner, error } = await db.from('doctors').select('password').eq('id', userId).single();
  if (error && !owner) throw error;
  return !!owner && typeof password === 'string' && password !== '' && bcrypt.compareSync(password, owner.password);
}

// Где искать Ollama: компьютер врача из контейнера. 172.17.0.1 — шлюз Docker в Linux.
const OLLAMA_CANDIDATES = [
  'http://host.docker.internal:11434',
  'http://172.17.0.1:11434',
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://127.0.0.1:11434']),
];
const OLLAMA_HINT = 'Ollama не найдена. Запустите её; на Linux задайте OLLAMA_HOST=172.17.0.1 (инструкция, раздел 4.4).';

type OllamaModel = { name: string; sizeGb: number | null; parameterSize: string | null; cloud: boolean };

async function fetchOllamaModels(base: string): Promise<OllamaModel[] | null> {
  try {
    const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000), redirect: 'error' });
    if (!r.ok) return null;
    const data: any = await r.json();
    if (!Array.isArray(data?.models)) return null;
    const models: OllamaModel[] = [];
    for (const m of data.models) {
      const name = typeof m?.name === 'string' ? m.name : '';
      if (!name || name.length > 200) continue;
      const parameterSize = typeof m?.details?.parameter_size === 'string' && m.details.parameter_size.length <= 40
        ? m.details.parameter_size : null;
      models.push({
        name,
        sizeGb: typeof m?.size === 'number' && m.size > 0 ? Math.round(m.size / 1e8) / 10 : null,
        parameterSize,
        cloud: isOllamaCloudModel({ name, remote_host: m?.remote_host }),
      });
      if (models.length >= 100) break;
    }
    return models;
  } catch {
    return null;
  }
}

export function registerLlmRoutes(app: express.Express) {
  app.get("/api/ai/llm-status", async (req, res) => {
    res.json(await buildStatus());
  });

  // Сохранение настроек из кабинета. Порядок: форма (с подтверждением передачи) →
  // пароль → адрес → ключ → запись. Пароль нужен, чтобы угнанный токен не мог
  // перенаправить текст приёмов на чужой сервер.
  app.put("/api/ai/llm-settings", rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
    const parsed = validateLlmSettingsInput(req.body, { requireAck: true });
    if ('code' in parsed) return res.status(400).json({ error: parsed.message, code: parsed.code });
    const input = parsed.value;

    try {
      if (!(await passwordMatches(req.user.id, input.password))) {
        return res.status(403).json({ error: LLM_SETTINGS_MESSAGES.bad_password, code: 'bad_password' });
      }

      const checked = await checkLlmUrl(input.baseUrl);
      if ('code' in checked) return res.status(400).json({ error: checked.message, code: checked.code });
      // Подтверждение нужно и для адреса не в своей сети, как бы ни назвали провайдера:
      // «Ollama» с внешним адресом отправляет текст приёма наружу так же, как облако.
      if (!checked.isLocal && input.acknowledgeTransfer !== true) {
        return res.status(400).json({ error: LLM_SETTINGS_MESSAGES.ack_required, code: 'ack_required' });
      }

      const prev = await loadStoredLlmSettings();
      const apiKey = keyAfterUpdate(prev, { provider: input.provider, baseUrl: checked.baseUrl, apiKey: input.apiKey });
      // Встроенные облачные провайдеры без ключа не работают: не сохраняем заведомо нерабочую настройку.
      if (!apiKey && keyRequired(checked.baseUrl)) {
        return res.status(400).json({ error: LLM_SETTINGS_MESSAGES.key_required, code: 'key_required' });
      }
      await saveStoredLlmSettings({
        provider: input.provider, baseUrl: checked.baseUrl, model: input.model, apiKey,
        jsonMode: input.jsonMode ?? true, timeoutMs: input.timeoutMs as number,
        transferAck: input.acknowledgeTransfer === true,
      });
      logInfo(`LLM: настройки сохранены в кабинете (${input.provider}, ${llmHost(checked.baseUrl)})`);
      res.json({ ok: true, status: await buildStatus() });
    } catch (e) {
      logError('DB_012', safeErr(e));
      res.status(500).json({ error: "Не удалось сохранить настройки модели" });
    }
  });

  // «Отключить настройки кабинета»: дальше действует .env, если там что-то задано.
  // Пароль нужен по той же причине, что и при сохранении: иначе угнанный токен молча
  // переключит работу на другую модель.
  app.delete("/api/ai/llm-settings", rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
    try {
      if (!(await passwordMatches(req.user.id, req.body?.password))) {
        return res.status(403).json({ error: LLM_SETTINGS_MESSAGES.bad_password, code: 'bad_password' });
      }
      await deleteStoredLlmSettings();
      logInfo('LLM: настройки кабинета удалены');
      res.json({ ok: true, status: await buildStatus() });
    } catch (e) {
      logError('DB_012', safeErr(e));
      res.status(500).json({ error: "Не удалось отключить настройки модели" });
    }
  });

  // «Проверить подключение»: без тела — действующая конфигурация, с телом — черновик
  // из формы (пароль и галочка не нужны). Лимит строже общего ИИ-лимита — запрос платный.
  app.post("/api/ai/llm-test", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    const body = req.body;
    const isDraft = body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length > 0;

    if (!isDraft) {
      const st = await getLlmConfigState();
      if (!st.known) return res.json({ ok: false, code: 'settings_unavailable', error: llmErrorMessage('settings_unavailable') });
      const cfg = st.config;
      if (!cfg) return res.json({ ok: false, code: 'not_configured', error: llmErrorMessage('not_configured') });
      if (cfg.source === 'cabinet') {
        const chk = await checkLlmUrl(cfg.baseUrl);
        if ('code' in chk) {
          const code = chk.code === 'invalid_url' ? 'network' : 'blocked_url';
          return res.json({ ok: false, code, error: llmErrorMessage(code) });
        }
      }
      return runLlmTest(cfg, res);
    }

    const parsed = validateLlmSettingsInput(body);
    if ('code' in parsed) return res.json({ ok: false, code: parsed.code, error: parsed.message });
    const draft = parsed.value;
    const checked = await checkLlmUrl(draft.baseUrl);
    if ('code' in checked) return res.json({ ok: false, code: checked.code, error: checked.message });
    let prev: StoredLlmSettings | null = null;
    try { prev = await loadStoredLlmSettings(); } catch { /* ключ прежних настроек недоступен */ }
    const apiKey = keyAfterUpdate(prev, { provider: draft.provider, baseUrl: checked.baseUrl, apiKey: draft.apiKey });
    const dispatcher = createGuardedDispatcher(checked.baseUrl, addressRules());
    return runLlmTest({
      baseUrl: checked.baseUrl, apiKey: apiKey ?? '', model: draft.model,
      jsonMode: draft.jsonMode ?? true, timeoutMs: draft.timeoutMs as number, dispatcher,
      noThinking: draft.provider === 'ollama',
    }, res, dispatcher);
  });

  // «Найти Ollama»: фиксированный список адресов, ничего из запроса в адрес не попадает.
  app.get("/api/ai/ollama/discover", rateLimit(30, 15 * 60 * 1000), async (req, res) => {
    const results = await Promise.all(OLLAMA_CANDIDATES.map(fetchOllamaModels));
    const i = results.findIndex((r) => r !== null);
    if (i < 0) return res.json({ found: false, hint: OLLAMA_HINT });
    res.json({ found: true, baseUrl: `${OLLAMA_CANDIDATES[i]}/v1`, models: results[i] });
  });
}
