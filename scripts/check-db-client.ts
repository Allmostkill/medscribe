/**
 * Проверка клиента локальной базы (src/server/db.ts, src/server/secrets.ts).
 *
 *   npx tsx scripts/check-db-client.ts
 *
 * Поднимает http-мок вместо PostgREST и проверяет: запрос уходит на
 * POSTGREST_URL/doctors с Bearer JWT (role=service_role, верная подпись, срок
 * ~1 час); readSecret: env важнее файла, без обоих — undefined, перевод строки
 * срезается.
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { createDb } from '../src/server/db';
import { readSecret } from '../src/server/secrets';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(56)} ${detail}`);
};

const SECRET = 'a'.repeat(64);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-db-'));

async function main() {
  // readSecret
  fs.writeFileSync(path.join(dir, 'x'), 'from-file\n');
  check('файл: перевод строки срезается', readSecret('NOPE_X', 'x', { SECRETS_DIR: dir }) === 'from-file');
  check('env важнее файла', readSecret('X', 'x', { X: 'from-env', SECRETS_DIR: dir }) === 'from-env');
  check('пустой env → файл', readSecret('X', 'x', { X: '', SECRETS_DIR: dir }) === 'from-file');
  check('нет ни env, ни файла → undefined', readSecret('X', 'missing', { SECRETS_DIR: dir }) === undefined);

  // createDb
  let threw = false;
  try { createDb({ SECRETS_DIR: dir }); } catch { threw = true; }
  check('нет секрета → ошибка', threw);

  const seen: { url?: string; auth?: string }[] = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization });
    res.setHeader('Content-Type', 'application/json');
    res.end('[{"id":"1"}]');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;

  try {
    const db = createDb({ POSTGREST_URL: `http://127.0.0.1:${port}`, POSTGREST_JWT_SECRET: SECRET });
    const { data, error } = await db.from('doctors').select('id');
    check('запрос выполнен без ошибки', !error && Array.isArray(data) && data.length === 1);
    const req = seen[0];
    check('уходит на /doctors?select=id', req?.url === '/doctors?select=id', String(req?.url));
    const m = /^Bearer (.+)$/.exec(req?.auth || '');
    check('есть Bearer-токен', !!m);
    let payload: any = null;
    try { payload = jwt.verify(m![1], SECRET, { algorithms: ['HS256'] }); } catch { /* ниже провал */ }
    check('подпись верна', !!payload);
    check('role=service_role', payload?.role === 'service_role');
    const ttl = (payload?.exp ?? 0) - Math.floor(Date.now() / 1000);
    check('срок ~1 час', ttl > 3500 && ttl <= 3600, `${ttl} c`);
    await db.from('doctors').select('id');
    check('токен кэшируется', seen[1]?.auth === req?.auth);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log(bad ? `\nПровалено: ${bad}` : '\nВсё в порядке');
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
