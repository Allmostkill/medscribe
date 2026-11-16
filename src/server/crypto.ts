import crypto from "crypto";
import { DATA_ENCRYPTION_KEY, DATA_ENCRYPTION_KEY_OLD } from "./config";

// ── AES-256-GCM encryption (authenticated) ───────────────────────────────────
// Ключ выводится из DATA_ENCRYPTION_KEY — отдельного от JWT_SECRET секрета
// (defence-in-depth). Записи имеют префикс "v2:"; всё остальное не читается.
const ENCRYPTION_KEY = crypto.createHash('sha256').update(DATA_ENCRYPTION_KEY).digest(); // 32 bytes

// ── Ротация ключа шифрования ─────────────────────────────────────────────────
//
// Смена DATA_ENCRYPTION_KEY без сохранения прежнего значения безвозвратно
// делает старые медицинские записи нечитаемыми.
//
// Прежние значения перечисляются в DATA_ENCRYPTION_KEY_OLD через запятую и
// пробуются при неудаче с текущим ключом: положил прежнее значение сюда —
// данные читаются дальше.
const parseKeyList = (v?: string): string[] =>
  String(v || '').split(',').map(x => x.trim()).filter(Boolean);

const OLD_DATA_KEYS = parseKeyList(DATA_ENCRYPTION_KEY_OLD)
  .map(k => crypto.createHash('sha256').update(k).digest());

export function encryptData(text: string): string {
  const iv = crypto.randomBytes(12); // 96 bits, standard for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'v2:' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptData(text: string): string {
  if (text.startsWith('v2:')) {
    const parts = text.slice(3).split(':');
    if (parts.length !== 3) throw new Error('Malformed v2 ciphertext');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    let lastErr: unknown;
    for (const key of [ENCRYPTION_KEY, ...OLD_DATA_KEYS]) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      } catch (e) { lastErr = e; }
    }
    throw lastErr instanceof Error ? lastErr : new Error('v2 decrypt failed');
  }
  throw new Error('Unsupported ciphertext format');
}
