/**
 * Логика формы «Настройки ИИ» без React и сети: пресеты, найденная Ollama,
 * правило «оставить прежний ключ». Проверяется scripts/check-llm-form.ts.
 * Правило ключа повторяет keyAfterUpdate из server/ai/llmSettingsRules.ts
 * (там node:dns, поэтому в браузер не импортируется); совпадение держит тот же скрипт.
 */
export type LlmProvider = 'ollama' | 'cloud';

export const DEFAULT_OLLAMA_URL = 'http://host.docker.internal:11434/v1';

export const LLM_PRESETS = [
  { name: 'DeepSeek', url: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
] as const;
export type LlmPreset = typeof LLM_PRESETS[number];

export interface LlmPair { baseUrl: string; model: string }
export interface FoundOllama<M extends { name: string } = { name: string }> { baseUrl: string; models: M[] }

export function sameOrigin(a: string, b: string): boolean {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

// Адрес сервера для сравнения с пресетами: схема, имя без завершающей точки (api.openai.com.), порт.
const presetOrigin = (u: string): string | null => {
  try { const x = new URL(u.trim()); return `${x.protocol}//${x.hostname.toLowerCase().replace(/\.+$/, '')}${x.port ? ':' + x.port : ''}`; } catch { return null; }
};

/** Пресет задаёт адрес и модель вместе. */
export const presetPair = (p: LlmPreset): LlmPair => ({ baseUrl: p.url, model: p.model });

/** Ключ нужен: адрес встроенного облачного провайдера (без ключа не работает) — независимо от выбранного варианта. */
export function keyRequired(baseUrl: string): boolean {
  const o = presetOrigin(baseUrl);
  return !!o && LLM_PRESETS.some(p => presetOrigin(p.url) === o);
}

export type KeyState = 'none' | 'kept' | 'origin_changed';

/**
 * Будет ли сервер использовать прежний ключ (зеркало keyAfterUpdate при пустом поле):
 * Ollama — нет; иначе только если у сохранённых настроек есть ключ и адрес на том же сервере.
 * 'origin_changed' — ключ есть, но к новому адресу не пойдёт.
 */
export function keyState(stored: { baseUrl: string; hasKey: boolean } | null, next: { provider: LlmProvider; baseUrl: string }): KeyState {
  if (next.provider === 'ollama' || !stored || !stored.hasKey) return 'none';
  return sameOrigin(stored.baseUrl, next.baseUrl.trim()) ? 'kept' : 'origin_changed';
}

/** Можно ли сохранять и проверять: для встроенного облачного провайдера нужен свой или прежний ключ. */
export function keyProblem(
  stored: { baseUrl: string; hasKey: boolean } | null,
  form: { provider: LlmProvider; baseUrl: string; apiKey: string },
): string | null {
  if (!keyRequired(form.baseUrl)) return null;
  if (form.provider === 'ollama') return 'Это адрес облачного провайдера: выберите вариант «Облачная модель» и вставьте ключ API.';
  if (form.apiKey.trim() || keyState(stored, form) === 'kept') return null;
  return 'Для этого провайдера нужен ключ API: вставьте ключ в поле «Ключ API». Прежний ключ к другому провайдеру не передаётся.';
}

/** Переключение пресета: прежний набранный ключ относился к другому серверу и сбрасывается. */
export function applyPreset(form: LlmPair & { apiKey: string }, p: LlmPreset): LlmPair & { apiKey: string } {
  const next = presetPair(p);
  return { ...next, apiKey: sameOrigin(form.baseUrl, next.baseUrl) ? form.apiKey : '' };
}

/** Пара для явного выбора найденной Ollama: адрес и первая модель вместе. */
export function foundOllamaPair(d: FoundOllama): LlmPair {
  return { baseUrl: d.baseUrl, model: d.models[0]?.name ?? '' };
}

/** Ответ поиска Ollama заполняет форму только если пользователь её ещё не трогал и сохранённой пары нет. */
export function fillFromDiscovery(form: LlmPair, untouched: boolean, d: FoundOllama | null): LlmPair {
  if (!untouched || form.baseUrl || form.model) return form;
  return d ? foundOllamaPair(d) : { baseUrl: DEFAULT_OLLAMA_URL, model: '' };
}

export interface ModelOption { name: string; saved: boolean }

/**
 * Список для выбора: найденные модели берутся только если адрес формы — найденная Ollama.
 * Нынешняя модель, которой в списке нет, остаётся доступной с пометкой «сохранена».
 * null — адрес чужой, список не показываем (ручной ввод).
 */
export function modelOptions(form: LlmPair, d: FoundOllama | null): ModelOption[] | null {
  if (!d || d.models.length === 0 || !sameOrigin(form.baseUrl.trim(), d.baseUrl)) return null;
  const opts = d.models.map(m => ({ name: m.name, saved: false }));
  const cur = form.model.trim();
  if (cur && !opts.some(o => o.name === cur)) opts.unshift({ name: cur, saved: true });
  return opts;
}

/** Предложить кнопку «Использовать найденную Ollama»: найдена, и форма смотрит на другой адрес. */
export function offerFoundOllama(form: LlmPair, d: FoundOllama | null): boolean {
  return !!d && d.models.length > 0 && !sameOrigin(form.baseUrl.trim(), d.baseUrl);
}

export interface TestForm { provider: LlmProvider; baseUrl: string; model: string; jsonMode: boolean; timeoutSec: string; keyVersion: number }

/**
 * Отпечаток настроек, к которым относится результат проверки (или отметка «Сохранено»).
 * Ключ в него не входит: только счётчик правок поля ключа.
 */
export function testSnapshot(f: TestForm): string {
  return JSON.stringify([f.provider, f.baseUrl.trim(), f.model.trim(), f.jsonMode, f.timeoutSec.trim(), f.keyVersion]);
}

/** Результат показывается, только пока форма не отличается от проверенной. */
export function isTestCurrent(entry: { snap: string } | null, f: TestForm): boolean {
  return !!entry && entry.snap === testSnapshot(f);
}

/** Ответ проверки принимается, если запрос последний и форма с тех пор не менялась. */
export function acceptTestResponse(reqId: number, latestId: number, testedSnap: string, currentSnap: string): boolean {
  return reqId === latestId && testedSnap === currentSnap;
}

export type TestMode = 'saved' | 'draft' | 'blocked';

/**
 * Что проверяет кнопка «Проверить подключение»: 'saved' — действующие настройки (форма равна
 * сохранённым), 'draft' — введённое в форме, 'blocked' — форма изменена (или настроек кабинета
 * нет), но адрес или модель пусты: запрос не отправляется.
 */
export function testMode(
  form: { provider: LlmProvider; baseUrl: string; model: string; jsonMode: boolean; timeoutSec: string; apiKey: string },
  stored: { provider: LlmProvider; baseUrl: string; model: string; jsonMode: boolean; timeoutMs: number } | null,
): TestMode {
  const complete = form.baseUrl.trim().length > 0 && form.model.trim().length > 0;
  const changed = !stored || stored.provider !== form.provider || stored.baseUrl !== form.baseUrl.trim()
    || stored.model !== form.model.trim() || stored.jsonMode !== form.jsonMode
    || String(Math.round(stored.timeoutMs / 1000)) !== form.timeoutSec || !!form.apiKey.trim();
  if (!changed) return 'saved';
  if (complete) return 'draft';
  return 'blocked';
}
