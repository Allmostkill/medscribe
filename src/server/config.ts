import dotenv from "dotenv";
import { readSecret } from "./secrets";

dotenv.config();

// ── Секреты: переменная окружения важнее файла из тома secrets ───────────────
function requireSecret(envName: string, fileName: string): string {
  const v = readSecret(envName, fileName);
  if (!v) {
    console.error(`❌ ОШИБКА: секрет ${envName} не найден ни в .env, ни в /app/secrets — запустите через docker compose`);
    process.exit(1);
  }
  if (v.length < 32) {
    console.error(`❌ ОШИБКА: ${envName} должен быть не короче 32 символов (рекомендуется: openssl rand -hex 32).`);
    process.exit(1);
  }
  return v;
}

export const JWT_SECRET = requireSecret('JWT_SECRET', 'jwt_secret');
export const DATA_ENCRYPTION_KEY = requireSecret('DATA_ENCRYPTION_KEY', 'data_encryption_key');
export const POSTGREST_JWT_SECRET = readSecret('POSTGREST_JWT_SECRET', 'postgrest_jwt_secret');
if (DATA_ENCRYPTION_KEY === JWT_SECRET || (POSTGREST_JWT_SECRET && POSTGREST_JWT_SECRET === JWT_SECRET)) {
  console.error('❌ ОШИБКА: JWT_SECRET, DATA_ENCRYPTION_KEY и POSTGREST_JWT_SECRET должны различаться (каждый: openssl rand -hex 32).');
  process.exit(1);
}

// X-Forwarded-For is fully client-controlled unless a trusted reverse proxy
// rewrites it. Honour it ONLY when TRUST_PROXY=true (i.e. the app sits behind
// nginx/Cloudflare that strips inbound XFF). Otherwise an attacker rotates the
// header to dodge every per-IP rate limit. Default: use the real socket peer.
//
// Берём САМЫЙ ПРАВЫЙ адрес списка: его дописал наш доверенный прокси и он
// содержит реальный адрес клиента. Левые элементы клиент вправе подставить сам
// (X-Forwarded-For: 1.2.3.4 — прокси лишь дописывает справа), поэтому самый левый
// адрес позволял бы обходить лимиты по IP простой ротацией заголовка.
export const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

// ── T-one (Т-Банк) self-hosted STT — основной микрофонный провайдер ──────────
// Отдельный Python-сервис (tone-service/) на localhost.
export const toneServiceUrl = process.env.TONE_SERVICE_URL || 'http://127.0.0.1:5001';

// 2FA по умолчанию выключена: включается ENABLE_2FA=true
export const TWO_FA_ENABLED = process.env.ENABLE_2FA === 'true';

export const PORT = Number(process.env.PORT) || 3000;

// Вне production слушаем только loopback: dev-сервер не должен быть виден в сети.
export const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

// Прежние значения ключей шифрования (через запятую) для ротации — см. crypto.ts.
export const DATA_ENCRYPTION_KEY_OLD = process.env.DATA_ENCRYPTION_KEY_OLD;
