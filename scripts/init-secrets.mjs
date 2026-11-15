// Создаёт секреты в SECRETS_DIR (по умолчанию /app/secrets), если их ещё нет.
// Существующие файлы никогда не перезаписываются. В журнал — только имена.
import { randomBytes } from 'node:crypto';
import {
  closeSync, existsSync, fsyncSync, linkSync, mkdirSync, openSync,
  readdirSync, readFileSync, unlinkSync, writeSync,
} from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SECRETS_DIR || '/app/secrets';

function rand() {
  return randomBytes(32).toString('hex');
}

function fsyncPath(path, flags) {
  const fd = openSync(path, flags);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

// Записывает файл, только если его нет: tmp со случайным именем + fsync +
// link (падает с EEXIST, если цель уже есть, — перезаписи не будет) + unlink tmp.
// pid в контейнере всегда 1, поэтому остатки прерванных запусков чистим по маске.
function ensure(name, makeValue) {
  const target = join(dir, name);
  if (existsSync(target)) return false;
  const prefix = `.${name}.`;
  for (const f of readdirSync(dir)) {
    if (f.startsWith(prefix) && f.endsWith('.tmp')) unlinkSync(join(dir, f));
  }
  const tmp = join(dir, `${prefix}${randomBytes(8).toString('hex')}.tmp`);
  const fd = openSync(tmp, 'wx', 0o444);
  try {
    writeSync(fd, makeValue());
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    linkSync(tmp, target);
  } catch (err) {
    if (err.code === 'EEXIST') return false; // файл уже есть — не перезаписываем
    throw err;
  } finally {
    unlinkSync(tmp);
  }
  fsyncPath(dir, 'r');
  return true;
}

try {
  mkdirSync(dir, { recursive: true });
  const created = [];
  for (const name of [
    'jwt_secret',
    'data_encryption_key',
    'postgrest_jwt_secret',
    'postgres_password',
    'authenticator_password',
  ]) {
    if (ensure(name, rand)) created.push(name);
  }
  if (
    ensure('postgrest_db_uri', () => {
      const pw = readFileSync(join(dir, 'authenticator_password'), 'utf8').trim();
      return `postgres://authenticator:${pw}@postgres:5432/medscribe`;
    })
  ) {
    created.push('postgrest_db_uri');
  }
  console.log(
    created.length
      ? `[init-secrets] создано: ${created.join(', ')}`
      : '[init-secrets] все секреты уже есть',
  );
} catch (err) {
  console.error(`[init-secrets] ошибка: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
