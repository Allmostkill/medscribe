/**
 * Проверка правил настроек языковой модели (адрес, форма, ключ) без сети и базы.
 *
 *   npx tsx scripts/check-llm-settings-rules.ts
 *
 * Адреса проверяются с подставленным DNS: настоящий DNS не нужен.
 */
import {
  normalizeLlmBaseUrl, checkLlmBaseUrl, validateLlmSettingsInput, maskApiKey, sameOrigin,
  keyAfterUpdate, isOllamaCloudModel, makeGuardedLookup, LLM_BLOCKED_CODE, LLM_UNCONFIRMED_CODE, LLM_SETTINGS_MESSAGES,
  type LlmSettingsProblem,
} from '../src/server/ai/llmSettingsRules';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(62)} ${detail}`);
};

// DNS-заглушка: имя → адреса; неизвестное имя не находится.
const table: Record<string, string[]> = {
  'api.example.com': ['93.184.216.34'],
  'lan.example.com': ['192.168.1.20'],
  'rebind.example.com': ['93.184.216.34', '169.254.169.254'],
  'meta.example.com': ['169.254.169.254'],
};
let lookups = 0;
const lookup = async (host: string) => {
  lookups++;
  const a = table[host];
  if (!a) throw new Error('ENOTFOUND');
  return a.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
};
const urlCode = async (u: string, localSubnets?: string[], extra: { serverMode?: boolean; dockerGateways?: string[] } = {}) => {
  const r = await checkLlmBaseUrl(u, { lookup, localSubnets, ...extra });
  return 'code' in r ? r.code : 'ok';
};
const isLocalOf = async (u: string, extra: { serverMode?: boolean } = {}) => {
  const r = await checkLlmBaseUrl(u, { lookup, ...extra });
  return r.ok ? r.isLocal : null;
};

async function main() {
  console.log('Нормализация адреса');
  check('срезан /chat/completions', normalizeLlmBaseUrl('https://api.x.com/v1/chat/completions') === 'https://api.x.com/v1');
  check('срезаны концевые /', normalizeLlmBaseUrl('https://api.x.com/v1///') === 'https://api.x.com/v1');
  check('/chat/completions/ тоже', normalizeLlmBaseUrl('https://api.x.com/v1/chat/completions/') === 'https://api.x.com/v1');
  check('пробелы по краям убраны', normalizeLlmBaseUrl('  http://localhost:11434/v1 ') === 'http://localhost:11434/v1');
  check('порт и путь сохранены', normalizeLlmBaseUrl('http://host.docker.internal:11434/v1') === 'http://host.docker.internal:11434/v1');
  check('без пути — без хвоста', normalizeLlmBaseUrl('https://api.x.com/') === 'https://api.x.com');
  for (const bad of ['ftp://x.com/v1', 'file:///etc/passwd', 'javascript:alert(1)', 'api.x.com/v1', '', '   ',
    'https://user:pass@api.x.com/v1', 'https://user@api.x.com/v1', 'https://api.x.com/v1?key=1', 'https://api.x.com/v1?',
    'https://api.x.com/v1#a', 'https://api.x.com/v1#', 'https://api.x.com/ v1']) {
    check(`не адрес: ${JSON.stringify(bad)}`, normalizeLlmBaseUrl(bad) === null);
  }
  check('слишком длинный адрес', normalizeLlmBaseUrl('https://api.x.com/' + 'a'.repeat(500)) === null);

  console.log('Адреса: схемы, логин, ?, #');
  check('ftp → invalid_url', (await urlCode('ftp://api.example.com/v1')) === 'invalid_url');
  check('логин:пароль → invalid_url', (await urlCode('https://u:p@api.example.com/v1')) === 'invalid_url');
  check('? → invalid_url', (await urlCode('https://api.example.com/v1?x=1')) === 'invalid_url');
  check('# → invalid_url', (await urlCode('https://api.example.com/v1#x')) === 'invalid_url');
  check('мусор → invalid_url', (await urlCode('не адрес')) === 'invalid_url');
  check('имя не найдено в DNS → invalid_url', (await urlCode('https://nope.example.com/v1')) === 'invalid_url');

  console.log('Адреса: https');
  check('https на публичное имя → ok', (await urlCode('https://api.example.com/v1')) === 'ok');
  check('https на публичный IP → ok', (await urlCode('https://93.184.216.34/v1')) === 'ok');
  check('https на частный IP → ok', (await urlCode('https://10.0.0.5/v1')) === 'ok');
  const r = await checkLlmBaseUrl('https://api.example.com/v1/chat/completions/', { lookup });
  check('ok возвращает нормализованный адрес', r.ok && r.baseUrl === 'https://api.example.com/v1');

  console.log('Адреса: http');
  check('http на публичный IP → insecure_url', (await urlCode('http://93.184.216.34/v1')) === 'insecure_url');
  check('http на публичное имя → insecure_url', (await urlCode('http://api.example.com/v1')) === 'insecure_url');
  check('http на имя из частной сети → ok', (await urlCode('http://lan.example.com/v1')) === 'ok');
  for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.1.5', '100.64.0.1', '100.127.255.254', '127.0.0.1', '127.5.5.5']) {
    check(`http на ${ip} → ok`, (await urlCode(`http://${ip}:11434/v1`)) === 'ok');
  }
  check('http на 172.32.0.1 → insecure_url', (await urlCode('http://172.32.0.1/v1')) === 'insecure_url');
  check('http на 100.128.0.1 → insecure_url', (await urlCode('http://100.128.0.1/v1')) === 'insecure_url');
  check('http на [::1] → ok', (await urlCode('http://[::1]:11434/v1')) === 'ok');
  check('http на [fd12::1] (fc00::/7) → ok', (await urlCode('http://[fd12::1]/v1')) === 'ok');
  check('http на [fc00::1] → ok', (await urlCode('http://[fc00::1]/v1')) === 'ok');
  check('http на [::ffff:192.168.1.5] → ok', (await urlCode('http://[::ffff:192.168.1.5]/v1')) === 'ok');
  check('http на публичный IPv6 → insecure_url', (await urlCode('http://[2606:4700::1111]/v1')) === 'insecure_url');
  lookups = 0;
  for (const name of ['localhost', 'host.docker.internal', 'gateway.docker.internal']) {
    check(`http на ${name} → ok (без DNS)`, (await urlCode(`http://${name}:11434/v1`)) === 'ok');
  }
  check('для этих имён DNS не вызывался', lookups === 0, `вызовов: ${lookups}`);
  check('HOST.DOCKER.INTERNAL в другом регистре → ok', (await urlCode('http://HOST.DOCKER.INTERNAL:11434/v1')) === 'ok');

  console.log('Адреса: служебные (blocked_url)');
  for (const u of ['http://169.254.169.254/v1', 'https://169.254.169.254/v1', 'http://169.254.0.1/v1',
    'http://[fe80::1]/v1', 'https://[fe80::1]/v1', 'http://[::ffff:169.254.169.254]/v1', 'https://[::ffff:a9fe:a9fe]/v1',
    'http://0.0.0.0/v1', 'https://0.0.0.0:11434/v1', 'http://[::]/v1', 'https://[::]/v1',
    'http://224.0.0.1/v1', 'https://239.255.255.250/v1', 'http://[ff02::1]/v1', 'http://255.255.255.255/v1',
    'https://[::ffff:0.0.0.0]/v1', 'https://[64:ff9b::a9fe:a9fe]/v1',
    // запись адреса другими способами: URL приводит их к обычному виду
    'http://2852039166/v1', 'http://0xa9fea9fe/v1', 'http://169.254.169.254.:80/v1']) {
    check(`${u} → blocked_url`, (await urlCode(u)) === 'blocked_url');
  }
  check('имя → адрес метаданных → blocked_url', (await urlCode('https://meta.example.com/v1')) === 'blocked_url');
  check('имя с публичным и служебным адресом → blocked_url', (await urlCode('https://rebind.example.com/v1')) === 'blocked_url');
  for (const name of ['postgres', 'postgrest', 'tone', 'app', 'init', 'migrate', 'caddy', 'POSTGRES', 'app.']) {
    check(`служба compose «${name}» → blocked_url`, (await urlCode(`http://${name}:3000/v1`)) === 'blocked_url');
  }
  check('служба по https тоже blocked_url', (await urlCode('https://postgrest:3000/v1')) === 'blocked_url');
  check('имя похожее на службу (app.example.com) → не blocked', (await urlCode('https://app.example.com/v1')) === 'invalid_url');

  console.log('Адреса: подсети контейнера');
  check('адрес из подсети контейнера → blocked_url',
    (await urlCode('http://172.18.0.3:5432/v1', ['172.18.0.5/16'])) === 'blocked_url');
  check('то же по https → blocked_url', (await urlCode('https://172.18.9.9/v1', ['172.18.0.5/16'])) === 'blocked_url');
  check('адрес вне подсети контейнера → ok', (await urlCode('http://172.17.0.1:11434/v1', ['172.18.0.5/16'])) === 'ok');
  check('подсеть IPv6 контейнера', (await urlCode('http://[fd00:1::5]/v1', ['fd00:1::2/64'])) === 'blocked_url');
  check('без подсетей — как обычный частный адрес', (await urlCode('http://172.18.0.3/v1')) === 'ok');
  check('кривая подсеть пропускается', (await urlCode('http://10.0.0.1/v1', ['мусор', '1.2.3.4/xx'])) === 'ok');

  console.log('Адреса: свой компьютер или чужой (isLocal)');
  check('localhost → isLocal', (await isLocalOf('http://localhost:11434/v1')) === true);
  check('host.docker.internal → isLocal', (await isLocalOf('http://host.docker.internal:11434/v1')) === true);
  check('192.168.1.5 по http → isLocal', (await isLocalOf('http://192.168.1.5:11434/v1')) === true);
  check('имя из частной сети → isLocal', (await isLocalOf('https://lan.example.com/v1')) === true);
  check('частный IP по https → isLocal', (await isLocalOf('https://10.0.0.5/v1')) === true);
  check('публичное имя по https → не isLocal', (await isLocalOf('https://api.example.com/v1')) === false);
  check('публичный IP по https → не isLocal', (await isLocalOf('https://93.184.216.34/v1')) === false);
  check('публичный IPv6 по https → не isLocal', (await isLocalOf('https://[2606:4700::1111]/v1')) === false);

  console.log('Серверный режим: шлюз Docker только на порту 11434');
  const srv = { serverMode: true };
  check('host.docker.internal:11434 → ok', (await urlCode('http://host.docker.internal:11434/v1', undefined, srv)) === 'ok');
  check('host.docker.internal:5432 → blocked_url', (await urlCode('http://host.docker.internal:5432/v1', undefined, srv)) === 'blocked_url');
  check('gateway.docker.internal без порта → blocked_url', (await urlCode('http://gateway.docker.internal/v1', undefined, srv)) === 'blocked_url');
  check('172.17.0.1:11434 → ok', (await urlCode('http://172.17.0.1:11434/v1', undefined, srv)) === 'ok');
  check('172.17.0.1:22 → blocked_url', (await urlCode('http://172.17.0.1:22/v1', undefined, srv)) === 'blocked_url');
  check('свой шлюз 172.19.0.1:8080 из параметра → blocked_url',
    (await urlCode('http://172.19.0.1:8080/v1', undefined, { ...srv, dockerGateways: ['172.19.0.1'] })) === 'blocked_url');
  check('без серверного режима host.docker.internal:5432 → ok', (await urlCode('http://host.docker.internal:5432/v1')) === 'ok');
  check('без серверного режима 172.17.0.1:22 → ok', (await urlCode('http://172.17.0.1:22/v1')) === 'ok');
  check('другой частный адрес в серверном режиме не ограничен', (await urlCode('http://192.168.1.5:8080/v1', undefined, srv)) === 'ok');

  console.log('Серверный режим: локальные — только loopback и шлюз Docker на 11434');
  check('localhost → isLocal', (await isLocalOf('http://localhost:11434/v1', srv)) === true);
  check('127.0.0.1 → isLocal', (await isLocalOf('http://127.0.0.1:8080/v1', srv)) === true);
  check('[::1] → isLocal', (await isLocalOf('http://[::1]:11434/v1', srv)) === true);
  check('host.docker.internal:11434 → isLocal', (await isLocalOf('http://host.docker.internal:11434/v1', srv)) === true);
  check('172.17.0.1:11434 → isLocal', (await isLocalOf('http://172.17.0.1:11434/v1', srv)) === true);
  for (const u of ['http://10.0.0.5:11434/v1', 'http://172.20.1.1:11434/v1', 'http://192.168.1.5:11434/v1',
    'http://100.64.0.7:11434/v1', 'http://[fd00::5]:11434/v1', 'https://lan.example.com/v1']) {
    check(`${u} → разрешён, но не isLocal`, (await isLocalOf(u, srv)) === false);
  }
  check('публичный https → не isLocal', (await isLocalOf('https://api.example.com/v1', srv)) === false);
  check('в обычном режиме 10.0.0.5 по-прежнему isLocal', (await isLocalOf('http://10.0.0.5:11434/v1')) === true);

  console.log('Проверка в момент соединения (lookup)');
  const lk = (resolveTo: string[], baseUrl: string, extra: { serverMode?: boolean; allowPublic?: boolean } = {}) =>
    new Promise<{ err: any; addr: any }>((done) => {
      const fn = makeGuardedLookup(baseUrl, {
        ...extra,
        resolve: async () => resolveTo.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
      });
      fn('name.test', { all: true }, (err: any, addr: any) => done({ err, addr }));
    });
  const blockedBy = (r: { err: any }) => r.err?.code === LLM_BLOCKED_CODE;
  check('метаданные облака → ошибка', blockedBy(await lk(['169.254.169.254'], 'https://name.test/v1')));
  check('публичный + служебный → ошибка', blockedBy(await lk(['93.184.216.34', '169.254.169.254'], 'https://name.test/v1')));
  check('https, публичный адрес → отдан', (await lk(['93.184.216.34'], 'https://name.test/v1')).addr?.[0]?.address === '93.184.216.34');
  check('http, публичный адрес → ошибка', blockedBy(await lk(['93.184.216.34'], 'http://name.test/v1')));
  check('http, частный адрес → отдан', (await lk(['192.168.1.5'], 'http://name.test/v1')).addr?.length === 1);
  check('шлюз Docker не на 11434 в серверном режиме → ошибка', blockedBy(await lk(['172.17.0.1'], 'http://name.test:8080/v1', { serverMode: true })));
  check('шлюз Docker на 11434 в серверном режиме → отдан', (await lk(['172.17.0.1'], 'http://name.test:11434/v1', { serverMode: true })).addr?.length === 1);
  const unconfirmedBy = (r: { err: any }) => r.err?.code === LLM_UNCONFIRMED_CODE;
  check('сервер: частный адрес без подтверждения → ошибка передачи',
    unconfirmedBy(await lk(['10.0.0.5'], 'http://name.test:11434/v1', { serverMode: true, allowPublic: false })));
  check('сервер: частный адрес с подтверждением → отдан',
    (await lk(['10.0.0.5'], 'http://name.test:11434/v1', { serverMode: true, allowPublic: true })).addr?.length === 1);
  check('сервер: loopback без подтверждения → отдан',
    (await lk(['127.0.0.1'], 'http://name.test:11434/v1', { serverMode: true, allowPublic: false })).addr?.length === 1);
  check('сервер: шлюз Docker :11434 без подтверждения → отдан',
    (await lk(['172.17.0.1'], 'http://name.test:11434/v1', { serverMode: true, allowPublic: false })).addr?.length === 1);
  check('обычный режим: частный адрес без подтверждения → отдан',
    (await lk(['10.0.0.5'], 'http://name.test:11434/v1', { allowPublic: false })).addr?.length === 1);
  const single = await new Promise<any>((done) => makeGuardedLookup('https://name.test/v1', {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }] })('name.test', {}, (e: any, a: any, f: any) => done({ e, a, f })));
  check('без all: адрес и семейство', single.a === '93.184.216.34' && single.f === 4);

  console.log('Форма настроек');
  const base = { provider: 'ollama', baseUrl: 'http://host.docker.internal:11434/v1/', model: ' llama3 ' };
  const v = (b: unknown, o?: { requireAck?: boolean }) => validateLlmSettingsInput(b, o);
  const code = (b: unknown, o?: { requireAck?: boolean }) => { const x = v(b, o); return 'code' in x ? x.code : 'ok'; };
  const ok1 = v(base);
  check('Ollama: значения по умолчанию', ok1.ok && ok1.value.timeoutMs === 180000 && ok1.value.jsonMode === true
    && ok1.value.model === 'llama3' && ok1.value.baseUrl === 'http://host.docker.internal:11434/v1');
  const ok2 = v({ provider: 'cloud', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: 'sk-abc' });
  check('облако: таймаут по умолчанию 60000, ключ', ok2.ok && ok2.value.timeoutMs === 60000 && ok2.value.apiKey === 'sk-abc');
  const ok3 = v({ ...base, jsonMode: false, timeoutMs: 5000, password: 'x', acknowledgeTransfer: true });
  check('jsonMode=false, таймаут 5000, пароль', ok3.ok && ok3.value.jsonMode === false && ok3.value.timeoutMs === 5000 && ok3.value.password === 'x');
  check('таймаут 600000 допустим', code({ ...base, timeoutMs: 600000 }) === 'ok');
  check('таймаут 4999 → invalid_body', code({ ...base, timeoutMs: 4999 }) === 'invalid_body');
  check('таймаут 600001 → invalid_body', code({ ...base, timeoutMs: 600001 }) === 'invalid_body');
  check('таймаут дробный → invalid_body', code({ ...base, timeoutMs: 6000.5 }) === 'invalid_body');
  check('таймаут строкой → invalid_body', code({ ...base, timeoutMs: '60000' }) === 'invalid_body');
  check('jsonMode строкой → invalid_body', code({ ...base, jsonMode: 'true' }) === 'invalid_body');
  check('не объект → invalid_body', code(null) === 'invalid_body' && code('x') === 'invalid_body' && code([]) === 'invalid_body');
  check('provider неизвестный → invalid_body', code({ ...base, provider: 'openai' }) === 'invalid_body');
  check('baseUrl не строка → invalid_body', code({ ...base, baseUrl: 5 }) === 'invalid_body');
  check('baseUrl с логином → invalid_url', code({ ...base, baseUrl: 'http://a:b@x.com/v1' }) === 'invalid_url');
  check('модель пустая → invalid_model', code({ ...base, model: '  ' }) === 'invalid_model');
  check('модель 201 символ → invalid_model', code({ ...base, model: 'a'.repeat(201) }) === 'invalid_model');
  check('модель 200 символов → ok', code({ ...base, model: 'a'.repeat(200) }) === 'ok');
  check('модель с управляющим символом → invalid_model', code({ ...base, model: 'a\nb' }) === 'invalid_model');
  check('модель не строка → invalid_model', code({ ...base, model: 7 }) === 'invalid_model');
  check('ключ 501 символ → invalid_key', code({ ...base, apiKey: 'k'.repeat(501) }) === 'invalid_key');
  check('ключ с пробелом внутри → invalid_key', code({ ...base, apiKey: 'sk abc' }) === 'invalid_key');
  check('ключ с переводом строки внутри → invalid_key', code({ ...base, apiKey: 'sk\nabc' }) === 'invalid_key');
  check('ключ не строка → invalid_key', code({ ...base, apiKey: 5 }) === 'invalid_key');
  const trimmed = v({ ...base, apiKey: '  sk-1\n' });
  check('пробелы вокруг ключа убираются', trimmed.ok && trimmed.value.apiKey === 'sk-1');
  const emptyKey = v({ ...base, apiKey: '' });
  check("ключ '' сохраняется как '' (очистка)", emptyKey.ok && emptyKey.value.apiKey === '');
  const noKey = v(base);
  check('ключ не прислан — undefined', noKey.ok && noKey.value.apiKey === undefined);
  check('пароль не строка → invalid_body', code({ ...base, password: 1 }) === 'invalid_body');

  console.log('Подтверждение передачи (ack_required)');
  const ack = { requireAck: true };
  const cloud = { provider: 'cloud', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };
  check('облако без галочки → ack_required', code(cloud, ack) === 'ack_required');
  check('облако с acknowledgeTransfer:false → ack_required', code({ ...cloud, acknowledgeTransfer: false }, ack) === 'ack_required');
  check('облако с acknowledgeTransfer:"true" → invalid_body', code({ ...cloud, acknowledgeTransfer: 'true' }, ack) === 'invalid_body');
  check('облако с галочкой → ok', code({ ...cloud, acknowledgeTransfer: true }, ack) === 'ok');
  check('облако без requireAck (проверка) → ok', code(cloud) === 'ok');
  const oc = { provider: 'ollama', baseUrl: 'http://host.docker.internal:11434/v1', model: 'gpt-oss:120b-cloud' };
  check('Ollama, облачная модель без галочки → ack_required', code(oc, ack) === 'ack_required');
  check('Ollama, облачная модель с галочкой → ok', code({ ...oc, acknowledgeTransfer: true }, ack) === 'ok');
  check('Ollama, локальная модель без галочки → ok', code({ ...oc, model: 'llama3:8b' }, ack) === 'ok');
  const ackFail = v(cloud, ack);
  check('текст ack_required из решения владельца', 'message' in ackFail
    && ackFail.message === 'Подтвердите, что понимаете: текст приёма уйдёт провайдеру');
  check('форма проверяется раньше галочки', code({ ...cloud, model: '' }, ack) === 'invalid_model');

  console.log('Облачная модель Ollama');
  check('gpt-oss:120b-cloud', isOllamaCloudModel({ name: 'gpt-oss:120b-cloud' }));
  check('qwen3-coder:480b-cloud', isOllamaCloudModel({ name: 'qwen3-coder:480b-cloud' }));
  check('gpt-oss:cloud', isOllamaCloudModel({ name: 'gpt-oss:cloud' }));
  check('remote_host задан', isOllamaCloudModel({ name: 'llama3:8b', remote_host: 'https://ollama.com:443' }));
  check('remote_host пустой — не облачная', !isOllamaCloudModel({ name: 'llama3:8b', remote_host: '' }));
  check('локальная llama3:8b', !isOllamaCloudModel({ name: 'llama3:8b' }));
  check('«cloudy:7b» — не облачная', !isOllamaCloudModel({ name: 'cloudy:7b' }));
  check('«nocloud:7b» — не облачная', !isOllamaCloudModel({ name: 'nocloud:7b' }));

  console.log('Маска ключа');
  check('null → null', maskApiKey(null) === null);
  check('короткий → ••••', maskApiKey('sk-short') === '••••' && maskApiKey('12345678901') === '••••');
  check('от 12 символов — последние 4', maskApiKey('sk-1234567890abcd') === '••••abcd' && maskApiKey('123456789012') === '••••9012');
  check('маска не содержит начала ключа', !String(maskApiKey('sk-SECRETPREFIX-zzzz')).includes('SECRET'));

  console.log('Ключ при сохранении');
  const prev = { baseUrl: 'https://api.openai.com/v1', apiKey: 'old-key' };
  const cl = (baseUrl: string, apiKey?: string) => ({ provider: 'cloud' as const, baseUrl, apiKey });
  check('sameOrigin: тот же сервер, другой путь', sameOrigin('https://api.openai.com/v1', 'https://api.openai.com/v2'));
  check('sameOrigin: порт по умолчанию', sameOrigin('https://a.com:443/x', 'https://a.com/y'));
  check('sameOrigin: другой хост', !sameOrigin('https://a.com/v1', 'https://b.com/v1'));
  check('sameOrigin: другая схема', !sameOrigin('http://a.com/v1', 'https://a.com/v1'));
  check('sameOrigin: другой порт', !sameOrigin('http://a.com:1/v1', 'http://a.com:2/v1'));
  check('sameOrigin: мусор', !sameOrigin('x', 'https://a.com'));
  check('не прислан, тот же origin → прежний', keyAfterUpdate(prev, cl('https://api.openai.com/v1/')) === 'old-key');
  check('не прислан, другой origin → null', keyAfterUpdate(prev, cl('https://evil.example.com/v1')) === null);
  check('не прислан, прежнего нет → null', keyAfterUpdate(null, cl('https://api.openai.com/v1')) === null);
  check('не прислан, у прежнего нет ключа → null', keyAfterUpdate({ ...prev, apiKey: null }, cl('https://api.openai.com/v1')) === null);
  check("'' → null (очистка)", keyAfterUpdate(prev, cl('https://api.openai.com/v1', '')) === null);
  check('новый ключ → он, даже при другом origin', keyAfterUpdate(prev, cl('https://api.deepseek.com', 'new-key')) === 'new-key');
  check('Ollama → null даже с ключом', keyAfterUpdate(prev, { provider: 'ollama', baseUrl: 'https://api.openai.com/v1', apiKey: 'k' }) === null);
  check('Ollama без ключа и с прежним → null', keyAfterUpdate(prev, { provider: 'ollama', baseUrl: 'https://api.openai.com/v1' }) === null);

  console.log('Тексты');
  const codes: LlmSettingsProblem[] = ['invalid_body', 'invalid_url', 'insecure_url', 'blocked_url', 'invalid_model', 'invalid_key', 'bad_password', 'ack_required'];
  check('тексты: все коды заполнены', codes.every((c) => LLM_SETTINGS_MESSAGES[c].length > 5));

  if (bad) { console.log(`\nПровалено проверок: ${bad}`); process.exit(1); }
  console.log('\nВсё в порядке');
}

main().catch((e) => { console.error(e); process.exit(1); });
