import express from "express";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { db } from "../context";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";
import { rateLimit } from "../middleware/rateLimit";
import { requireFullAuth, requireTwoFaEnabled } from "../middleware/auth";
import { verifyJwt, sessionRejection, issueSessionPair, bumpSessions } from "../auth/tokens";
import { verifyTotpOnce } from "../auth/totp";
import { toPublicDoctor } from "../auth/doctor";

export function registerTwoFactorRoutes(app: express.Express) {
  app.post("/api/auth/2fa/generate", requireTwoFaEnabled, requireFullAuth, async (req: any, res) => {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(req.user.email, 'MedScribe', secret);
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      res.json({ secret, qrCodeUrl: qrCodeDataUrl });
    } catch (e) {
      logError('AUTH_006', safeErr(e));
      res.status(500).json({ error: "Ошибка генерации QR-кода" });
    }
  });

  app.post("/api/auth/2fa/enable", rateLimit(5, 15 * 60 * 1000), requireTwoFaEnabled, requireFullAuth, async (req: any, res) => {
    const { secret, token, password } = req.body || {};
    if (!secret || !token || typeof secret !== 'string') return res.status(400).json({ error: "Не заполнены поля" });
    try {
      // Пароль обязателен: и secret, и код при включении задаёт вызывающий, так
      // что обладатель угнанного access-токена мог привязать СВОЙ аутентификатор
      // и выдавить владельца из аккаунта. Смена пароля этого уже требует.
      const { data: owner, error: ownerErr } = await db.from('doctors').select('password').eq('id', req.user.id).single();
      if (ownerErr && !owner) throw ownerErr;
      if (!owner || !password || !bcrypt.compareSync(String(password), owner.password)) {
        return res.status(401).json({ error: "Неверный текущий пароль" });
      }
      if (!verifyTotpOnce(req.user.id, token, secret)) return res.status(400).json({ error: "Неверный код" });
      const { error: updErr } = await db.from('doctors')
        .update({ two_factor_secret: secret, is_two_factor_enabled: true })
        .eq('id', req.user.id);
      if (updErr) throw updErr;
      // Как при смене пароля: старые сессии завершаем, текущей выдаём новую пару токенов
      await bumpSessions(req.user.id);
      const session = await issueSessionPair(req.user.id, req.user.email, req);
      res.json({ success: true, ...session });
    } catch (e) {
      logError('AUTH_004', safeErr(e));
      res.status(500).json({ error: "Ошибка сохранения параметров 2FA" });
    }
  });

  // Тело: { password: string (текущий пароль), token: string (6 цифр TOTP) }
  app.post("/api/auth/2fa/disable", rateLimit(5, 15 * 60 * 1000), requireFullAuth, async (req: any, res) => {
    const { token, password } = req.body || {};
    try {
      const { data: doctor, error: docErr } = await db
        .from('doctors').select('password, two_factor_secret').eq('id', req.user.id).single();
      if (docErr && !doctor) throw docErr;
      if (!doctor) return res.status(404).json({ error: "Врач не найден" });
      if (!password || typeof password !== 'string' || !bcrypt.compareSync(password, doctor.password)) {
        return res.status(401).json({ error: "Неверный текущий пароль" });
      }
      if (!doctor.two_factor_secret) return res.status(400).json({ error: "2FA не настроена" });
      if (!verifyTotpOnce(req.user.id, token, doctor.two_factor_secret)) return res.status(400).json({ error: "Неверный код" });
      const { error: updErr } = await db.from('doctors')
        .update({ two_factor_secret: null, is_two_factor_enabled: false })
        .eq('id', req.user.id);
      if (updErr) throw updErr;
      await bumpSessions(req.user.id);
      const session = await issueSessionPair(req.user.id, req.user.email, req);
      res.json({ success: true, ...session });
    } catch (e) {
      logError('AUTH_004', safeErr(e));
      res.status(500).json({ error: "Ошибка отключения 2FA" });
    }
  });

  app.post("/api/auth/2fa/verify-login", rateLimit(10, 15 * 60 * 1000), async (req: any, res) => {
    const { tempToken, token } = req.body;
    try {
      const decoded: any = verifyJwt(tempToken);
      if (!decoded.isPartial) return res.status(400).json({ error: "Неверный токен" });
      // Временный токен, выданный до смены/сброса пароля, не меняем на сессию
      const rejected = await sessionRejection(decoded);
      if (rejected) return res.status(401).json({ error: rejected });

      const { data: doctor } = await db.from('doctors').select('*').eq('id', decoded.id).single();
      if (!doctor || !doctor.is_two_factor_enabled || !doctor.two_factor_secret) {
          return res.status(400).json({ error: "2FA не настроена" });
      }
      if (!verifyTotpOnce(doctor.id, token, doctor.two_factor_secret)) return res.status(401).json({ error: "Неверный код" });

      const session = await issueSessionPair(doctor.id, doctor.email, req);

      res.json({
        success: true,
        ...session,
        doctor: toPublicDoctor(doctor)
      });
    } catch (err) {
      res.status(401).json({ error: "Сессия истекла" });
    }
  });
}
