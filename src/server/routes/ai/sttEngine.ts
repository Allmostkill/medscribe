import express from "express";
import { toneServiceUrl } from "../../config";
import { rateLimit } from "../../middleware/rateLimit";
import { logInfo, logWarn, logError } from "../../errors/logger";
import { safeErr } from "../../logSafe";
import { readSttEngine, saveSttEngine } from "../../stt/sttSettings";
import {
  isSttEngine, effectiveEngine, parseToneEngines, gigaamErrorMessage, type SttEngine,
} from "../../../utils/sttEngine";

const TONE_TIMEOUT_MS = 3000;

// Только фиксированные пути tone: ничего из запроса в адрес не попадает.
async function toneCall(method: 'GET' | 'POST', path: '/engines' | '/engines/gigaam/prepare' | '/engines/gigaam/release') {
  try {
    const r = await fetch(`${toneServiceUrl}${path}`, {
      method, signal: AbortSignal.timeout(TONE_TIMEOUT_MS), redirect: 'error',
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    logWarn('STT_010', `tone ${path}: ${safeErr(e)}`);
    return null;
  }
}

// Состояние для кабинета. Ответ tone проходит через parseToneEngines, сырой JSON клиенту не уходит.
async function buildStatus() {
  const [stored, toneJson] = await Promise.all([readSttEngine(), toneCall('GET', '/engines')]);
  const toneReachable = toneJson !== null;
  const eng = parseToneEngines(toneJson);
  const g = eng.gigaam;
  return {
    selected: stored.engine,
    effective: effectiveEngine(stored.engine, g.state),
    toneReachable,
    ...(stored.ok ? {} : { settingsUnavailable: true as const }),
    gigaam: {
      state: g.state, downloadedBytes: g.downloadedBytes, totalBytes: g.totalBytes,
      error: g.errorCode ? gigaamErrorMessage(g.errorCode) : null, errorCode: g.errorCode,
    },
  };
}

export function registerSttEngineRoutes(app: express.Express) {
  app.get("/api/ai/stt-engine", async (req, res) => {
    res.json(await buildStatus());
  });

  // Выбор модели. GigaAM: сохранить и попросить tone подготовить (скачать/загрузить);
  // T-one: сохранить и освободить память от GigaAM.
  app.put("/api/ai/stt-engine", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    const engine: unknown = req.body?.engine;
    if (!isSttEngine(engine)) return res.status(400).json({ error: 'Неверный вариант распознавания речи' });
    try {
      await saveSttEngine(engine as SttEngine);
    } catch (e) {
      logError('DB_013', safeErr(e));
      return res.status(500).json({ error: "Не удалось сохранить выбор распознавания речи" });
    }
    await toneCall('POST', engine === 'gigaam' ? '/engines/gigaam/prepare' : '/engines/gigaam/release');
    logInfo(`STT: в кабинете выбрано распознавание ${engine}`);
    res.json({ ok: true, status: await buildStatus() });
  });

  // «Повторить» после сбоя загрузки.
  app.post("/api/ai/stt-engine/download", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    await toneCall('POST', '/engines/gigaam/prepare');
    res.json({ ok: true, status: await buildStatus() });
  });
}
