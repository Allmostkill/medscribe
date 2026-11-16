import express from "express";
import crypto from "crypto";
import { db } from "../context";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";
import { encryptData, decryptData } from "../crypto";

export function registerDraftsRoutes(app: express.Express) {
  // Save Draft Endpoint
  app.post("/api/drafts", async (req: any, res) => {
    const { content, transcript } = req.body;
    const doctorId = req.user?.id;
    // Date.now() в миллисекундах: два черновика в одну миллисекунду давали
    // коллизию первичного ключа и 500 вместо сохранения протокола.
    const draftId = "draft_" + Date.now() + "_" + crypto.randomBytes(6).toString('hex');
    try {
      const payloadString = JSON.stringify({...content, transcript});
      const encryptedPayload = encryptData(payloadString);

      const { error: insErr } = await db.from('ehr_drafts').insert({
        id: draftId, doctor_id: doctorId, content: encryptedPayload
      });
      if (insErr) throw insErr;
      res.json({ success: true, draftId });
    } catch (e) {
      logError('DB_003', safeErr(e));
      res.status(500).json({ error: "Ошибка сохранения черновика" });
    }
  });

  app.get("/api/drafts", async (req: any, res) => {
    try {
      const doctorId = req.user?.id;
      const { data: drafts } = await db.from('ehr_drafts').select('*').eq('doctor_id', doctorId).order('created_at', { ascending: false });
      res.json({ drafts: (drafts || []).map((d: any) => {
        let decryptedContent: any = null;
        try {
          decryptedContent = JSON.parse(decryptData(d.content));
        } catch (err: any) {
          // Don't leak ciphertext to the client — log and return placeholder
          logError('DB_007', `Draft ${d.id} decryption failed (${err?.name || 'Error'})`);
          decryptedContent = { _error: 'Не удалось расшифровать черновик' };
        }

        return {
          id: d.id,
          content: decryptedContent,
          createdAt: d.created_at
        };
      }) });
    } catch (e) {
      res.status(500).json({ error: 'Ошибка при загрузке протоколов' });
    }
  });

  // Update draft (e.g. retroactive EHR generation)
  app.patch("/api/drafts/:id", async (req: any, res) => {
    try {
      const doctorId = req.user?.id;
      const { id } = req.params;
      const { content } = req.body;

      // Verify ownership
      const { data: existing } = await db.from('ehr_drafts').select('id').eq('id', id).eq('doctor_id', doctorId).single();
      if (!existing) return res.status(404).json({ error: "Черновик не найден" });

      const encryptedPayload = encryptData(JSON.stringify(content));
      const { error } = await db.from('ehr_drafts').update({ content: encryptedPayload }).eq('id', id).eq('doctor_id', doctorId);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      logError('DB_003', safeErr(e));
      res.status(500).json({ error: "Ошибка обновления черновика" });
    }
  });

  app.delete("/api/drafts/:id", async (req: any, res) => {
    try {
      const doctorId = req.user?.id;
      const { id } = req.params;
      const { error } = await db.from('ehr_drafts').delete().eq('id', id).eq('doctor_id', doctorId);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      logError('DB_003', safeErr(e));
      res.status(500).json({ error: "Ошибка удаления черновика" });
    }
  });
}
