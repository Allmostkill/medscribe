import express from "express";
import bcrypt from "bcryptjs";
import { MEDICAL_SPECIALTIES } from "../../config/specialties";
import { db } from "../context";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";
import { rateLimit } from "../middleware/rateLimit";
import { requireFullAuth } from "../middleware/auth";
import { issueSessionPair, bumpSessions } from "../auth/tokens";
import { hashPassword, toPublicDoctor } from "../auth/doctor";
import { PROTOCOL_TEMPLATE_MAX } from "../ai/prompt";

export function registerProfileRoutes(app: express.Express) {
  app.get("/api/auth/profile", requireFullAuth, async (req: any, res) => {
    try {
      const { data: doctor } = await db.from('doctors').select('*').eq('id', req.user.id).single();
      if (!doctor) return res.status(404).json({ error: "Врач не найден" });
      res.json({
        doctor: toPublicDoctor(doctor)
      });
    } catch (e) {
      logError('DB_004', safeErr(e));
      res.status(500).json({ error: "Ошибка чтения профиля" });
    }
  });

  app.put("/api/auth/profile", requireFullAuth, async (req: any, res) => {
    try {
      const { specialtyId, name } = req.body || {};
      const updateData: any = {};
      if (specialtyId !== undefined && specialtyId !== null) {
        if (typeof specialtyId !== 'string' || !Object.prototype.hasOwnProperty.call(MEDICAL_SPECIALTIES, specialtyId)) {
          return res.status(400).json({ error: 'Выберите специальность из списка' });
        }
        updateData.specialtyId = specialtyId;
      }
      if (name !== undefined && name !== null) {
        const cleanName = typeof name === 'string' ? name.trim() : '';
        if (cleanName.length < 1 || cleanName.length > 200) {
          return res.status(400).json({ error: 'Имя должно быть от 1 до 200 символов' });
        }
        updateData.name = cleanName;
      }
      // Личный шаблон протокола (см. db/initdb/20-schema.sql).
      // Пустая строка — «убрать шаблон». Длина ограничена: это текст для промпта.
      if (typeof req.body.protocolTemplate === 'string') {
        if (req.body.protocolTemplate.length > PROTOCOL_TEMPLATE_MAX) {
          return res.status(400).json({ error: `Шаблон протокола не длиннее ${PROTOCOL_TEMPLATE_MAX} символов` });
        }
        updateData.protocol_template = req.body.protocolTemplate.trim() || null;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updErr } = await db.from('doctors').update(updateData).eq('id', req.user.id);
        if (updErr) throw updErr;
      }

      const { data: doctor } = await db.from('doctors').select('*').eq('id', req.user.id).single();
      if (!doctor) return res.status(404).json({ error: "Врач не найден" });

      res.json({
        success: true,
        doctor: toPublicDoctor(doctor)
      });
    } catch (e) {
      logError('DB_004', safeErr(e));
      res.status(500).json({ error: "Ошибка сохранения профиля" });
    }
  });

  // Password change endpoint
  app.post("/api/auth/change-password", rateLimit(5, 15 * 60 * 1000), requireFullAuth, async (req: any, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: "Новый пароль должен быть не менее 8 символов" });
      }
      const { data: doctor } = await db.from('doctors').select('*').eq('id', req.user.id).single();
      if (!doctor || !bcrypt.compareSync(oldPassword, doctor.password)) {
        return res.status(401).json({ error: "Неверный текущий пароль" });
      }
      const { error: pwErr } = await db.from('doctors').update({ password: hashPassword(newPassword) }).eq('id', req.user.id);
      if (pwErr) throw pwErr;
      // Пароль сменили: старые access- и refresh-токены умирают, текущей вкладке выдаём новую пару
      await bumpSessions(req.user.id);
      const session = await issueSessionPair(req.user.id, doctor.email, req);
      res.json({ success: true, message: "Пароль успешно изменен", ...session });
    } catch (e) {
      logError('DB_004', safeErr(e));
      res.status(500).json({ error: "Ошибка при смене пароля" });
    }
  });
}
