import express from "express";
import { getEffectiveLlmConfig } from "../ai/llmSettings";
import { toneServiceUrl, TWO_FA_ENABLED } from "../config";
import { db } from "../context";

export function registerSystemRoutes(app: express.Express) {
  app.get("/api/health", async (req, res) => {
    const llmPromise = getEffectiveLlmConfig();
    let toneOk = false;
    try {
      const r = await fetch(`${toneServiceUrl}/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) {
        const body: any = await r.json().catch(() => null);
        toneOk = body?.ok === true;
      }
    } catch { /* tone-service недоступен */ }
    let dbOk = false;
    try {
      const { error } = await db.from('doctors').select('id').limit(1)
        .abortSignal(AbortSignal.timeout(1500));
      dbOk = !error;
    } catch { /* база недоступна */ }
    res.json({
      status: "ok",
      llm: !!(await llmPromise),
      tone: toneOk,
      db: dbOk,
      uptimeSec: Math.round(process.uptime()),
    });
  });

  app.get("/api/auth/config", (req, res) => {
    res.json({ twoFactor: TWO_FA_ENABLED });
  });
}
