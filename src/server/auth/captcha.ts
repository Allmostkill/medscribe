import crypto from "crypto";
import svgCaptcha from "svg-captcha";
import { decryptData, encryptData } from "../crypto";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";

// ── Captcha single-use tracking ──────────────────────────────────────────────
// The captcha "id" is an encrypted JSON {text, expiresAt, nonce}. To prevent
// reuse (e.g. solving once and spamming /api/auth/login), we record each consumed
// nonce in this Set. Entries are evicted automatically after their expiry.
// Map nonce -> expiresAt капчи. Записи удаляются по сроку жизни капчи; решённую
// капчу после истечения срока всё равно не принять (проверка expiresAt ниже).
const usedCaptchaNonces = new Map<string, number>();

function pruneCaptchaNonces(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of usedCaptchaNonces) {
    if (expiresAt < now) usedCaptchaNonces.delete(nonce);
  }
}
setInterval(pruneCaptchaNonces, 5 * 60 * 1000).unref();

/**
 * Verify a captcha token + answer atomically. Returns null on success,
 * or an error message string on failure. Marks the nonce as used on success.
 */
export function verifyAndConsumeCaptcha(captchaId: unknown, captchaAnswer: unknown): string | null {
  if (typeof captchaId !== 'string' || typeof captchaAnswer !== 'string') {
    return "Неверная капча";
  }
  let stored: any;
  try {
    stored = JSON.parse(decryptData(captchaId));
  } catch {
    return "Неверная или устаревшая капча";
  }
  if (!stored?.text || !stored?.expiresAt || !stored?.nonce) {
    return "Неверная капча";
  }
  if (stored.expiresAt < Date.now()) {
    return "Капча устарела";
  }
  if (stored.text !== captchaAnswer.toLowerCase()) {
    return "Неверная капча";
  }
  if (usedCaptchaNonces.has(stored.nonce)) {
    return "Эта капча уже использована";
  }
  pruneCaptchaNonces();
  usedCaptchaNonces.set(stored.nonce, stored.expiresAt);
  return null;
}

// ── Login attempt tracking — лёгкая капча по требованию ───────────────────────
// Капча на каждом входе раздражает живого врача. Вместо этого считаем неудачные
// попытки по IP: пока их меньше CAPTCHA_AFTER_FAILURES в окне — капча не нужна,
// после порога — /api/auth/login требует капчу и возвращает requiresCaptcha:true.
// IP rate-limit (10/15мин) остаётся жёстким backstop'ом поверх этого.
const CAPTCHA_AFTER_FAILURES = 3;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; firstAt: number }>();

export function loginCaptchaRequired(ip: string): boolean {
  const rec = loginFailures.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > LOGIN_FAIL_WINDOW_MS) {
    loginFailures.delete(ip);
    return false;
  }
  return rec.count >= CAPTCHA_AFTER_FAILURES;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const rec = loginFailures.get(ip);
  if (!rec || now - rec.firstAt > LOGIN_FAIL_WINDOW_MS) {
    loginFailures.set(ip, { count: 1, firstAt: now });
  } else {
    rec.count += 1;
  }
  if (loginFailures.size > 10_000) loginFailures.clear(); // защита от роста памяти
}

export function clearLoginFailures(ip: string): void {
  loginFailures.delete(ip);
}

export const generateCaptchaHandler = (req: any, res: any) => {
  try {
    const captcha = svgCaptcha.create({ size: 5, noise: 2 });
    const expiresAt = Date.now() + 5 * 60 * 1000;
    // nonce makes each captcha id single-use (see verifyAndConsumeCaptcha)
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = JSON.stringify({ text: captcha.text.toLowerCase(), expiresAt, nonce });
    const id = encryptData(payload);

    res.json({ id, svg: captcha.data });
  } catch (e: any) {
    logError('AUTH_006', safeErr(e));
    res.status(500).json({ error: 'Failed to generate captcha' });
  }
};
