/**
 * Проверка клиента языковой модели на локальном http-моке.
 *
 *   npx tsx scripts/check-llm.ts
 *
 * Выбор конфигурации, заголовок
 * Authorization только при ключе, LLM_JSON_MODE=false, таймаут,
 * срезание ```json, ошибки на HTTP 500 и пустой ответ, перенаправления (redirect).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolveLlmConfig, callLlm, createGuardedDispatcher, LlmError, llmErrorMessage, MAX_LLM_RESPONSE_BYTES, type LlmConfig } from '../src/server/llm';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(56)} ${detail}`);
};

type Seen = { auth: string | undefined; body: any; url: string | undefined };
let seen: Seen | null = null;
let mode: 'ok' | 'fence' | 'empty' | 'error' | 'slow' | 'nojson' | 'redirect' | 'huge' | 'hugeNoLength' | 'reasoning' | 'reasoningPlain' | 'reasoningLength' | 'reasoningContent' | 'effort400' = 'ok';
let status = 500;

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    seen = { auth: req.headers.authorization, body: JSON.parse(raw || '{}'), url: req.url };
    if (mode === 'error') { res.statusCode = status; res.end('boom'); return; }
    if (mode === 'redirect') { res.statusCode = status; res.setHeader('Location', '/elsewhere'); res.end(); return; }
    if (mode === 'huge') { res.setHeader('Content-Length', String(MAX_LLM_RESPONSE_BYTES + 1)); res.end('x'.repeat(MAX_LLM_RESPONSE_BYTES + 1)); return; }
    if (mode === 'hugeNoLength') {
      // без Content-Length (chunked): размер считается по потоку
      res.write('x'.repeat(MAX_LLM_RESPONSE_BYTES + 1));
      res.end();
      return;
    }
    if (mode === 'nojson') { res.end('<html>'); return; }
    if (mode === 'slow') { setTimeout(() => { try { res.end('{}'); } catch {} }, 1000); return; }
    if (mode === 'effort400' && 'reasoning_effort' in seen.body) { res.statusCode = 400; res.end('bad'); return; }
    if (mode === 'reasoningLength') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: '', reasoning: '{"ok": true}' }, finish_reason: 'length' }] }));
      return;
    }
    if (mode === 'reasoningContent') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: null, reasoning_content: '{"ok": true}' }, finish_reason: 'stop' }] }));
      return;
    }
    if (mode === 'reasoning' || mode === 'reasoningPlain') {
      const reasoning = mode === 'reasoning' ? '</\n\n{"ok": true}' : 'no json here';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: '', reasoning } }] }));
      return;
    }
    const content = mode === 'empty' ? '   ' : mode === 'fence' ? '```json\n{"a":1}\n```' : '{"ok":true}';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
});

async function rejects(p: Promise<unknown>): Promise<string | null> {
  try { await p; return null; } catch (e: any) { return String(e?.message ?? e); }
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try { await p; return null; } catch (e: any) { return e instanceof LlmError ? e.code : `not LlmError: ${e?.message ?? e}`; }
}

async function main() {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;

  console.log('Выбор конфигурации');
  check('без ключей — null', resolveLlmConfig({}) === null);
  const a = resolveLlmConfig({ LLM_BASE_URL: 'http://x/v1/', LLM_MODEL: 'm1' });
  check('LLM_BASE_URL + LLM_MODEL → конфигурация', a?.model === 'm1');
  check('завершающий / срезан', a?.baseUrl === 'http://x/v1');
  check('LLM_API_KEY может быть пустым', a?.apiKey === '');
  check('только LLM_BASE_URL без модели — null', resolveLlmConfig({ LLM_BASE_URL: 'http://x' }) === null);
  check('jsonMode и таймаут по умолчанию', a?.jsonMode === true && a.timeoutMs === 60000);
  const c = resolveLlmConfig({ LLM_BASE_URL: 'http://x', LLM_MODEL: 'm', LLM_JSON_MODE: 'false', LLM_TIMEOUT_MS: '1234' });
  check('LLM_JSON_MODE=false и LLM_TIMEOUT_MS', c?.jsonMode === false && c.timeoutMs === 1234);

  console.log('Запросы к моку');
  const cfg: LlmConfig = { baseUrl: base, apiKey: 'secret', model: 'mock', jsonMode: true, timeoutMs: 5000 };

  mode = 'ok';
  const t1 = await callLlm(cfg, 'привет', 'система');
  check('ответ возвращён', t1 === '{"ok":true}', t1);
  check('путь /chat/completions', seen?.url === '/chat/completions');
  check('Authorization: Bearer при ключе', seen?.auth === 'Bearer secret');
  check('response_format json_object', seen?.body.response_format?.type === 'json_object');
  check('system + user, temperature 0.3',
    seen?.body.messages?.[0]?.role === 'system' && seen.body.messages[1]?.role === 'user' && seen.body.temperature === 0.3);

  await callLlm({ ...cfg, apiKey: '' }, 'x');
  check('без ключа нет Authorization', seen?.auth === undefined);
  check('без system — одно сообщение', seen?.body.messages?.length === 1);

  await callLlm({ ...cfg, jsonMode: false }, 'x');
  check('jsonMode=false убирает response_format', seen !== null && !('response_format' in seen.body));

  console.log('Ollama: без рассуждений');
  mode = 'ok';
  await callLlm({ ...cfg, noThinking: true }, 'x');
  check('noThinking → reasoning_effort none', seen?.body.reasoning_effort === 'none');
  await callLlm(cfg, 'x');
  check('без noThinking нет reasoning_effort', seen !== null && !('reasoning_effort' in seen.body));
  const oll: LlmConfig = { ...cfg, noThinking: true };
  mode = 'reasoning';
  check('пустой content + JSON в reasoning → берём JSON', (await callLlm(oll, 'x')) === '{"ok": true}');
  check('то же без JSON-режима → bad_response', (await codeOf(callLlm({ ...oll, jsonMode: false }, 'x'))) === 'bad_response');
  check('то же без noThinking (не Ollama) → bad_response', (await codeOf(callLlm(cfg, 'x'))) === 'bad_response');
  mode = 'reasoningPlain';
  check('в reasoning нет JSON → bad_response', (await codeOf(callLlm(oll, 'x'))) === 'bad_response');
  mode = 'reasoningLength';
  check('finish_reason length → bad_response', (await codeOf(callLlm(oll, 'x'))) === 'bad_response');
  mode = 'reasoningContent';
  check('content null + reasoning_content → берём JSON', (await callLlm(oll, 'x')) === '{"ok": true}');
  mode = 'effort400';
  seen = null;
  check('400 на reasoning_effort → повтор без него', (await callLlm(oll, 'x')) === '{"ok":true}' && seen !== null && !('reasoning_effort' in (seen as Seen).body));
  let n = 0;
  const count = http.createServer((q, r) => { n++; q.resume(); r.statusCode = 400; r.end('no'); });
  await new Promise<void>((r) => count.listen(0, '127.0.0.1', r));
  const cbase = `http://127.0.0.1:${(count.address() as AddressInfo).port}`;
  check('без noThinking 400 не повторяется', (await codeOf(callLlm({ ...cfg, baseUrl: cbase }, 'x'))) === 'bad_request' && n === 1);
  n = 0;
  check('noThinking и вечный 400: ровно два запроса', (await codeOf(callLlm({ ...oll, baseUrl: cbase }, 'x'))) === 'bad_request' && n === 2);
  count.close(); count.closeAllConnections?.();

  mode = 'fence';
  check('срезание ```json', (await callLlm(cfg, 'x')) === '{"a":1}');

  mode = 'error';
  const e1 = await rejects(callLlm(cfg, 'x'));
  check('HTTP 500 → ошибка', e1 === 'LLM HTTP 500', e1 ?? '');

  mode = 'empty';
  const e2 = await rejects(callLlm(cfg, 'x'));
  check('пустой ответ → ошибка', e2 !== null, e2 ?? '');

  mode = 'slow';
  const e3 = await rejects(callLlm({ ...cfg, timeoutMs: 100 }, 'x'));
  check('таймаут → ошибка', e3 !== null && e3.includes('таймаут'), e3 ?? '');

  console.log('Коды ошибок');
  mode = 'error';
  for (const [st, code] of [[401, 'auth'], [403, 'auth'], [402, 'payment'], [429, 'rate_limit'], [404, 'not_found'], [400, 'bad_request'], [503, 'server']] as const) {
    status = st;
    const got = await codeOf(callLlm(cfg, 'x'));
    check(`HTTP ${st} → ${code}`, got === code, got ?? '');
  }
  status = 500;
  const e4 = await rejects(callLlm(cfg, 'x'));
  check('message прежний: LLM HTTP 500', e4 === 'LLM HTTP 500', e4 ?? '');
  mode = 'redirect';
  for (const st of [301, 302, 307, 308]) {
    status = st;
    check(`HTTP ${st} → redirect`, (await codeOf(callLlm(cfg, 'x'))) === 'redirect');
  }
  check('за перенаправлением не идёт', seen?.url === '/chat/completions', seen?.url ?? '');
  status = 500;
  mode = 'nojson';
  check('не-JSON → bad_response', (await codeOf(callLlm(cfg, 'x'))) === 'bad_response');
  mode = 'empty';
  check('пустой ответ → bad_response', (await codeOf(callLlm(cfg, 'x'))) === 'bad_response');
  mode = 'slow';
  check('таймаут → timeout', (await codeOf(callLlm({ ...cfg, timeoutMs: 100 }, 'x'))) === 'timeout');
  // Закрытый порт: берём свободный порт и сразу освобождаем.
  const closed = await new Promise<number>((r) => {
    const s = http.createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as AddressInfo).port; s.close(() => r(p)); });
  });
  check('закрытый порт → network',
    (await codeOf(callLlm({ ...cfg, baseUrl: `http://127.0.0.1:${closed}` }, 'x'))) === 'network');
  check('адрес с логином и паролем → bad_url',
    (await codeOf(callLlm({ ...cfg, baseUrl: 'http://user:pass@127.0.0.1:1/v1' }, 'x'))) === 'bad_url');
  console.log('Размер ответа');
  mode = 'huge';
  check('Content-Length больше 5 МБ → bad_response', (await codeOf(callLlm(cfg, 'x'))) === 'bad_response');
  mode = 'hugeNoLength';
  check('поток больше 5 МБ без Content-Length → bad_response', (await codeOf(callLlm(cfg, 'x'))) === 'bad_response');
  mode = 'ok';
  check('обычный ответ после этого читается', (await callLlm(cfg, 'x')) === '{"ok":true}');

  console.log('Проверка адреса в момент соединения');
  // Имя «rebind.test» не существует: lookup подставлен. Первый раз разрешается в служебный адрес.
  const resolveTo = (addr: string) => async () => [{ address: addr, family: 4 }];
  const bad1 = createGuardedDispatcher(`http://rebind.test:${port}`, { resolve: resolveTo('169.254.169.254') });
  check('имя → служебный адрес: blocked_url',
    (await codeOf(callLlm({ ...cfg, baseUrl: `http://rebind.test:${port}`, dispatcher: bad1 }, 'x'))) === 'blocked_url');
  const bad2 = createGuardedDispatcher(`https://rebind.test:${port}`, { resolve: resolveTo('169.254.169.254') });
  check('то же по https: blocked_url',
    (await codeOf(callLlm({ ...cfg, baseUrl: `https://rebind.test:${port}`, dispatcher: bad2 }, 'x'))) === 'blocked_url');
  const bad3 = createGuardedDispatcher(`http://rebind.test:${port}`, { resolve: resolveTo('93.184.216.34') });
  check('http на публичный адрес: blocked_url',
    (await codeOf(callLlm({ ...cfg, baseUrl: `http://rebind.test:${port}`, dispatcher: bad3 }, 'x'))) === 'blocked_url');
  const good = createGuardedDispatcher(`http://ok.test:${port}`, { resolve: resolveTo('127.0.0.1') });
  seen = null;
  check('имя → локальный адрес: запрос проходит',
    (await callLlm({ ...cfg, baseUrl: `http://ok.test:${port}`, dispatcher: good }, 'x')) === '{"ok":true}' && seen?.url === '/chat/completions');
  const noAck = createGuardedDispatcher(`https://rebind.test:${port}`, { resolve: resolveTo('93.184.216.34'), allowPublic: false });
  check('без подтверждения передачи, публичный адрес: transfer_unconfirmed',
    (await codeOf(callLlm({ ...cfg, baseUrl: `https://rebind.test:${port}`, dispatcher: noAck }, 'x'))) === 'transfer_unconfirmed');
  const noAckLocal = createGuardedDispatcher(`http://ok.test:${port}`, { resolve: resolveTo('127.0.0.1'), allowPublic: false });
  check('без подтверждения передачи, локальный адрес: проходит',
    (await callLlm({ ...cfg, baseUrl: `http://ok.test:${port}`, dispatcher: noAckLocal }, 'x')) === '{"ok":true}');
  const withAck = createGuardedDispatcher(`https://rebind.test:${port}`, { resolve: resolveTo('93.184.216.34'), allowPublic: true });
  check('с подтверждением, публичный адрес: проверку передачи проходит',
    (await codeOf(callLlm({ ...cfg, baseUrl: `https://rebind.test:${port}`, dispatcher: withAck }, 'x'))) !== 'transfer_unconfirmed');
  mode = 'redirect';
  status = 302;
  check('через агента: перенаправление → redirect',
    (await codeOf(callLlm({ ...cfg, baseUrl: `http://ok.test:${port}`, dispatcher: good }, 'x'))) === 'redirect');
  const closedAgent = createGuardedDispatcher(`http://ok.test:${port}`, { resolve: resolveTo('127.0.0.1') });
  await closedAgent.close();
  check('закрытый агент (ClientClosedError) → network, не сырое исключение',
    (await codeOf(callLlm({ ...cfg, baseUrl: `http://ok.test:${port}`, dispatcher: closedAgent }, 'x'))) === 'network');
  status = 500;
  mode = 'ok';
  await Promise.all([bad1.close(), bad2.close(), bad3.close(), good.close(), noAck.close(), noAckLocal.close(), withAck.close()]);

  check('тексты: все коды заполнены',
    (['not_configured', 'auth', 'payment', 'rate_limit', 'not_found', 'bad_request', 'bad_url', 'blocked_url', 'redirect', 'server', 'timeout', 'network', 'bad_response', 'settings_unavailable', 'transfer_unconfirmed', 'bad_json'] as const)
      .every((c) => llmErrorMessage(c).length > 20));
  check('тексты не отсылают к .env',
    (['not_configured', 'auth', 'not_found', 'bad_request', 'bad_url', 'timeout', 'network', 'bad_response', 'bad_json'] as const)
      .every((c) => !llmErrorMessage(c).includes('.env')));

  server.close();
  server.closeAllConnections?.();
  if (bad) { console.log(`\nПровалено проверок: ${bad}`); process.exit(1); }
  console.log('\nВсё в порядке');
}

main().catch((e) => { console.error(e); process.exit(1); });
