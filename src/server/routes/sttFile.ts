import crypto from "node:crypto";
import { Readable } from "node:stream";
import express from "express";
import { Agent, fetch as undiciFetch } from "undici";
import { toneServiceUrl } from "../config";
import { logError, logInfo } from "../errors/logger";
import { safeErr } from "../logSafe";
import { rateLimit } from "../middleware/rateLimit";
import { requireSttAuth } from "../middleware/auth";

// Загрузка аудиофайла приёма: браузер шлёт исходный файл частями по 16 МБ, приложение проксирует
// их в tone (внутренняя сеть), tone режет на части по 20 мин и отдаёт их в finish. Файл на диске
// приложения не хранится и в журнал не попадает (ни имя, ни содержимое).
const toneAgent = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
const TONE_PART_TIMEOUT_MS = 2 * 60 * 1000;
// ffmpeg доделывает хвост файла уже в finish.
const TONE_FINISH_TIMEOUT_MS = 10 * 60 * 1000;
const TONE_SHORT_TIMEOUT_MS = 30 * 1000;

// Срок записи загрузки — от последней активности (part/finish), а не от создания:
// файл 1,5–2 ГБ на обычном канале грузится дольше 15 минут.
const UPLOAD_IDLE_TTL_MS = 15 * 60 * 1000;
type Upload = {
  toneId: string;
  doctorId: string;
  lastSeenAt: number;
  nextSeq: number;     // какую часть ждём; повтор ровно предыдущей (nextSeq - 1) допустим
  inFlight: boolean;   // часть в пути: вторую одновременно не принимаем
  finished: boolean;   // finish начат: повтор finish/part — 404 gone
};
const uploads = new Map<string, Upload>();
// Врач, у которого start ещё идёт к tone: закрывает гонку двух одновременных start.
const startingDoctors = new Set<string>();
setInterval(() => {
  const now = Date.now();
  for (const [id, u] of uploads) {
    if (!u.inFlight && now - u.lastSeenAt > UPLOAD_IDLE_TTL_MS) uploads.delete(id);
  }
}, 60 * 1000).unref();

const GONE_BODY = { error: 'Загрузка прервалась — выберите файл заново', code: 'gone' };

// Отказы до авторизации — сводно, как в stt.ts: не чаще строки в минуту на статус.
const REFUSAL_LOG_INTERVAL_MS = 60 * 1000;
const refusals = new Map<number, { lastLogAt: number; skipped: number }>();

function noteRefusal(status: number) {
  const now = Date.now();
  const r = refusals.get(status);
  if (!r || now - r.lastLogAt >= REFUSAL_LOG_INTERVAL_MS) {
    const skipped = r?.skipped ?? 0;
    refusals.set(status, { lastLogAt: now, skipped: 0 });
    logInfo(`[STT File] отказ: HTTP ${status}${skipped ? ` (ещё ${skipped} за последнее время)` : ''}`);
  } else {
    r.skipped++;
  }
}

function trackRefusals(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.on('finish', () => {
    if (res.statusCode >= 400 && !(req as any).user) noteRefusal(res.statusCode);
  });
  next();
}

// Чужой, неизвестный, просроченный и завершённый uploadId неразличимы: все — 404 gone.
// Проверка идёт до чтения тела.
function findUpload(req: express.Request, res: express.Response) {
  const id = String(req.params.uploadId);
  const u = uploads.get(id);
  if (u && !u.inFlight && Date.now() - u.lastSeenAt > UPLOAD_IDLE_TTL_MS) uploads.delete(id);
  if (!u || !uploads.has(id) || u.finished || u.doctorId !== (req as any).user?.id) {
    res.status(404).json(GONE_BODY);
    return null;
  }
  return u;
}

// Код ошибки tone → ответ врачу по-русски.
function toneError(status: number, code: string | undefined, hint: string | undefined) {
  if (status === 503 || code === 'busy') {
    return { status: 503, error: 'Сервер занят обработкой другого файла, попробуйте через минуту', code: 'busy' };
  }
  if (code === 'not_found' || status === 404) return { status: 404, ...GONE_BODY };
  if (code === 'part_in_flight') {
    return { status: 409, error: 'Предыдущая часть файла ещё передаётся, повторите через несколько секунд', code: 'part_in_flight' };
  }
  if (code === 'gap') return { status: 409, error: 'Часть файла потерялась при загрузке, начните заново', code: 'gap' };
  if (code === 'too_big') {
    const error = hint === 'm4a' || hint === 'mp4'
      ? 'Файл m4a больше 300 МБ: сожмите его или разделите на части'
      : 'Файл больше 2 ГБ';
    // format уходит клиенту: по нему он различает «m4a больше 300 МБ» и «больше 2 ГБ».
    return { status: 413, error, code: 'too_big', format: hint };
  }
  if (code === 'unsupported') {
    return { status: 415, error: 'Формат не распознан. Подойдут mp3, m4a, wav, ogg, webm, flac', code: 'unsupported' };
  }
  if (code === 'too_long') {
    return { status: 413, error: 'Запись длиннее 2 часов: разделите её на части', code: 'too_long' };
  }
  return { status: 502, error: 'Не удалось обработать файл, попробуйте ещё раз', code: 'upstream' };
}

async function readToneError(toneRes: Awaited<ReturnType<typeof undiciFetch>>) {
  try {
    const j: any = await toneRes.json();
    return {
      code: typeof j?.code === 'string' ? j.code : undefined,
      hint: typeof j?.format === 'string' ? j.format : typeof j?.kind === 'string' ? j.kind : undefined,
    };
  } catch { return { code: undefined, hint: undefined }; }
}

// Снять задачу в tone, которую приложение так и не записало: без этого она держит очередь до простоя.
// Fire-and-forget: ошибка не важна, tone сам чистит задачи по сроку.
function dropToneTask(toneId: string) {
  undiciFetch(`${toneServiceUrl}/split/${encodeURIComponent(toneId)}`, {
    method: 'DELETE', dispatcher: toneAgent, signal: AbortSignal.timeout(TONE_SHORT_TIMEOUT_MS), redirect: 'error',
  }).then(r => r.arrayBuffer()).catch(() => { /* не критично */ });
}

// Запрос к tone, который рвётся вместе с клиентом.
function withClientAbort(res: express.Response, timeoutMs: number) {
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  return { ac, signal: AbortSignal.any([ac.signal, AbortSignal.timeout(timeoutMs)]) };
}

export function registerSttFileRoutes(app: express.Express) {
  // ── start ────────────────────────────────────────────────────────────────
  app.post("/api/stt/file/start", trackRefusals, rateLimit(10, 15 * 60 * 1000), requireSttAuth, async (req, res) => {
    const doctorId: string = (req as any).user.id;
    // Не больше одной активной загрузки на врача: иначе один врач займёт обе очереди нарезки.
    const now = Date.now();
    const hasActive = startingDoctors.has(doctorId) ||
      [...uploads.values()].some(u => u.doctorId === doctorId && !u.finished &&
        (u.inFlight || now - u.lastSeenAt <= UPLOAD_IDLE_TTL_MS));
    if (hasActive) {
      return res.status(409).json({
        error: 'Уже идёт загрузка другого файла — дождитесь её или отмените', code: 'upload_active',
      });
    }
    startingDoctors.add(doctorId);
    const { ac, signal } = withClientAbort(res, TONE_SHORT_TIMEOUT_MS);
    let toneId: string | undefined;   // id задачи, созданной в tone
    let saved = false;                // запись об загрузке сохранена: дальше задачей владеет она
    try {
      const toneRes = await undiciFetch(`${toneServiceUrl}/split`, {
        method: 'POST', dispatcher: toneAgent, signal, redirect: 'error',
      });
      if (!toneRes.ok) {
        const { code, hint } = await readToneError(toneRes);
        const e = toneError(toneRes.status, code, hint);
        logInfo(`[STT File] start: tone HTTP ${toneRes.status} code=${code ?? '-'}`);
        return res.status(e.status).json({ error: e.error, code: e.code, format: e.format });
      }
      const data: any = await toneRes.json();
      if (typeof data?.id === 'string' && data.id) toneId = data.id;
      if (!toneId) {
        logError('STT_010', 'STT File: tone не вернул id');
        return res.status(502).json({ error: 'Не удалось начать загрузку', code: 'upstream' });
      }
      const uploadId = crypto.randomBytes(16).toString('hex');
      uploads.set(uploadId, {
        toneId, doctorId, lastSeenAt: Date.now(), nextSeq: 0, inFlight: false, finished: false,
      });
      saved = true;
      return res.json({ uploadId });
    } catch (err: any) {
      if (ac.signal.aborted) return;
      logError('STT_010', `STT File start: ${safeErr(err)}`);
      return res.status(502).json({ error: 'Не удалось начать загрузку', code: 'upstream' });
    } finally {
      // tone создал задачу, а записи у нас нет (обрыв клиента, исключение): не оставляем сироту.
      if (toneId && !saved) dropToneTask(toneId);
      startingDoctors.delete(doctorId);
    }
  });

  // ── part ─────────────────────────────────────────────────────────────────
  // Владелец, порядок частей и занятость проверяются до express.raw: лишний запрос не заставит
  // читать 16 МБ в память. Одна часть в пути на загрузку.
  app.post("/api/stt/file/:uploadId/part", trackRefusals, rateLimit(400, 15 * 60 * 1000), requireSttAuth,
    (req, res, next) => {
      const u = findUpload(req, res);
      if (!u) return;
      const seq = Number(req.query.seq);
      if (!Number.isInteger(seq) || seq < 0) {
        return res.status(400).json({ error: 'Некорректная часть файла', code: 'bad_part' });
      }
      // Ожидаемая часть или ровно предыдущая (повтор после обрыва); остальное — пропуск.
      if (seq !== u.nextSeq && seq !== u.nextSeq - 1) {
        return res.status(409).json({ error: toneError(409, 'gap', undefined).error, code: 'gap' });
      }
      if (u.inFlight) {
        return res.status(409).json({ error: toneError(409, 'part_in_flight', undefined).error, code: 'part_in_flight' });
      }
      u.inFlight = true;
      u.lastSeenAt = Date.now();
      res.on('close', () => { u.inFlight = false; u.lastSeenAt = Date.now(); });
      next();
    },
    express.raw({ type: '*/*', limit: '17mb' }),
    async (req, res) => {
      const u = findUpload(req, res);
      if (!u) return;
      const body = req.body as Buffer;
      const seq = Number(req.query.seq);
      if (!Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({ error: 'Некорректная часть файла', code: 'bad_part' });
      }
      const { ac, signal } = withClientAbort(res, TONE_PART_TIMEOUT_MS);
      try {
        const toneRes = await undiciFetch(`${toneServiceUrl}/split/${encodeURIComponent(u.toneId)}/part?seq=${seq}`, {
          method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body,
          dispatcher: toneAgent, signal, redirect: 'error',
        });
        if (!toneRes.ok) {
          const { code, hint } = await readToneError(toneRes);
          const e = toneError(toneRes.status, code, hint);
          logInfo(`[STT File] part seq=${seq} ${(body.length / 1024 / 1024).toFixed(1)}MB: tone HTTP ${toneRes.status} code=${code ?? '-'}`);
          // Кроме gap/part_in_flight, tone стирает задачу при любой ошибке: запись больше не нужна.
          if (code !== 'gap' && code !== 'part_in_flight') uploads.delete(String(req.params.uploadId));
          return res.status(e.status).json({ error: e.error, code: e.code, format: e.format });
        }
        await toneRes.arrayBuffer();
        if (seq === u.nextSeq) u.nextSeq++;
        logInfo(`[STT File] part seq=${seq} ${(body.length / 1024 / 1024).toFixed(1)}MB: OK`);
        return res.json({ ok: true });
      } catch (err: any) {
        if (ac.signal.aborted) return;
        logError('STT_010', `STT File part: ${safeErr(err)}`);
        return res.status(502).json({ error: 'Не удалось передать часть файла', code: 'upstream' });
      }
    });

  // ── finish ───────────────────────────────────────────────────────────────
  // Ответ (до ~35 МБ base64) не копится в памяти приложения, а пересылается потоком.
  app.post("/api/stt/file/:uploadId/finish", trackRefusals, rateLimit(10, 15 * 60 * 1000), requireSttAuth, async (req, res) => {
    const u = findUpload(req, res);
    if (!u) return;
    const uploadId = String(req.params.uploadId);
    if (u.inFlight) {
      return res.status(409).json({ error: toneError(409, 'part_in_flight', undefined).error, code: 'part_in_flight' });
    }
    // Повторить finish нельзя: tone стирает задачу. Повтор и part после этого — 404 gone.
    u.finished = true;
    u.lastSeenAt = Date.now();
    const startedAt = Date.now();
    const { ac, signal } = withClientAbort(res, TONE_FINISH_TIMEOUT_MS);
    try {
      const toneRes = await undiciFetch(`${toneServiceUrl}/split/${encodeURIComponent(u.toneId)}/finish`, {
        method: 'POST', dispatcher: toneAgent, signal, redirect: 'error',
      });
      if (!toneRes.ok) {
        const { code, hint } = await readToneError(toneRes);
        const e = toneError(toneRes.status, code, hint);
        logInfo(`[STT File] finish: tone HTTP ${toneRes.status} code=${code ?? '-'}`);
        uploads.delete(uploadId);
        return res.status(e.status).json({ error: e.error, code: e.code, format: e.format });
      }
      if (!toneRes.body) {
        uploads.delete(uploadId);
        logError('STT_010', 'STT File: пустой ответ finish');
        return res.status(502).json({ error: 'Не удалось обработать файл, попробуйте ещё раз', code: 'upstream' });
      }
      uploads.delete(uploadId);
      res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
      const stream = Readable.fromWeb(toneRes.body as any);
      stream.on('error', (err) => {
        if (!ac.signal.aborted) logError('STT_010', `STT File finish: поток оборван (${safeErr(err)})`);
        res.destroy();
      });
      res.on('finish', () => {
        logInfo(`[STT File] finish: OK за ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
      });
      stream.pipe(res);
    } catch (err: any) {
      uploads.delete(uploadId);
      if (ac.signal.aborted) return;
      logError('STT_010', `STT File finish: ${safeErr(err)}`);
      if (res.headersSent) return res.destroy();
      return res.status(502).json({ error: 'Не удалось обработать файл, попробуйте ещё раз', code: 'upstream' });
    }
  });

  // ── отмена ───────────────────────────────────────────────────────────────
  app.delete("/api/stt/file/:uploadId", trackRefusals, rateLimit(60, 15 * 60 * 1000), requireSttAuth, async (req, res) => {
    const u = findUpload(req, res);
    if (!u) return;
    uploads.delete(String(req.params.uploadId));
    try {
      await undiciFetch(`${toneServiceUrl}/split/${encodeURIComponent(u.toneId)}`, {
        method: 'DELETE', dispatcher: toneAgent, signal: AbortSignal.timeout(TONE_SHORT_TIMEOUT_MS), redirect: 'error',
      }).then(r => r.arrayBuffer());
    } catch (err: any) {
      // tone сам чистит задачу по сроку: врачу ошибка не нужна.
      logInfo(`[STT File] cancel: tone недоступен (${err?.name || 'Error'})`);
    }
    return res.json({ ok: true });
  });
}
