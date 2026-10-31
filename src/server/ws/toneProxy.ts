import http from "http";
import ws, { WebSocketServer } from "ws";
import { toneServiceUrl } from "../config";
import { logError } from "../errors/logger";
import { safeErr } from "../logSafe";
import { verifyJwt, sessionRejection } from "../auth/tokens";

export function attachToneProxy(httpServer: http.Server, port: number) {
  // WebSocket server for T-one streaming transcription
  // Подпротокол 'bearer' — способ передать токен вебсокета заголовком: браузер
  // не даёт задавать произвольные заголовки при апгрейде, но второй элемент
  // Sec-WebSocket-Protocol доезжает. Обязательно отвечаем выбранным протоколом,
  // иначе браузер рвёт рукопожатие.
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols: Set<string>) => (protocols.has('bearer') ? 'bearer' : false),
    // Кадр PCM от клиента — единицы-десятки КБ; без лимита ws принимает до 100 МБ.
    maxPayload: 512 * 1024,
  });
  // Сколько байт держим, пока нет соединения с tone-service (≈ 1 мин PCM 8 кГц int16).
  const MAX_PENDING_BYTES = 1024 * 1024;

  // Токен принимаем только через подпротокол (`bearer, <jwt>`): в query он попадал бы в логи прокси
  // (access_log пишет полный URI), в историю браузера и в Referer.
  function tokenFromUpgrade(req: any): string | null {
    const proto = String(req.headers['sec-websocket-protocol'] || '');
    const parts = proto.split(',').map((x: string) => x.trim()).filter(Boolean);
    if (parts[0] === 'bearer' && parts[1]) return parts[1];
    return null;
  }

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url!, `http://localhost:${port}`);

    // ── /ws/stt/tone — real-time стенограмма через T-one (стриминг) ───────────
    // ИЗОЛИРОВАННЫЙ путь: касается только провайдера T-one. Клиент шлёт сырой PCM
    // int16 8 кГц, мы проксируем его в tone-service /stream и гоним фразы обратно.
    if (url.pathname === '/ws/stt/tone') {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        const token = tokenFromUpgrade(req);
        if (!token) { clientWs.close(1008, 'Missing token'); return; }
        let decoded: any;
        try {
          decoded = verifyJwt(token);
          if (decoded.isPartial) { clientWs.close(1008, 'Partial auth'); return; }
        } catch { clientWs.close(1008, 'Invalid token'); return; }

        // Проверка сессии в БД асинхронна, а клиент может начать слать звук сразу:
        // обработчики вешаем сразу, до готовности апстрима всё копится в pending.
        let upstream: ws | null = null;
        let upstreamOpen = false;
        let closed = false;
        const pending: any[] = [];
        let pendingBytes = 0;

        clientWs.on('message', (data: any, isBinary: boolean) => {
          const payload = isBinary ? data : data.toString();
          if (upstream && upstreamOpen) { upstream.send(payload); return; }
          pendingBytes += typeof payload === 'string' ? Buffer.byteLength(payload) : (payload.length ?? 0);
          if (pendingBytes > MAX_PENDING_BYTES) { clientWs.close(1009, 'Too much data before upstream ready'); return; }
          pending.push(payload);
        });
        // Раз в минуту перепроверяем exp токена и сессию: соединение живёт
        // дольше кэша, и врач с завершённой сессией иначе стримил бы до конца сессии.
        // Временную ошибку БД пропускаем — следующий тик проверит снова.
        const recheckTimer = setInterval(async () => {
          if (typeof decoded.exp === 'number' && decoded.exp * 1000 <= Date.now()) {
            clientWs.close(1008, 'Token expired');
            return;
          }
          try {
            if (await sessionRejection(decoded)) clientWs.close(1008, 'Session not valid');
          } catch { /* повторим на следующем тике */ }
        }, 60_000);
        clientWs.on('close', () => {
          clearInterval(recheckTimer);
          closed = true;
          pending.length = 0;
          if (upstream && (upstream.readyState === ws.OPEN || upstream.readyState === ws.CONNECTING)) {
            try { upstream.close(); } catch {}
          }
        });
        clientWs.on('error', () => { clearInterval(recheckTimer); try { upstream?.close(); } catch {} });

        (async () => {
          let rejection: string | null;
          try { rejection = await sessionRejection(decoded); }
          catch { clientWs.close(1011, 'Auth check failed'); return; }
          if (rejection) { clientWs.close(1008, 'Session not valid'); return; }
          if (closed) return;

          const toneWsUrl = toneServiceUrl.replace(/^http/, 'ws') + '/stream';
          const up = new ws(toneWsUrl);
          upstream = up;

          up.on('open', () => {
            upstreamOpen = true;
            for (const m of pending) up.send(m);
            pending.length = 0;
          });
          up.on('message', (data: any) => {
            if (clientWs.readyState === clientWs.OPEN) clientWs.send(data.toString());
          });
          up.on('close', () => { try { clientWs.close(); } catch {} });
          up.on('error', (e: any) => {
            logError('STT_011', `tone stream ws: ${safeErr(e)}`);
            try { clientWs.close(); } catch {}
          });
        })();
      });
      return;
    }

    // Любой другой путь апгрейда — закрыть соединение.
    socket.destroy();
  });
}
