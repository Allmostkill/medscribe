/**
 * Клиент локальной базы: PostgREST напрямую, без облака.
 *
 * Сервер ходит с ролью service_role. Токен (HS256, живёт 1 час) подставляется
 * на каждый запрос через кастомный fetch и перевыпускается, когда до конца
 * срока остаётся меньше 5 минут.
 */
import { PostgrestClient } from '@supabase/postgrest-js';
import jwt from 'jsonwebtoken';
import { readSecret } from './secrets';

const TOKEN_TTL_SEC = 3600;
const REFRESH_BEFORE_SEC = 300;

export function createDb(env: NodeJS.ProcessEnv = process.env): PostgrestClient {
  const url = env.POSTGREST_URL || 'http://postgrest:3000';
  const secret = readSecret('POSTGREST_JWT_SECRET', 'postgrest_jwt_secret', env);
  if (!secret) throw new Error('нет секрета PostgREST');

  let token = '';
  let expiresAt = 0;
  const getToken = (): string => {
    const now = Math.floor(Date.now() / 1000);
    if (!token || expiresAt - now < REFRESH_BEFORE_SEC) {
      expiresAt = now + TOKEN_TTL_SEC;
      token = jwt.sign({ role: 'service_role', exp: expiresAt }, secret, { algorithm: 'HS256' });
    }
    return token;
  };

  const authedFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${getToken()}`);
    return fetch(input, { ...init, headers });
  };

  return new PostgrestClient(url, { fetch: authedFetch });
}
