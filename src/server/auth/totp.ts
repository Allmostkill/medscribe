import { authenticator } from "otplib";

// ── TOTP: один код — один раз ────────────────────────────────────────────────
// otplib (окно 0) принимает код своего 30-секундного шага. Запоминаем последний
// принятый шаг по врачу: подсмотренный код повторно не пройдёт. Память процесса:
// после рестарта защита сбрасывается, но окно кода всё равно 30 с.
// Неверные коды считаем по врачу (а не только по IP): 5 ошибок — пауза 15 мин.
const TOTP_STEP_SEC = 30;
const TOTP_MAX_FAILS = 5;
const TOTP_LOCK_MS = 15 * 60 * 1000;
const lastTotpStep = new Map<string, number>();
const totpFails = new Map<string, { count: number; lockedUntil: number }>();
export function verifyTotpOnce(doctorId: string, token: unknown, secret: string): boolean {
  const now = Date.now();
  const fails = totpFails.get(doctorId);
  if (fails && fails.lockedUntil > now) return false;
  const fail = () => {
    // после истёкшей паузы счёт начинается заново
    const prev = fails && fails.lockedUntil === 0 ? fails.count : 0;
    const count = prev + 1;
    totpFails.set(doctorId, { count, lockedUntil: count >= TOTP_MAX_FAILS ? now + TOTP_LOCK_MS : 0 });
    return false;
  };
  if (typeof token !== 'string' || !/^\d{6}$/.test(token.trim())) return fail();
  const delta = authenticator.checkDelta(token.trim(), secret);
  if (delta === null || delta === undefined) return fail();
  const step = Math.floor(now / (TOTP_STEP_SEC * 1000)) + delta;
  const last = lastTotpStep.get(doctorId);
  if (last !== undefined && step <= last) return fail();
  lastTotpStep.set(doctorId, step);
  totpFails.delete(doctorId);
  return true;
}
