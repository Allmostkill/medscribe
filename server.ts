import "./src/server/config";
import http from "http";
import { resolveLlmConfig } from "./src/server/llm";
import { PORT, HOST } from "./src/server/config";
import { logError } from "./src/server/errors/logger";
import { announceSetupIfNeeded } from "./src/server/setup";
import { createApp } from "./src/server/app";
import { attachToneProxy } from "./src/server/ws/toneProxy";

async function startServer() {
  const app = await createApp();

  const httpServer = http.createServer(app);
  attachToneProxy(httpServer, PORT);

  httpServer.listen(PORT, HOST, () => {
    console.log(`[MedScribe] http://localhost:${PORT}`);
    const llmCfg = resolveLlmConfig();
    if (llmCfg) {
      let host = llmCfg.baseUrl;
      try { host = new URL(llmCfg.baseUrl).host; } catch {}
      console.log(`[MedScribe] LLM из .env: ${host}, модель ${llmCfg.model}`);
    } else {
      console.log('[MedScribe] Языковая модель подключается в личном кабинете: Профиль → Настройки ИИ');
    }
    announceSetupIfNeeded();
  });
}

// ── Process-level safety nets ─────────────────────────────────────────────────
// On transient errors (e.g. a third-party API rejecting a single request) we
// stay alive rather than crash the whole container.
// But we log loudly so the issue isn't silent.
process.on('unhandledRejection', (reason: any) => {
  // Текст ошибки не пишем: SyntaxError от JSON.parse цитирует разбираемые данные.
  logError('SERVER_001', `unhandledRejection: ${reason?.name || typeof reason}`);
});

process.on('uncaughtException', (err: Error) => {
  logError('SERVER_001', `uncaughtException: ${err.name}`, { stack: String(err.stack || '').split('\n').filter(l => l.trim().startsWith('at ')).join('\n') });
  // After an uncaught exception state may be corrupted — let the orchestrator
  // restart us. Docker-compose with restart: unless-stopped handles this.
  setTimeout(() => process.exit(1), 1000);
});

startServer().catch((err) => {
  console.error('Fatal: server failed to start', err);
  process.exit(1);
});
