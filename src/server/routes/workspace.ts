import express from "express";
import { db } from "../context";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";
import { isValidWorkspaceLayout } from "../workspaceLayout";

export function registerWorkspaceRoutes(app: express.Express) {
  app.get("/api/workspace-layout", async (req: any, res) => {
    try {
      const doctorId = req.user?.id;
      const { data } = await db
        .from('doctor_workspace_layout').select('layout').eq('doctor_id', doctorId).maybeSingle();
      res.json({ layout: data?.layout ?? null });
    } catch (e) {
      logError('DB_011', safeErr(e));
      res.status(500).json({ error: "Ошибка загрузки раскладки" });
    }
  });

  app.put("/api/workspace-layout", async (req: any, res) => {
    try {
      const doctorId = req.user?.id;
      const { layout } = req.body;
      if (!isValidWorkspaceLayout(layout)) {
        return res.status(400).json({ error: "Некорректная раскладка" });
      }
      const { error } = await db
        .from('doctor_workspace_layout')
        .upsert({ doctor_id: doctorId, layout, updated_at: new Date().toISOString() });
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      logError('DB_011', safeErr(e));
      res.status(500).json({ error: "Ошибка сохранения раскладки" });
    }
  });
}
