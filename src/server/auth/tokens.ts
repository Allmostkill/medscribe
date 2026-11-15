import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JWT_SECRET } from "../config";
import { db } from "../context";
import { getClientIp } from "../clientIp";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";

// Verify a JWT pinning the HS256 algorithm. Without an explicit allow-list
// jsonwebtoken honours whatever `alg` the token header claims, opening the
// door to alg-confusion attacks. We only ever sign with HS256, so pin it.
export function verifyJwt(token: string): any {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

// ── Refresh tokens — "Запомнить меня" ────────────────────────────────────────
// Long-lived (30d) opaque random strings, hashed at rest. Issued alongside the
// 8h JWT on every login/2FA path. Rotated on every use.
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;          // 30 дней
const REFRESH_TTL_SEC = Math.floor(REFRESH_TTL_MS / 1000);
const ACCESS_TTL_SEC = 8 * 60 * 60;                       // 8 часов

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a new refresh token for a doctor, persist its hash, return the
 * plaintext (the only place we ever see it — never logged).
 */
async function issueRefreshToken(doctorId: string, req?: any): Promise<{ token: string; expiresInSeconds: number }> {
  const plaintext = 'rt_' + crypto.randomBytes(32).toString('hex'); // 256 bits
  const id = 'rt_' + crypto.randomBytes(8).toString('hex');
  const tokenHash = hashRefreshToken(plaintext);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  const ua = (req?.headers?.['user-agent'] as string | undefined)?.slice(0, 500) || null;
  const ip = getClientIp(req);

  const { error } = await db.from('refresh_tokens').insert({
    id,
    doctor_id: doctorId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    user_agent: ua,
    ip,
  });
  if (error) {
    logError('AUTH_011', `issueRefreshToken insert failed: ${safeErr(error)}`);
    throw new Error('Failed to issue refresh token');
  }
  return { token: plaintext, expiresInSeconds: REFRESH_TTL_SEC };
}

/**
 * Issue a fresh access JWT for the given doctor identity.
 */
function issueAccessToken(doctorId: string, email: string): { token: string; expiresInSeconds: number } {
  const token = jwt.sign({ id: doctorId, email }, JWT_SECRET, { expiresIn: '8h' });
  return { token, expiresInSeconds: ACCESS_TTL_SEC };
}

/**
 * Issue access + refresh pair. Shorthand for the 5 login surfaces.
 */
export async function issueSessionPair(doctorId: string, email: string, req?: any) {
  const access = issueAccessToken(doctorId, email);
  const refresh = await issueRefreshToken(doctorId, req);
  return {
    token: access.token,
    expiresInSeconds: access.expiresInSeconds,
    refreshToken: refresh.token,
    refreshExpiresInSeconds: refresh.expiresInSeconds,
  };
}

/**
 * Revoke a refresh token (logout). Idempotent. Looks up by hash.
 */
export async function revokeRefreshToken(plaintext: string): Promise<void> {
  const tokenHash = hashRefreshToken(plaintext);
  await db
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('revoked_at', null);
}

/**
 * Revoke ALL refresh tokens for a doctor (used on password change, 2FA toggle,
 * suspicious activity). Idempotent.
 */
async function revokeAllRefreshTokens(doctorId: string): Promise<void> {
  const { error } = await db
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('doctor_id', doctorId)
    .is('revoked_at', null);
  if (error) throw error;
}

// ── Проверка сессии: кэш на 45 с ─────────────────────────────────────────────
// Access JWT stateless и живёт 8 ч. Чтобы смена пароля, переключение 2FA и
// удаление врача действовали сразу, сверяем iat токена с doctors.sessions_valid_after
// (отметка сдвигается в bumpSessions). В БД ходим не на каждый запрос.
const AUTH_FLOOR_TTL_MS = 45_000;
const authFloorCache = new Map<string, { floor: number | null; at: number }>();

function invalidateAuthFloor(doctorId: string): void {
  authFloorCache.delete(doctorId);
}

/** sessions_valid_after в мс; null — врача нет. Бросает при ошибке БД. */
async function getAuthFloor(doctorId: string): Promise<number | null> {
  const hit = authFloorCache.get(doctorId);
  if (hit && Date.now() - hit.at < AUTH_FLOOR_TTL_MS) return hit.floor;
  const { data, error } = await db
    .from('doctors').select('sessions_valid_after').eq('id', doctorId).maybeSingle();
  if (error) throw error;
  let floor: number | null = null;
  if (data) {
    const t = new Date(data.sessions_valid_after).getTime();
    floor = Number.isFinite(t) ? t : 0;
  }
  if (authFloorCache.size > 10_000) authFloorCache.clear();
  authFloorCache.set(doctorId, { floor, at: Date.now() });
  return floor;
}

/** Причина отказа для токена или null, если сессия действует. Бросает при ошибке БД. */
export async function sessionRejection(decoded: { id: string; iat?: number }): Promise<string | null> {
  const floor = await getAuthFloor(decoded.id);
  if (floor === null) return 'Аккаунт не найден. Войдите снова.';
  // Отметка округлена до секунды (см. bumpSessions), iat тоже в секундах
  if (typeof decoded.iat !== 'number' || decoded.iat < Math.floor(floor / 1000)) {
    return 'Сессия завершена. Войдите снова.';
  }
  return null;
}

/** true — можно пускать; иначе ответ уже отправлен. Ошибка БД = отказ (fail closed). */
export async function ensureSessionValid(decoded: { id: string; iat?: number }, res: express.Response): Promise<boolean> {
  try {
    const reason = await sessionRejection(decoded);
    if (!reason) return true;
    res.status(401).json({ error: reason });
  } catch {
    res.status(503).json({ error: 'Не удалось проверить аккаунт. Повторите позже.' });
  }
  return false;
}

/**
 * Завершить все прежние сессии врача: сдвинуть sessions_valid_after на текущую
 * секунду и отозвать refresh-токены. Секунда округляется вниз: iat в JWT целые
 * секунды, и пара, выданная сразу после сдвига, иначе была бы отвергнута.
 */
export async function bumpSessions(doctorId: string): Promise<void> {
  const validAfter = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
  const { error } = await db
    .from('doctors').update({ sessions_valid_after: validAfter }).eq('id', doctorId);
  if (error) throw error;
  await revokeAllRefreshTokens(doctorId);
  invalidateAuthFloor(doctorId);
}
