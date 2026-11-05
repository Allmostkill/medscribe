import express from "express";
import crypto from "crypto";
import { MEDICAL_SPECIALTIES } from "../../config/specialties";
import { db } from "../context";
import { logError, logWarn } from "../errors/logger";
import { safeErr } from "../logSafe";
import { rateLimit } from "../middleware/rateLimit";
import { issueSessionPair } from "../auth/tokens";
import { hashPassword, isValidEmail, toPublicDoctor } from "../auth/doctor";
import { clearSetupToken, setupTokenMatches } from "../setup";

export function registerSetupRoutes(app: express.Express) {
  // ── Первый запуск ──────────────────────────────────────────────────────────
  app.get("/api/setup/status", rateLimit(60, 15 * 60 * 1000), async (req, res) => {
    try {
      const { data, error } = await db.from('doctors').select('id').limit(1)
        .abortSignal(AbortSignal.timeout(3000));
      if (error) throw error;
      res.json({ needsSetup: !data || data.length === 0 });
    } catch {
      logWarn('DB_010', 'setup/status: база не ответила');
      res.status(503).json({ error: 'База данных недоступна', code: 'db_unavailable' });
    }
  });

  app.post("/api/setup", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    const body = req.body || {};
    try {
      const { data: existing, error: existErr } = await db.from('doctors').select('id').limit(1);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) {
        clearSetupToken();
        return res.status(409).json({ error: 'Аккаунт уже создан', code: 'already_set_up' });
      }
      if (!setupTokenMatches(body.setupToken)) {
        return res.status(403).json({ error: 'Неверный код первого запуска', code: 'bad_setup_token' });
      }
      const { name, email, password, specialtyId } = body;
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (cleanName.length < 1 || cleanName.length > 200) {
        return res.status(400).json({ error: 'Укажите имя (до 200 символов)' });
      }
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Некорректный email' });
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        return res.status(400).json({ error: 'Пароль должен быть от 8 до 200 символов' });
      }
      if (typeof specialtyId !== 'string' || !Object.prototype.hasOwnProperty.call(MEDICAL_SPECIALTIES, specialtyId)) {
        return res.status(400).json({ error: 'Выберите специальность из списка' });
      }

      const { data: row, error } = await db.from('doctors').insert({
        id: 'doc_' + crypto.randomBytes(8).toString('hex'),
        email: cleanEmail,
        password: hashPassword(password),
        name: cleanName,
        specialtyId,
        experienceYears: 0,
        sessions_valid_after: new Date(Math.floor(Date.now() / 1000) * 1000).toISOString(),
      }).select('*').single();
      if (error) {
        if ((error as any).code === '23505') {
          clearSetupToken();
          return res.status(409).json({ error: 'Аккаунт уже создан', code: 'already_set_up' });
        }
        throw error;
      }
      clearSetupToken();
      const session = await issueSessionPair(row.id, row.email, req);
      res.status(201).json({ success: true, ...session, doctor: toPublicDoctor(row) });
    } catch (e) {
      logError('SETUP_001', safeErr(e));
      res.status(500).json({ error: 'Не удалось создать аккаунт' });
    }
  });
}
