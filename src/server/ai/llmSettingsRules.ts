/**
 * Правила настроек языковой модели из личного кабинета: разбор тела запроса,
 * проверка адреса (защита от SSRF), маска ключа. Чистые функции без доступа к
 * config.ts, базе и шифрованию — их проверяет scripts/check-llm-settings-rules.ts.
 *
 * Ключ API здесь не логируется и не попадает в сообщения.
 */
import dns from 'node:dns';
import net from 'node:net';
import { sameOrigin } from '../../utils/llmForm';

export type LlmProvider = 'ollama' | 'cloud';

export interface LlmSettingsInput {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  jsonMode?: boolean;
  timeoutMs?: number;
  password?: string;
  acknowledgeTransfer?: boolean;
}

export type LlmSettingsProblem = 'invalid_body' | 'invalid_url' | 'insecure_url' | 'blocked_url'
  | 'invalid_model' | 'invalid_key' | 'bad_password' | 'ack_required' | 'key_required';

export const LLM_SETTINGS_MESSAGES: Record<LlmSettingsProblem, string> = {
  invalid_body: 'Проверьте поля: не все настройки модели заполнены правильно.',
  invalid_url: 'Некорректный адрес. Нужен адрес вида https://api.example.com/v1 — без логина, пароля, знаков ? и #.',
  insecure_url: 'Адрес без шифрования (http://) допустим только для модели на этом компьютере или в вашей локальной сети. Для интернета используйте https://.',
  blocked_url: 'Этот адрес нельзя использовать для языковой модели: он указывает на служебный адрес.',
  invalid_model: 'Укажите название модели (до 200 символов, без служебных символов).',
  invalid_key: 'Ключ слишком длинный или содержит пробелы и служебные символы. Скопируйте его заново.',
  bad_password: 'Неверный пароль',
  ack_required: 'Подтвердите, что понимаете: текст приёма уйдёт провайдеру',
  key_required: 'Для этого провайдера нужен ключ API. Прежний ключ к другому провайдеру не передаётся: вставьте ключ заново.',
};

const SERVICE_NAMES = new Set(['postgres', 'postgrest', 'tone', 'app', 'init', 'migrate', 'caddy']);
// Имена, для которых http допустим без DNS: сам компьютер и шлюз Docker.
const LOCAL_NAMES = new Set(['localhost', 'host.docker.internal', 'gateway.docker.internal']);

const MAX_URL_LENGTH = 500;
const MAX_MODEL_LENGTH = 200;
const MAX_KEY_LENGTH = 500;
const MIN_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 600000;
const DEFAULT_TIMEOUT_MS: Record<LlmProvider, number> = { ollama: 180000, cloud: 60000 };

// Адрес без схемы-хвоста: /chat/completions и концевые «/» срезаются, чтобы в базе
// лежал адрес API, к которому клиент сам допишет путь.
export function normalizeLlmBaseUrl(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  // new URL молча отбрасывает пустые «?» и «#», поэтому смотрим на исходную строку.
  if (/[?#\s]/.test(trimmed)) return null;
  let u: URL;
  try { u = new URL(trimmed); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password || u.search || u.hash || !u.hostname) return null;
  const path = u.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '').replace(/\/+$/, '');
  const out = `${u.protocol}//${u.host}${path}`;
  return out.length > MAX_URL_LENGTH ? null : out;
}

export function isOllamaCloudModel(m: { name: string; remote_host?: unknown }): boolean {
  if (m.remote_host) return true;
  return /(^|[:\-])cloud$/i.test(String(m.name || '').trim());
}

const hasControlChars = (s: string): boolean => /[\u0000-\u001f\u007f]/.test(s);

export function validateLlmSettingsInput(body: unknown, opts: { requireAck?: boolean } = {}):
  { ok: true; value: LlmSettingsInput } | { ok: false; code: LlmSettingsProblem; message: string } {
  const fail = (code: LlmSettingsProblem) => ({ ok: false as const, code, message: LLM_SETTINGS_MESSAGES[code] });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('invalid_body');
  const b = body as Record<string, unknown>;

  if (b.provider !== 'ollama' && b.provider !== 'cloud') return fail('invalid_body');
  const provider: LlmProvider = b.provider;

  if (typeof b.baseUrl !== 'string') return fail('invalid_body');
  const baseUrl = normalizeLlmBaseUrl(b.baseUrl);
  if (!baseUrl) return fail('invalid_url');

  if (typeof b.model !== 'string') return fail('invalid_model');
  const model = b.model.trim();
  if (!model || model.length > MAX_MODEL_LENGTH || hasControlChars(model)) return fail('invalid_model');

  let apiKey: string | undefined;
  if (b.apiKey !== undefined && b.apiKey !== null) {
    if (typeof b.apiKey !== 'string') return fail('invalid_key');
    apiKey = b.apiKey.trim();
    if (apiKey.length > MAX_KEY_LENGTH || /[\s\u0000-\u001f\u007f]/.test(apiKey)) return fail('invalid_key');
  }

  let jsonMode = true;
  if (b.jsonMode !== undefined) {
    if (typeof b.jsonMode !== 'boolean') return fail('invalid_body');
    jsonMode = b.jsonMode;
  }

  let timeoutMs = DEFAULT_TIMEOUT_MS[provider];
  if (b.timeoutMs !== undefined) {
    if (typeof b.timeoutMs !== 'number' || !Number.isInteger(b.timeoutMs)
      || b.timeoutMs < MIN_TIMEOUT_MS || b.timeoutMs > MAX_TIMEOUT_MS) return fail('invalid_body');
    timeoutMs = b.timeoutMs;
  }

  if (b.password !== undefined && typeof b.password !== 'string') return fail('invalid_body');
  if (b.acknowledgeTransfer !== undefined && typeof b.acknowledgeTransfer !== 'boolean') return fail('invalid_body');

  // Облачная модель (свой провайдер или облако Ollama): текст приёма уходит за пределы компьютера.
  if (opts.requireAck && b.acknowledgeTransfer !== true
    && (provider === 'cloud' || isOllamaCloudModel({ name: model }))) return fail('ack_required');

  return {
    ok: true,
    value: {
      provider, baseUrl, model, apiKey, jsonMode, timeoutMs,
      password: b.password as string | undefined,
      acknowledgeTransfer: b.acknowledgeTransfer as boolean | undefined,
    },
  };
}

// ── Проверка адреса ──────────────────────────────────────────────────────────

function makeBlockList(entries: [string, number | null, 'ipv4' | 'ipv6'][]): net.BlockList {
  const list = new net.BlockList();
  for (const [addr, prefix, family] of entries) {
    if (prefix === null) list.addAddress(addr, family);
    else list.addSubnet(addr, prefix, family);
  }
  return list;
}

// Служебные адреса: метаданные облака, link-local, «все интерфейсы», multicast, broadcast.
const BLOCKED = makeBlockList([
  ['169.254.0.0', 16, 'ipv4'],
  ['0.0.0.0', null, 'ipv4'],
  ['224.0.0.0', 4, 'ipv4'],
  ['255.255.255.255', null, 'ipv4'],
  ['fe80::', 10, 'ipv6'],
  ['::', null, 'ipv6'],
  ['ff00::', 8, 'ipv6'],
]);

// Частные сети: http к ним допустим (Ollama на компьютере или в локальной сети).
const PRIVATE = makeBlockList([
  ['10.0.0.0', 8, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['::1', null, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
]);

// Loopback: сам контейнер или компьютер врача.
const LOOPBACK = makeBlockList([
  ['127.0.0.0', 8, 'ipv4'],
  ['::1', null, 'ipv6'],
]);

// IPv6 в восемь 16-битных групп; null, если это не IPv6.
function expandIpv6(addr: string): number[] | null {
  let a = addr.toLowerCase();
  const zone = a.indexOf('%');
  if (zone >= 0) a = a.slice(0, zone);
  const dotted = a.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const p = dotted[2].split('.').map(Number);
    if (p.some((n) => n > 255)) return null;
    a = dotted[1] + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16);
  }
  const halves = a.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const fill = 8 - head.length - tail.length;
  if (fill < (halves.length === 2 ? 1 : 0)) return null;
  const groups = [...head, ...Array(Math.max(fill, 0)).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

const v4FromGroups = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

type AddrClass = 'blocked' | 'private' | 'public';

// Приводит адрес к обычному виду: ::ffff:a.b.c.d и NAT64 → IPv4, IPv6 → полная запись.
// null — не адрес или устаревший вид ::a.b.c.d, который считается служебным.
function normalizeAddress(ip: string): { addr: string; family: 'ipv4' | 'ipv6' } | null {
  if (net.isIPv6(ip)) {
    const g = expandIpv6(ip);
    if (!g) return null;
    const zeros5 = g.slice(0, 5).every((n) => n === 0);
    if (zeros5 && g[5] === 0xffff) return { addr: v4FromGroups(g[6], g[7]), family: 'ipv4' };   // ::ffff:a.b.c.d
    if (g.slice(0, 6).every((n) => n === 0) && (g[6] !== 0 || g[7] > 1)) return null;           // ::a.b.c.d
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0)) {
      return { addr: v4FromGroups(g[6], g[7]), family: 'ipv4' };                                // NAT64
    }
    return { addr: g.map((n) => n.toString(16)).join(':'), family: 'ipv6' };
  }
  return net.isIPv4(ip) ? { addr: ip, family: 'ipv4' } : null;
}

function classifyAddress(ip: string, local: net.BlockList | null): AddrClass {
  const n = normalizeAddress(ip);
  if (!n) return 'blocked';
  if (BLOCKED.check(n.addr, n.family)) return 'blocked';
  if (local && local.check(n.addr, n.family)) return 'blocked';
  return PRIVATE.check(n.addr, n.family) ? 'private' : 'public';
}

function buildLocalList(subnets: string[] | undefined): net.BlockList | null {
  if (!subnets || subnets.length === 0) return null;
  const list = new net.BlockList();
  for (const cidr of subnets) {
    const [addr, prefixRaw] = String(cidr).split('/');
    const prefix = Number(prefixRaw);
    const family = net.isIPv4(addr) ? 'ipv4' : net.isIPv6(addr) ? 'ipv6' : null;
    if (!family || !Number.isInteger(prefix)) continue;
    try { list.addSubnet(addr, prefix, family); } catch { /* кривая подсеть пропускается */ }
  }
  return list;
}

// Сервер за Caddy: Ollama на этом компьютере допустима только на своём порту.
export const OLLAMA_PORT = '11434';
const DOCKER_HOST_NAMES = new Set(['host.docker.internal', 'gateway.docker.internal']);
const DEFAULT_DOCKER_GATEWAYS = ['172.17.0.1'];

export interface AddressRules {
  localSubnets?: string[];      // подсети самого контейнера (запрещены)
  serverMode?: boolean;         // задан PUBLIC_URL с https
  dockerGateways?: string[];    // шлюзы Docker (по умолчанию 172.17.0.1)
}

type UrlProblem = 'invalid_url' | 'insecure_url' | 'blocked_url';

// Решение по уже найденным адресам: служебные — запрет, http — только частные,
// в серверном режиме порт шлюза Docker — только 11434. Общая для проверки при
// сохранении и для проверки в момент соединения.
export function judgeAddresses(addresses: string[], o: { https: boolean; port: string; host: string } & AddressRules):
  { ok: true; isLocal: boolean } | { ok: false; code: 'insecure_url' | 'blocked_url' } {
  const local = buildLocalList(o.localSubnets);
  const classes = addresses.map((a) => classifyAddress(a, local));
  if (classes.includes('blocked')) return { ok: false, code: 'blocked_url' };
  const gateways = buildLocalList((o.dockerGateways ?? DEFAULT_DOCKER_GATEWAYS).map((g) => `${g}/32`));
  const isGateway = (a: string): boolean => {
    const n = normalizeAddress(a);
    return !!n && !!gateways && gateways.check(n.addr, n.family);
  };
  const viaDockerHost = DOCKER_HOST_NAMES.has(o.host) || addresses.some(isGateway);
  if (o.serverMode && o.port !== OLLAMA_PORT && viaDockerHost) return { ok: false, code: 'blocked_url' };
  let isLocal: boolean;
  if (o.serverMode) {
    // Сервер: без подтверждения передачи только loopback и шлюз Docker на порту Ollama;
    // остальные частные сети разрешены, но передача данных туда требует подтверждения.
    isLocal = addresses.every((a) => {
      const n = normalizeAddress(a);
      return !!n && (LOOPBACK.check(n.addr, n.family) || (o.port === OLLAMA_PORT && (DOCKER_HOST_NAMES.has(o.host) || isGateway(a))));
    });
  } else {
    isLocal = classes.every((c) => c === 'private');
  }
  if (!o.https && !classes.every((c) => c === 'private')) return { ok: false, code: 'insecure_url' };
  return { ok: true, isLocal };
}

const hostOf = (u: URL): string => {
  let host = u.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  return host.replace(/\.$/, '');
};

// isLocal: адрес на этом компьютере или в частной сети (все найденные адреса частные).
// От него зависит, нужно ли подтверждение передачи данных.
export async function checkLlmBaseUrl(raw: string, deps: AddressRules & {
  lookup?: (host: string) => Promise<{ address: string; family: number }[]>;
} = {}): Promise<{ ok: true; baseUrl: string; isLocal: boolean } | { ok: false; code: UrlProblem; message: string }> {
  const fail = (code: UrlProblem, message = LLM_SETTINGS_MESSAGES[code]) =>
    ({ ok: false as const, code, message });

  const baseUrl = normalizeLlmBaseUrl(raw);
  if (!baseUrl) return fail('invalid_url');
  const u = new URL(baseUrl);
  const https = u.protocol === 'https:';
  const host = hostOf(u);
  const port = u.port || (https ? '443' : '80');

  if (SERVICE_NAMES.has(host)) return fail('blocked_url');
  if (LOCAL_NAMES.has(host)) {
    if (deps.serverMode && DOCKER_HOST_NAMES.has(host) && port !== OLLAMA_PORT) return fail('blocked_url');
    return { ok: true, baseUrl, isLocal: true };
  }

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    const lookup = deps.lookup ?? ((h: string) => dns.promises.lookup(h, { all: true }));
    try {
      addresses = (await lookup(host)).map((r) => r.address);
    } catch {
      return fail('invalid_url', 'Не удалось найти сервер по этому адресу. Проверьте, как написан адрес.');
    }
    if (addresses.length === 0) return fail('invalid_url', 'Не удалось найти сервер по этому адресу. Проверьте, как написан адрес.');
  }

  const verdict = judgeAddresses(addresses, { https, port, host, ...deps });
  if ('code' in verdict) return fail(verdict.code);
  return { ok: true, baseUrl, isLocal: verdict.isLocal };
}

// Функция lookup для соединения: имя разрешается заново в момент подключения, и
// все адреса проходят ту же проверку, что при сохранении. Закрывает окно между
// проверкой и запросом (DNS-rebinding). Запрещённый адрес → ошибка с кодом ERR_LLM_BLOCKED.
export const LLM_BLOCKED_CODE = 'ERR_LLM_BLOCKED';
// Настройки сохранены без подтверждения передачи, а адрес стал внешним.
export const LLM_UNCONFIRMED_CODE = 'ERR_LLM_UNCONFIRMED';

export function makeGuardedLookup(baseUrl: string, deps: AddressRules & {
  allowPublic?: boolean;   // false: настройки без подтверждения передачи — только локальные адреса
  resolve?: (host: string) => Promise<{ address: string; family: number }[]>;
} = {}) {
  const u = new URL(baseUrl);
  const https = u.protocol === 'https:';
  const host = hostOf(u);
  const port = u.port || (https ? '443' : '80');
  const resolve = deps.resolve ?? ((h: string) => dns.promises.lookup(h, { all: true }));
  return (hostname: string, options: any, cb: any) => {
    if (typeof options === 'function') { cb = options; options = {}; }
    resolve(hostname).then((found) => {
      if (found.length === 0) { cb(Object.assign(new Error('LLM: имя не найдено'), { code: 'ENOTFOUND' })); return; }
      const verdict = judgeAddresses(found.map((r) => r.address), { https, port, host, ...deps });
      if ('code' in verdict) { cb(Object.assign(new Error(`LLM: ${verdict.code}`), { code: LLM_BLOCKED_CODE })); return; }
      if (deps.allowPublic === false && !verdict.isLocal) { cb(Object.assign(new Error('LLM: transfer'), { code: LLM_UNCONFIRMED_CODE })); return; }
      if (options?.all) cb(null, found);
      else cb(null, found[0].address, found[0].family);
    }, (err) => cb(err));
  };
}

// ── Ключ ─────────────────────────────────────────────────────────────────────

export function maskApiKey(key: string | null): string | null {
  if (key === null || key === '') return null;
  return key.length < 12 ? '••••' : '••••' + key.slice(-4);
}

// Одна копия правила на сервер и форму: src/utils/llmForm.ts.
export { sameOrigin };

// Что хранить после сохранения: Ollama — без ключа; '' — убрать; непустой — новый;
// не прислан — прежний, но только если адрес остался на том же сервере (иначе ключ
// ушёл бы на чужой адрес).
export function keyAfterUpdate(prev: { baseUrl: string; apiKey: string | null } | null,
  next: { provider: LlmProvider; baseUrl: string; apiKey?: string }): string | null {
  if (next.provider === 'ollama') return null;
  if (next.apiKey === '') return null;
  if (next.apiKey) return next.apiKey;
  if (prev && prev.apiKey && sameOrigin(prev.baseUrl, next.baseUrl)) return prev.apiKey;
  return null;
}
