import { logInfo, logWarn } from "../errors/logger";
import { deidContext } from "../deidentify";
import { callLlm, LlmError } from "../llm";
import { requireLlmConfig, checkLlmUrl } from "./llmSettings";

// Языковая модель — любой OpenAI-совместимый сервис (см. src/server/llm.ts);
// подключение — из личного кабинета или из .env (см. ai/llmSettings.ts)
// Единственная дверь ИЗ модели. Метки деидентификации (см.
// src/server/deidentify.ts) возвращаются в настоящие имена здесь — до того,
// как обработчик разберёт JSON и сверит цитаты со стенограммой.
export async function llmGenerate(params: {
  prompt: string;
  config?: Record<string, any>;
  systemInstruction?: string;
}): Promise<string> {
  const text = await llmGenerateRaw(params);
  const deid = deidContext.getStore();
  if (!deid) return text;
  const s = deid.stats;
  if (Object.values(s).some(Boolean)) {
    logInfo(`[quality] deid names=${s['ИМЯ']} phones=${s['ТЕЛЕФОН']} dates=${s['ДАТА']} numbers=${s['НОМЕР']} emails=${s['ПОЧТА']}`);
  }
  return deid.restore(text);
}

async function llmGenerateRaw(params: {
  prompt: string;
  config?: Record<string, any>;
  systemInstruction?: string;
}): Promise<string> {
  const { prompt, systemInstruction } = params;

  // Если настройки кабинета прочитать не удалось, requireLlmConfig бросает ошибку:
  // текст приёма не уходит в модель из .env, о которой врач мог не знать.
  const cfg = await requireLlmConfig();
  if (!cfg) throw new LlmError('not_configured', 'LLM не настроен: подключите модель в личном кабинете или задайте LLM_BASE_URL и LLM_MODEL в .env');
  try {
    // Адрес из кабинета проверяем заново перед каждым вызовом (служебные подсети и режим
    // могли измениться), а имя ещё и в момент соединения (cfg.dispatcher): оно могло
    // начать указывать на служебный адрес после проверки (DNS-rebinding).
    if (cfg.source === 'cabinet') {
      const chk = await checkLlmUrl(cfg.baseUrl);
      if ('code' in chk) {
        throw new LlmError(chk.code === 'invalid_url' ? 'network' : 'blocked_url', 'LLM: адрес не прошёл проверку');
      }
    }
    return await callLlm(cfg, prompt, systemInstruction);
  } catch (err: any) {
    // Свои ошибки callLlm начинаются с «LLM» и не содержат данных; остальное (сеть,
    // чужие исключения) могло бы процитировать фрагмент ответа — логируем только имя.
    logWarn('AI_001', String(err?.message || '').startsWith('LLM') ? err.message : String(err?.name || 'Error'));
    throw err;
  }
}
