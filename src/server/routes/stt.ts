import express from "express";
import { Agent, fetch as undiciFetch } from "undici";
import { toneServiceUrl } from "../config";
import { logError, logInfo } from "../errors/logger";
import { safeErr } from "../logSafe";
import { rateLimit } from "../middleware/rateLimit";
import { requireSttAuth } from "../middleware/auth";
import { toneToSegments } from "../../utils/speakers";
import { loadSttEngine } from "../stt/sttSettings";
import { isSttEngine, parseEngineFallback } from "../../utils/sttEngine";

// Итоговая расшифровка GigaAM на длинной записи и медленном процессоре идёт дольше встроенных
// 5 минут undici: сроки задаём сами (на запрос ниже), а не по умолчанию.
const toneAgent = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
const TONE_FULL_TIMEOUT_MS = 7 * 60 * 1000;

// Отказы rateLimit/авторизации пишем сводно: не чаще одной строки в минуту на статус, с числом
// пропущенных, — иначе поток анонимных запросов засорил бы журнал. IP, токен, заголовки и данные
// пациента не логируем.
const REFUSAL_LOG_INTERVAL_MS = 60 * 1000;
const refusals = new Map<number, { lastLogAt: number; skipped: number }>();

function noteRefusal(status: number) {
  const now = Date.now();
  const r = refusals.get(status);
  if (!r || now - r.lastLogAt >= REFUSAL_LOG_INTERVAL_MS) {
    const skipped = r?.skipped ?? 0;
    refusals.set(status, { lastLogAt: now, skipped: 0 });
    logInfo(`[T-one Full] отказ: HTTP ${status}${skipped ? ` (ещё ${skipped} за последнее время)` : ''}`);
  } else {
    r.skipped++;
  }
}

// Стоит первым: видит ответ rateLimit и requireSttAuth. Отказом считается ответ >= 400 до того,
// как запрос прошёл авторизацию (req.user ставит requireSttAuth).
function trackRefusals(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.on('finish', () => {
    if (res.statusCode >= 400 && !(req as any).user) noteRefusal(res.statusCode);
  });
  next();
}

// Строки «запрос» и «клиент оборвал» — только после requireSttAuth, о запросах авторизованных врачей.
function logFullRequestLifecycle(req: express.Request, res: express.Response, next: express.NextFunction) {
  const contentLength = req.headers['content-length'];
  const size = contentLength !== undefined && Number.isFinite(Number(contentLength))
    ? `${(Number(contentLength) / 1024 / 1024).toFixed(1)}MB`
    : '?';
  logInfo(`[T-one Full] запрос: ${size}`);
  res.on('close', () => {
    if (!res.writableFinished) logInfo('[T-one Full] клиент оборвал запрос');
  });
  next();
}

export function registerSttRoutes(app: express.Express) {
  // ── /api/stt/full — полный сегмент через T-one ───────────────────────────
  // Используется режимом стенографа и уточняющим проходом после живого приёма.
  // Принимает целый аудиосегмент (до ~20 мин) и отдаёт его в forward_offline
  // (полный контекст — честный режим модели).
  //
  // Лимит на IP. Поднят с 20 до 60 req/15min: раньше сюда ходил только режим
  // стенографа, теперь ещё и уточняющий проход после КАЖДОГО живого приёма
  // (сегмент на каждые 20 мин записи), а за одним внешним IP (NAT, VPN)
  // могут сидеть несколько устройств — на 20 они упирались бы в лимит.
  app.post("/api/stt/full", trackRefusals, rateLimit(60, 15 * 60 * 1000), requireSttAuth, logFullRequestLifecycle, express.raw({ type: '*/*', limit: '30mb' }), async (req, res) => {
    const audioBuffer = req.body as Buffer;
    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty audio body' });
    }
    if (audioBuffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'Segment exceeds 25MB limit — split client-side' });
    }

    const mimeType = req.headers['content-type'] || 'audio/webm';
    const startedAt = Date.now();

    // Клиент ушёл — не держим расшифровку в очереди tone. Объявлен снаружи try: нужен обоим catch.
    const ac = new AbortController();
    try {
      // Только значение из перечня попадает в адрес tone.
      const engine = await loadSttEngine();
      const onClose = () => { if (!res.writableEnded) ac.abort(); };
      // express.raw уже дочитал тело, и 'close' у req прошёл: обрыв клиента виден только на res.
      res.on('close', onClose);
      const signal = AbortSignal.any([ac.signal, AbortSignal.timeout(TONE_FULL_TIMEOUT_MS)]);
      // Слушатель живёт до конца запроса: сигнал действует и пока читается тело ответа.
      const toneRes = await undiciFetch(`${toneServiceUrl}/transcribe?engine=${engine}`, {
        method: 'POST', headers: { 'Content-Type': mimeType }, body: audioBuffer,
        dispatcher: toneAgent, signal, redirect: 'error',
      });
      // Запись длиннее предела tone — повтор не поможет, врачу нужна понятная причина.
      if (toneRes.status === 413) {
        logInfo('[T-one Full] отказ tone: запись длиннее 25 минут');
        return res.status(413).json({ error: 'Запись длиннее 25 минут' });
      }
      if (!toneRes.ok) {
        logError('STT_010', `T-one full HTTP ${toneRes.status}`);
        return res.status(502).json({ error: 'T-one transcription failed' });
      }
      let toneData: any;
      try { toneData = await toneRes.json(); }
      catch (parseErr: any) {
        // Обрыв клиента — не ошибка сервера (таймаут AbortSignal.timeout ac.signal не трогает).
        if (ac.signal.aborted) return;
        logError('STT_008', `T-one: ответ не JSON (${parseErr?.name || 'Error'})`);
        return res.status(502).json({ error: 'T-one transcription failed' });
      }
      const toneText = (toneData.text || '').trim();
      const toneDurationSec = Number(toneData.duration_sec) || 0;
      // Фразы с метками голосов (если разметка включена и дала результат)
      const { segments, diarization } = toneToSegments(toneData);
      const usedEngine = isSttEngine(toneData.engine) ? toneData.engine : 'tone';
      const engineFallback = parseEngineFallback(toneData.engine_fallback);
      const speakers = new Set(segments.map(s => s.speaker).filter(Boolean)).size;
      logInfo(`[T-one Full] OK: ${toneText.length} chars in ${((Date.now() - startedAt) / 1000).toFixed(1)}s, ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB, segments=${segments.length} diar=${diarization} speakers=${speakers} engine=${usedEngine} engineFallback=${engineFallback ?? '-'}`);
      return res.json({ text: toneText, segments, durationSec: toneDurationSec, diarization, engine: usedEngine, engineFallback });
    } catch (err: any) {
      // Клиент оборвал запрос: отвечать и писать ошибку некому.
      if (ac.signal.aborted) return;
      logError('STT_008', safeErr(err));
      return res.status(500).json({ error: 'Internal STT error' });
    }
  });
}
