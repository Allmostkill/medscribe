import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { JWT_SECRET } from "../config";
import { db } from "../context";
import { getClientIp } from "../clientIp";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";
import { rateLimit } from "../middleware/rateLimit";
import { issueSessionPair, revokeRefreshToken, hashRefreshToken } from "../auth/tokens";
import { verifyAndConsumeCaptcha, loginCaptchaRequired, recordLoginFailure, clearLoginFailures, generateCaptchaHandler } from "../auth/captcha";
import { toPublicDoctor } from "../auth/doctor";

export function registerAuthRoutes(app: express.Express) {
  app.get("/api/auth/captcha", rateLimit(30, 60 * 1000), generateCaptchaHandler);

  // Login Endpoint
  app.post("/api/auth/login", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    const { email, password, captchaId, captchaAnswer } = req.body;
    const ip = getClientIp(req);

    if (!email || !password) {
      return res.status(400).json({ error: "Email и пароль обязательны" });
    }

    // Капча требуется только после серии неудачных попыток с этого IP.
    if (loginCaptchaRequired(ip)) {
      if (!captchaId || !captchaAnswer) {
        return res.status(400).json({ error: "Подтвердите, что вы не робот", requiresCaptcha: true });
      }
      const captchaErr = verifyAndConsumeCaptcha(captchaId, captchaAnswer);
      if (captchaErr) return res.status(400).json({ error: captchaErr, requiresCaptcha: true });
    }

    try {
      const { data: doctor } = await db.from('doctors').select('*').eq('email', email.toLowerCase()).single();

      if (!doctor || !bcrypt.compareSync(password, doctor.password)) {
        recordLoginFailure(ip);
        return res.status(401).json({ error: "Неверный логин или пароль", requiresCaptcha: loginCaptchaRequired(ip) });
      }

      // Пароль верный — сбрасываем счётчик неудач (касается и ветки ниже: 2FA)
      clearLoginFailures(ip);

      if (doctor.is_two_factor_enabled) {
        const tempToken = jwt.sign({ id: doctor.id, email: doctor.email, isPartial: true }, JWT_SECRET, { expiresIn: '5m' });
        return res.json({ requires2FA: true, tempToken });
      }

      const session = await issueSessionPair(doctor.id, doctor.email, req);

      res.json({
        success: true,
        ...session,
        doctor: toPublicDoctor(doctor)
      });
    } catch (err) {
      res.status(500).json({ error: "Ошибка при входе" });
    }
  });

  // ── /api/auth/refresh — обменять refresh на новую пару (access + refresh) ──
  // Клиент дёргает на старте или при 401 от любого защищённого эндпоинта.
  // Сделана ротация: предыдущий refresh помечается used + revoked сразу.
  app.post("/api/auth/refresh", rateLimit(30, 15 * 60 * 1000), async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ error: 'Нет refresh-токена' });
    }
    try {
      const tokenHash = hashRefreshToken(refreshToken);
      const { data: row } = await db
        .from('refresh_tokens')
        .select('id, doctor_id, expires_at, revoked_at, created_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      if (!row) return res.status(401).json({ error: 'Сессия не найдена. Войдите снова.' });
      if (row.revoked_at) return res.status(401).json({ error: 'Сессия отозвана. Войдите снова.' });
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(401).json({ error: 'Сессия истекла. Войдите снова.' });
      }

      // Тянем профиль (чтобы вернуть актуальный doctor вместе с токенами)
      const { data: doctor } = await db
        .from('doctors').select('*').eq('id', row.doctor_id).maybeSingle();
      if (!doctor) return res.status(401).json({ error: 'Аккаунт не найден' });
      // Токен выдан раньше последнего сброса сессий (смена пароля, 2FA) — не принимаем
      const issuedSec = Math.floor(new Date(row.created_at).getTime() / 1000);
      const validAfterSec = Math.floor(new Date(doctor.sessions_valid_after).getTime() / 1000);
      if (Number.isFinite(validAfterSec) && issuedSec < validAfterSec) {
        return res.status(401).json({ error: 'Сессия завершена. Войдите снова.' });
      }
      // Ротация атомарно: отзываем, только если токен ещё не отозван. Две
      // одновременные попытки — обновится строка лишь в одной из них.
      const nowIso = new Date().toISOString();
      const { data: rotated, error: rotErr } = await db
        .from('refresh_tokens')
        .update({ revoked_at: nowIso, last_used_at: nowIso })
        .eq('id', row.id)
        .is('revoked_at', null)
        .select('id');
      if (rotErr) throw rotErr;
      if (!rotated || rotated.length !== 1) {
        return res.status(401).json({ error: 'Сессия отозвана. Войдите снова.' });
      }
      const session = await issueSessionPair(doctor.id, doctor.email, req);

      res.json({
        success: true,
        ...session,
        doctor: toPublicDoctor(doctor),
      });
    } catch (e: any) {
      logError('AUTH_012', `refresh failed: ${safeErr(e)}`);
      res.status(500).json({ error: 'Не удалось обновить сессию' });
    }
  });

  // ── /api/auth/logout — отзываем текущий refresh, чтобы он больше не работал ──
  // Access JWT никак не отозвать (он stateless), но он живёт максимум 8h —
  // приемлемая граница для медицинского приложения.
  app.post("/api/auth/logout", async (req, res) => {
    const { refreshToken } = req.body || {};
    if (refreshToken && typeof refreshToken === 'string') {
      try { await revokeRefreshToken(refreshToken); } catch { /* idempotent */ }
    }
    res.json({ success: true });
  });
}
