/**
 * Логика формы «Настройки ИИ» (src/utils/llmForm.ts) без браузера и сети:
 * найденная Ollama не меняет сохранённое, пресет задаёт адрес и модель, подсказка про
 * ключ совпадает с правилом сервера keyAfterUpdate.
 *
 *   npx tsx scripts/check-llm-form.ts
 */
import {
  LLM_PRESETS, DEFAULT_OLLAMA_URL, applyPreset, keyState, keyProblem, keyRequired, fillFromDiscovery,
  foundOllamaPair, testSnapshot, isTestCurrent, testMode, acceptTestResponse, modelOptions, offerFoundOllama, type LlmProvider, type LlmPreset,
  type TestForm,
} from '../src/utils/llmForm';

type TestFormWithKey = TestForm & { apiKey: string };
import { keyAfterUpdate, maskApiKey, LLM_SETTINGS_MESSAGES } from '../src/server/ai/llmSettingsRules';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(66)} ${detail}`);
};

const [DEEPSEEK, OPENAI, OPENROUTER] = LLM_PRESETS;

console.log('P2: найденная Ollama и сохранённая пара');
{
  const saved = { baseUrl: 'http://192.168.1.50:11434/v1', model: 'remote-model:7b' };
  const found = { baseUrl: 'http://host.docker.internal:11434/v1', models: [{ name: 'local-model:8b' }] };
  check('открытие: заполненная форма не меняется', JSON.stringify(fillFromDiscovery(saved, true, found)) === JSON.stringify(saved));
  check('нетронутая пустая форма берёт найденную пару', JSON.stringify(fillFromDiscovery({ baseUrl: '', model: '' }, true, found)) === JSON.stringify({ baseUrl: found.baseUrl, model: 'local-model:8b' }));
  check('пустая форма и Ollama не найдена — адрес по умолчанию', fillFromDiscovery({ baseUrl: '', model: '' }, true, null).baseUrl === DEFAULT_OLLAMA_URL);
  check('поздний ответ после ввода пользователя не затирает', JSON.stringify(fillFromDiscovery({ baseUrl: '', model: '' }, false, found)) === JSON.stringify({ baseUrl: '', model: '' }));
  check('список найденных моделей не показывается для чужого адреса', modelOptions(saved, found) === null);
  check('предлагается кнопка «Использовать найденную Ollama»', offerFoundOllama(saved, found));
  check('кнопка не нужна, если адрес уже найденный', !offerFoundOllama({ baseUrl: found.baseUrl, model: 'x' }, found));
  const chosen = foundOllamaPair(found);
  check('явный выбор меняет адрес и модель вместе', chosen.baseUrl === found.baseUrl && chosen.model === 'local-model:8b');
  const opts = modelOptions({ baseUrl: found.baseUrl, model: 'remote-model:7b' }, found);
  check('сохранённая модель вне списка остаётся с пометкой', !!opts && opts[0].name === 'remote-model:7b' && opts[0].saved && opts.length === 2);
  const same = modelOptions({ baseUrl: found.baseUrl, model: 'local-model:8b' }, found);
  check('модель из списка не дублируется', !!same && same.length === 1 && !same[0].saved);
  check('пустой список моделей — ручной ввод', modelOptions({ baseUrl: found.baseUrl, model: 'm' }, { baseUrl: found.baseUrl, models: [] }) === null);
}

console.log('P3: пресет задаёт адрес и модель');
{
  const from = (p: LlmPreset, to: LlmPreset) => applyPreset({ baseUrl: p.url, model: p.model, apiKey: '' }, to);
  const a = from(DEEPSEEK, OPENAI);
  check('DeepSeek → OpenAI: адрес и модель OpenAI', a.baseUrl === OPENAI.url && a.model === OPENAI.model && (a.model as string) !== DEEPSEEK.model);
  const b = from(OPENAI, DEEPSEEK);
  check('OpenAI → DeepSeek', b.baseUrl === DEEPSEEK.url && b.model === DEEPSEEK.model);
  const c = from(DEEPSEEK, OPENROUTER);
  check('DeepSeek → OpenRouter', c.baseUrl === OPENROUTER.url && c.model === OPENROUTER.model);
  const typed = applyPreset({ baseUrl: DEEPSEEK.url, model: 'my-model', apiKey: 'sk-typed' }, OPENAI);
  check('набранный ключ другого провайдера сбрасывается', typed.apiKey === '' && typed.model === OPENAI.model);
  const keep = applyPreset({ baseUrl: OPENAI.url, model: 'x', apiKey: 'sk-typed' }, OPENAI);
  check('тот же провайдер: набранный ключ сохраняется, модель — пресета', keep.apiKey === 'sk-typed' && keep.model === OPENAI.model);
  check('пары пресетов уникальны и с моделью', new Set(LLM_PRESETS.map(p => p.model)).size === LLM_PRESETS.length && LLM_PRESETS.every(p => p.model));
}

console.log('P4: подсказка про ключ = правило сервера');
{
  const storedKey = 'sk-stored-1234567890';
  const prevs = [
    { baseUrl: 'https://api.deepseek.com', apiKey: storedKey },
    { baseUrl: 'https://api.openai.com/v1', apiKey: storedKey },
    { baseUrl: 'https://api.deepseek.com', apiKey: null },
  ];
  const nexts = [
    'https://api.deepseek.com', 'https://api.deepseek.com/', 'https://api.deepseek.com/v1', 'https://API.deepseek.com',
    'https://api.openai.com/v1', 'http://api.deepseek.com', 'https://api.deepseek.com:8443', 'https://evil.example.com/v1',
    'https://openrouter.ai/api/v1', 'not a url', '',
  ];
  const providers: LlmProvider[] = ['cloud', 'ollama'];
  let mismatch = 0, total = 0;
  for (const prev of prevs) for (const next of nexts) for (const provider of providers) {
    total++;
    const server = keyAfterUpdate(prev, { provider, baseUrl: next }) !== null;
    const ui = keyState({ baseUrl: prev.baseUrl, hasKey: !!prev.apiKey }, { provider, baseUrl: next }) === 'kept';
    if (server !== ui) { mismatch++; console.log(`    расхождение: ${prev.baseUrl} → ${next} (${provider}) сервер=${server} форма=${ui}`); }
  }
  check(`подсказка совпадает с keyAfterUpdate (${total} сочетаний)`, mismatch === 0);

  const stored = { baseUrl: 'https://api.deepseek.com', hasKey: true };
  check('тот же адрес: ключ оставляется', keyState(stored, { provider: 'cloud', baseUrl: DEEPSEEK.url }) === 'kept');
  check('смена пресета: маска и обещание пропадают', keyState(stored, { provider: 'cloud', baseUrl: OPENAI.url }) === 'origin_changed');
  check('ручная смена адреса: так же', keyState(stored, { provider: 'cloud', baseUrl: 'https://evil.example.com/v1' }) === 'origin_changed');
  check('ключа нет — подсказки нет', keyState({ baseUrl: stored.baseUrl, hasKey: false }, { provider: 'cloud', baseUrl: DEEPSEEK.url }) === 'none');
  check('Ollama: ключ не используется', keyState(stored, { provider: 'ollama', baseUrl: DEEPSEEK.url }) === 'none');

  // Сервер никогда не берёт прежний ключ для другого адреса.
  check('сервер: другой адрес → прежний ключ не используется', keyAfterUpdate({ baseUrl: DEEPSEEK.url, apiKey: storedKey }, { provider: 'cloud', baseUrl: OPENAI.url }) === null);
  check('сервер: новый ключ берётся как есть', keyAfterUpdate({ baseUrl: DEEPSEEK.url, apiKey: storedKey }, { provider: 'cloud', baseUrl: OPENAI.url, apiKey: 'sk-new' }) === 'sk-new');
  check('маска не раскрывает ключ целиком', maskApiKey(storedKey) === '••••7890' && !maskApiKey(storedKey)!.includes('sk-stored'));

  check('пресет без ключа и без права на прежний: блок с сообщением', !!keyProblem(stored, { provider: 'cloud', baseUrl: OPENAI.url, apiKey: '' }));
  check('пресет с новым ключом: можно', keyProblem(stored, { provider: 'cloud', baseUrl: OPENAI.url, apiKey: 'sk-new' }) === null);
  check('пресет на том же адресе с сохранённым ключом: можно', keyProblem(stored, { provider: 'cloud', baseUrl: DEEPSEEK.url, apiKey: '' }) === null);
  check('пресет без сохранённых настроек и ключа: блок', !!keyProblem(null, { provider: 'cloud', baseUrl: DEEPSEEK.url, apiKey: '' }));
  check('свой адрес без ключа разрешён', keyProblem(null, { provider: 'cloud', baseUrl: 'https://llm.example.com/v1', apiKey: '' }) === null);
  check('Ollama с адресом облачного провайдера без ключа — нельзя', !!keyProblem(null, { provider: 'ollama', baseUrl: OPENAI.url, apiKey: '' }) && !!keyProblem(null, { provider: 'ollama', baseUrl: 'https://api.openai.com./v1', apiKey: '' }));
  check('Ollama без ключа разрешена', keyProblem(null, { provider: 'ollama', baseUrl: DEFAULT_OLLAMA_URL, apiKey: '' }) === null);
  check('keyRequired: по адресу, с точкой на конце и регистром', keyRequired('https://api.openai.com/v1/') && keyRequired('https://API.openai.com./v1') && !keyRequired('https://x.example.com') && !keyRequired('http://host.docker.internal:11434/v1'));
  check('серверное сообщение key_required задано', LLM_SETTINGS_MESSAGES.key_required.length > 0);
}

console.log('Проверка подключения привязана к настройкам');
{
  const A = { provider: 'cloud' as LlmProvider, baseUrl: DEEPSEEK.url, model: DEEPSEEK.model, jsonMode: true, timeoutSec: '60', keyVersion: 1 };
  const entry = { snap: testSnapshot(A) };
  check('та же форма: результат актуален', isTestCurrent(entry, { ...A, baseUrl: ' ' + A.baseUrl + ' ' }));
  check('правка модели: результат устарел', !isTestCurrent(entry, { ...A, model: 'other' }));
  check('смена пресета (адрес и модель): устарел', !isTestCurrent(entry, { ...A, baseUrl: OPENAI.url, model: OPENAI.model }));
  check('правка ключа (счётчик): устарел', !isTestCurrent(entry, { ...A, keyVersion: 2 }));
  check('режим JSON и таймаут: устарел', !isTestCurrent(entry, { ...A, jsonMode: false }) && !isTestCurrent(entry, { ...A, timeoutSec: '90' }));
  check('смена варианта подключения: устарел', !isTestCurrent(entry, { ...A, provider: 'ollama' }));
  check('нет результата: не актуален', !isTestCurrent(null, A));
  // Форма в компоненте держит ключ рядом с остальными полями: лишнее поле не должно попасть в отпечаток.
  const withKey = { ...A, keyVersion: 7, apiKey: 'sk-test-XYZ' } as TestFormWithKey;
  check('в отпечатке нет самого ключа', !testSnapshot(withKey).includes('sk-test-XYZ'));
  const sa = testSnapshot(A), sb = testSnapshot({ ...A, baseUrl: OPENAI.url, model: OPENAI.model });
  check('поздний ответ старого запроса игнорируется', !acceptTestResponse(1, 2, sa, sa));
  check('ответ на запрос после смены настроек (DeepSeek → OpenAI) игнорируется', !acceptTestResponse(2, 2, sa, sb));
  check('последний запрос и та же форма: принимается', acceptTestResponse(2, 2, sa, sa));
}

console.log('Что проверяет «Проверить подключение»');
{
  const st = { provider: 'cloud' as LlmProvider, baseUrl: DEEPSEEK.url, model: 'deepseek-chat', jsonMode: true, timeoutMs: 60000 };
  const f = { provider: 'cloud' as LlmProvider, baseUrl: DEEPSEEK.url, model: 'deepseek-chat', jsonMode: true, timeoutSec: '60', apiKey: '' };
  check('форма равна сохранённой — проверяются сохранённые', testMode(f, st) === 'saved');
  check('очищена модель при сохранённых настройках — блок', testMode({ ...f, model: '' }, st) === 'blocked' && testMode({ ...f, model: '  ' }, st) === 'blocked');
  check('очищен адрес при сохранённых настройках — блок', testMode({ ...f, baseUrl: '' }, st) === 'blocked');
  check('изменённая полная форма — черновик', testMode({ ...f, model: 'other' }, st) === 'draft' && testMode({ ...f, apiKey: 'sk-x' }, st) === 'draft');
  check('нет сохранённых, форма пуста — блок', testMode({ ...f, baseUrl: '', model: '' }, null) === 'blocked');
  check('нет сохранённых, форма полная — черновик', testMode(f, null) === 'draft');
  check('нет сохранённых и пустая форма — блок, даже если в .env есть модель', testMode({ ...f, baseUrl: '', model: '' }, null) === 'blocked');
  check('нет сохранённых, заполнена часть формы — блок', testMode({ ...f, baseUrl: 'x', model: '' }, null) === 'blocked');
}

if (bad > 0) { console.error(`\nПровалено проверок: ${bad}`); process.exit(1); }
console.log('\nВсе проверки пройдены');
