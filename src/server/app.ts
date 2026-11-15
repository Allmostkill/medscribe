import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createDeidentifier, deidContext } from "./deidentify";
import { securityHeaders, rejectCrossSite } from "./middleware/security";
import { requireFullAuth } from "./middleware/auth";
import { logError } from "./errors/logger";
import { registerSystemRoutes } from "./routes/system";
import { registerSetupRoutes } from "./routes/setup";
import { registerAuthRoutes } from "./routes/auth";
import { registerProfileRoutes } from "./routes/profile";
import { registerTwoFactorRoutes } from "./routes/twoFactor";
import { registerDraftsRoutes } from "./routes/drafts";
import { registerGuidelinesRoutes } from "./routes/guidelines";
import { registerWorkspaceRoutes } from "./routes/workspace";
import { registerAiRoutes } from "./routes/ai";
import { registerSttRoutes } from "./routes/stt";

export async function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use('/api', rejectCrossSite);

  // 2MB is enough for JSON-запросов (стенограмма, протокол).
  app.use(express.json({ limit: '2mb' }));
  // Один деидентификатор на запрос: wrapUserContent скрывает через него,
  // llmGenerate восстанавливает. Обработчику ничего делать не нужно — и
  // забыть он тоже ничего не может.
  app.use((req, res, next) => deidContext.run(createDeidentifier(), () => next()));

  registerSystemRoutes(app);
  registerSetupRoutes(app);
  registerAuthRoutes(app);
  registerProfileRoutes(app);
  registerTwoFactorRoutes(app);

  // Protect internal endpoints — full (post-2FA) auth required
  app.use("/api/drafts", requireFullAuth);
  app.use("/api/ai", requireFullAuth);
  app.use("/api/workspace-layout", requireFullAuth);
  app.use("/api/guidelines", requireFullAuth);

  registerDraftsRoutes(app);
  registerGuidelinesRoutes(app);
  registerWorkspaceRoutes(app);
  registerAiRoutes(app);
  registerSttRoutes(app);

  // 404 for unknown /api/* routes — must come BEFORE the SPA fallback, otherwise
  // an unknown API path returns index.html and the client sees a JSON parse error.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
  });

  // --- VITE HYBRID MODE INTEGRATION ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ── Global error handler ───────────────────────────────────────────────────
  // Catches anything that escapes a route — including thrown errors in async
  // handlers (Express 5+ awaits, but we're on 4.x so explicit handler matters).
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // JSON больше лимита express.json — ошибка клиента, а не сервера.
    if (err?.type === 'entity.too.large') {
      if (!res.headersSent) res.status(413).json({ error: 'Слишком большой запрос' });
      return;
    }
    logError('SERVER_001', `Unhandled in ${req.method} ${req.path}: ${err?.type || err?.name || 'Error'}`);
    // Don't leak stack traces / internal details to the client
    if (!res.headersSent) {
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

  return app;
}
