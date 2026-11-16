/**
 * Чтение секретов: переменная окружения важнее файла из тома `secrets`.
 * Значения нигде не логируются.
 */
import fs from 'node:fs';
import path from 'node:path';

export function readSecret(
  envName: string,
  fileName: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const fromEnv = env[envName];
  if (fromEnv) return fromEnv;
  try {
    const dir = env.SECRETS_DIR || '/app/secrets';
    const value = fs.readFileSync(path.join(dir, fileName), 'utf8').trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}
