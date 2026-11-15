#!/usr/bin/env node
/**
 * Страховочная проверка маршрутов: поднимает настоящий сервер без базы и без
 * языковой модели и сверяет, что каждый маршрут отвечает тем, чем должен.
 *
 *   node scripts/check-routes.mjs
 *
 * Главное, что здесь ловится: порядок подключения. Если защита (requireFullAuth)
 * окажется зарегистрированной ПОСЛЕ маршрута, маршрут станет открытым, а сборка
 * и типы этого не заметят. Поэтому для каждого защищённого маршрута проверено
 * три состояния: без токена (401), с полным токеном при недоступной базе (503 —
 * сессия не проверяется, отказ закрытый) и с временным токеном 2FA (403).
 *
 * Базы нет намеренно (POSTGREST_URL указывает в пустоту): проверка не требует
 * Docker и не трогает чужие данные. Пустые строки в env не дают dotenv
 * подставить значения из .env разработчика.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
const hex = () => crypto.randomBytes(32).toString('hex');

const PORT = await freePort();
const JWT_SECRET = hex();
const env = {
  ...process.env,
  NODE_ENV: 'development',
  DISABLE_HMR: 'true',
  PORT: String(PORT),
  JWT_SECRET,
  DATA_ENCRYPTION_KEY: hex(),
  POSTGREST_JWT_SECRET: hex(),
  POSTGREST_URL: 'http://127.0.0.1:1',
  TONE_SERVICE_URL: 'http://127.0.0.1:1',
  SECRETS_DIR: path.join(os.tmpdir(), `medscribe-no-secrets-${crypto.randomBytes(4).toString('hex')}`),
  LLM_BASE_URL: '',
  LLM_MODEL: '',
  ENABLE_2FA: '',
  TRUST_PROXY: '',
};

const FULL = jwt.sign({ id: 'doc_test', email: 't@t.t' }, JWT_SECRET, { expiresIn: '8h' });
const PARTIAL = jwt.sign({ id: 'doc_test', email: 't@t.t', isPartial: true }, JWT_SECRET, { expiresIn: '5m' });

const child = spawn(path.join(ROOT, 'node_modules/.bin/tsx'), ['server.ts'], {
  cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'],
});
let out = '';
child.stdout.on('data', d => { out += d; });
child.stderr.on('data', d => { out += d; });

const stop = () => new Promise(resolve => {
  if (child.exitCode !== null || child.signalCode) return resolve();
  child.once('exit', () => resolve());
  child.kill('SIGTERM');
  setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000).unref();
});

const started = await new Promise(resolve => {
  const t = setTimeout(() => resolve(false), 30_000);
  const tick = setInterval(() => {
    if (out.includes('[MedScribe] http://localhost')) { clearTimeout(t); clearInterval(tick); resolve(true); }
    else if (child.exitCode !== null) { clearTimeout(t); clearInterval(tick); resolve(false); }
  }, 100);
});
if (!started) {
  console.error('сервер не запустился за 30 с. Вывод:\n' + out);
  await stop();
  process.exit(1);
}

const BASE = `http://127.0.0.1:${PORT}`;
const rows = [];
let failed = 0;
// Строка резервируется до запроса: параллельные случаи печатаются в порядке записи.
const record = (name, want, got, ok, slot = rows.length) => {
  if (!ok) failed++;
  rows[slot] = [ok ? 'OK' : 'FAIL', name, String(want), String(got)];
};

async function call(method, url, { token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) payload = raw;
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + url, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* не JSON */ }
  return { status: res.status, headers: res.headers, text, json };
}

const expectStatus = async (name, want, method, url, opts) => {
  const slot = rows.length;
  rows.push(null);
  try {
    const r = await call(method, url, opts);
    record(name, want, r.status, r.status === want, slot);
    return r;
  } catch (e) {
    record(name, want, `ошибка: ${e.message}`, false, slot);
    return null;
  }
};

try {
  // 1. health и заголовки безопасности
  {
    const r = await call('GET', '/api/health');
    const h = r.headers;
    const ok = r.status === 200 && r.json?.status === 'ok'
      && r.json.db === false && r.json.tone === false && r.json.llm === false
      && h.get('x-content-type-options') === 'nosniff'
      && h.get('x-frame-options') === 'DENY'
      && h.get('referrer-policy') === 'no-referrer'
      && (h.get('permissions-policy') || '').includes('microphone=(self)')
      && !h.has('x-powered-by');
    record('1 GET /api/health: 200, db/tone/llm=false, заголовки, нет x-powered-by',
      '200 ok', `${r.status} ${JSON.stringify(r.json)}`, ok);
  }
  // 2
  {
    const r = await call('GET', '/api/auth/config');
    record('2 GET /api/auth/config', '200 {twoFactor:false}', `${r.status} ${r.text}`,
      r.status === 200 && r.json?.twoFactor === false);
  }
  // 3
  {
    const r = await call('GET', '/api/setup/status');
    record('3 GET /api/setup/status без базы', '503 db_unavailable', `${r.status} ${r.json?.code}`,
      r.status === 503 && r.json?.code === 'db_unavailable');
  }
  // 4
  await expectStatus('4 POST /api/setup, Sec-Fetch-Site: cross-site', 403, 'POST', '/api/setup',
    { body: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } });
  // 5
  await expectStatus('5 POST /api/auth/login {}', 400, 'POST', '/api/auth/login', { body: {} });
  // 6
  {
    const r = await call('GET', '/api/auth/captcha');
    record('6 GET /api/auth/captcha', '200 id+svg', `${r.status} id=${typeof r.json?.id} svg=${typeof r.json?.svg}`,
      r.status === 200 && typeof r.json?.id === 'string' && typeof r.json?.svg === 'string');
  }
  // 7, 8
  await expectStatus('7 POST /api/auth/refresh {}', 400, 'POST', '/api/auth/refresh', { body: {} });
  // База недоступна: это 500, а не 401 «Сессия не найдена» (клиент стёр бы живую сессию)
  await expectStatus('7б POST /api/auth/refresh с токеном при недоступной базе', 500, 'POST', '/api/auth/refresh', { body: { refreshToken: 'x'.repeat(40) } });
  await expectStatus('8 POST /api/auth/logout {}', 200, 'POST', '/api/auth/logout', { body: {} });
  // 9-12
  await expectStatus('9 GET /api/auth/profile без токена', 401, 'GET', '/api/auth/profile');
  await expectStatus('10 POST /api/auth/2fa/generate без токена (2FA выключена)', 404, 'POST', '/api/auth/2fa/generate');
  await expectStatus('11 POST /api/auth/2fa/disable без токена', 401, 'POST', '/api/auth/2fa/disable');
  await expectStatus('12 POST /api/auth/2fa/verify-login {}', 401, 'POST', '/api/auth/2fa/verify-login', { body: {} });

  // 13-15. Защищённые маршруты
  const protectedRoutes = [
    ['GET', '/api/drafts'],
    ['POST', '/api/drafts'],
    ['PATCH', '/api/drafts/x'],
    ['DELETE', '/api/drafts/x'],
    ['GET', '/api/guidelines?code=I10'],
    ['GET', '/api/guidelines/doc/1_1'],
    ['GET', '/api/workspace-layout'],
    ['PUT', '/api/workspace-layout'],
    ['POST', '/api/ai/hints'],
    ['POST', '/api/ai/communication'],
    ['POST', '/api/ai/note-check'],
    ['POST', '/api/ai/pharma'],
    ['POST', '/api/ai/suggest-diagnosis'],
    ['POST', '/api/ai/patient-summary'],
    ['POST', '/api/ai/analyze'],
    ['GET', '/api/ai/llm-status'],
    ['POST', '/api/ai/llm-test'],
    ['PUT', '/api/ai/llm-settings'],
    ['DELETE', '/api/ai/llm-settings'],
    ['GET', '/api/ai/stt-engine'],
    ['PUT', '/api/ai/stt-engine'],
    ['POST', '/api/ai/stt-engine/download'],
    ['GET', '/api/ai/ollama/discover'],
    ['GET', '/api/ai/unknown'],
  ];
  // DELETE /api/ai/llm-settings принимает {password}; остальные DELETE тела не читают.
  const withBody = m => (m === 'GET' ? {} : { body: {} });
  for (const [m, u] of protectedRoutes) {
    await expectStatus(`13 ${m} ${u} без токена`, 401, m, u, withBody(m));
  }
  await expectStatus('13 POST /api/stt/full без токена', 401, 'POST', '/api/stt/full', { raw: Buffer.from('x') });
  // Клиент базы повторяет запрос при сетевой ошибке (около 7 с на попытку), поэтому
  // эти случаи идут параллельно.
  await Promise.all([
    ...protectedRoutes.map(([m, u]) =>
      expectStatus(`14 ${m} ${u} с полным токеном, база недоступна`, 503, m, u, { ...withBody(m), token: FULL })),
    expectStatus('14 POST /api/stt/full с полным токеном, база недоступна', 503, 'POST', '/api/stt/full',
      { raw: Buffer.from('x'), token: FULL }),
  ]);
  await expectStatus('15 GET /api/drafts с временным токеном 2FA', 403, 'GET', '/api/drafts', { token: PARTIAL });
  await expectStatus('15 GET /api/auth/profile с временным токеном 2FA', 403, 'GET', '/api/auth/profile', { token: PARTIAL });

  // 16
  {
    const r = await call('GET', '/api/nope');
    record('16 GET /api/nope', "404 'Endpoint not found'", `${r.status} ${r.json?.error}`,
      r.status === 404 && r.json?.error === 'Endpoint not found');
  }
  // 17. JSON больше лимита 2 МБ
  {
    const big = JSON.stringify({ refreshToken: 'x'.repeat(3 * 1024 * 1024) });
    const r = await call('POST', '/api/auth/refresh', { headers: { 'Content-Type': 'application/json' }, raw: big });
    record('17 POST /api/auth/refresh, JSON 3 МБ', '413 Слишком большой запрос', `${r.status} ${r.json?.error}`,
      r.status === 413 && r.json?.error === 'Слишком большой запрос');
  }

  // 18. WebSocket
  const wsOutcome = (url, protocols) => new Promise(resolve => {
    const w = new WebSocket(url, protocols);
    const t = setTimeout(() => { w.terminate(); resolve('таймаут'); }, 8000);
    let opened = false;
    w.on('open', () => { opened = true; });
    w.on('close', code => { clearTimeout(t); resolve(opened ? `close ${code}` : `разрыв без апгрейда (close ${code})`); });
    w.on('error', () => { /* итог придёт в close */ });
  });
  {
    const got = await wsOutcome(`ws://127.0.0.1:${PORT}/ws/other`);
    record('18 WS /ws/other', 'разрыв без апгрейда', got, got.startsWith('разрыв без апгрейда'));
  }
  {
    const got = await wsOutcome(`ws://127.0.0.1:${PORT}/ws/stt/tone`);
    record('18 WS /ws/stt/tone без подпротокола', 'close 1008', got, got === 'close 1008');
  }
  {
    const got = await wsOutcome(`ws://127.0.0.1:${PORT}/ws/stt/tone`, ['bearer', FULL]);
    record("18 WS /ws/stt/tone ['bearer', FULL], база недоступна", 'close 1011', got, got === 'close 1011');
  }

  // 19. Последним: лимит входа (10 за 15 минут на IP; запрос из случая 5 уже учтён)
  {
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await call('POST', '/api/auth/login', { body: {} })).status);
    const ok = statuses[10] === 429;
    record('19 11 подряд POST /api/auth/login {}: 11-й — 429', '11-й 429', statuses.join(','), ok);
  }
} finally {
  await stop();
}

const w = [Math.max(...rows.map(r => r[1].length), 4), 0];
console.log(`${'ст.'.padEnd(5)}${'случай'.padEnd(w[0] + 2)}ожидание → факт`);
for (const [st, name, want, got] of rows) {
  console.log(`${st.padEnd(5)}${name.padEnd(w[0] + 2)}${want} → ${got}`);
}
if (failed) {
  console.error(`\nРАСХОЖДЕНИЙ: ${failed} из ${rows.length}`);
  process.exit(1);
}
console.log(`\nмаршруты сходятся (${rows.length} проверок)`);
