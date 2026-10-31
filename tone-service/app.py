"""
T-one STT микросервис для MedScribe.

Поднимает потоковую ASR-модель T-one (Т-Банк, Apache-2.0, RU) как HTTP-сервис
во внутренней сети docker compose (порт 5001, наружу не публикуется). Node-бэкенд
(`/api/stt/full`, `/ws/stt/tone`) форвардит сюда аудио.

Почему отдельный процесс, а не внутри Node:
  T-one живёт в Python (инференс на ONNX Runtime, CPU). Держим его изолированно,
  общаемся по HTTP. Модель грузится ОДИН раз при старте (см. startup), дальше
  каждый запрос — только инференс.

Аудио: браузер шлёт webm/opus 5-сек чанками → ffmpeg декодит в wav 16k mono →
  read_audio → pipeline.forward_offline. forward_offline сам нарезает на фразы.

Приватность: текст транскрипта НЕ логируем (только длину), как и в Node.
"""

import logging
import os
import subprocess
import tempfile
import threading
import time

import numpy as np
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

import gigaam

logging.basicConfig(level=logging.INFO, format="%(asctime)s [tone] %(message)s")
log = logging.getLogger("tone-service")

FFMPEG_TIMEOUT_SEC = 120
# Разметка по голосу: модели вшиты в образ; короче 3 с голосов не различить (diarize.MIN_SEC).
DIAR_MODEL_DIR = "/opt/diar"
DIARIZATION_MODE = os.environ.get("DIARIZATION", "auto").strip().lower()


def _env_max_sec() -> float:
    import diarize

    try:
        v = float(os.environ.get("DIAR_MAX_SEC", ""))
        return v if v > 0 else diarize.DEFAULT_MAX_SEC
    except ValueError:
        return diarize.DEFAULT_MAX_SEC


# Дольше этого разметку пропускаем (статус "skipped"), текст отдаётся как обычно.
DIAR_MAX_SEC = _env_max_sec()

app = FastAPI(title="MedScribe T-one STT")
pipeline = None  # лениво загружаемый StreamingCTCPipeline
diarizer = None  # sherpa-onnx; None — выключена или не загрузилась
gigaam_engine = None  # GigaAM v3 (итоговая расшифровка по выбору врача); веса качаются по команде
# Замок ограничивает число ТЯЖЁЛЫХ запросов /transcribe одним за раз (память, CPU).
# Корректности ради он не нужен: pipeline не хранит состояние в экземпляре (state
# передаётся снаружи, ORT InferenceSession.run потокобезопасен, декодер без состояния),
# поэтому /stream работает параллельно без замка и не простаивает за длинной записью.
_infer_lock = threading.Lock()


@app.on_event("startup")
def _load_model() -> None:
    global pipeline, diarizer, gigaam_engine
    from tone import StreamingCTCPipeline

    # при старте ничего не качаем: только смотрим, лежат ли веса в томе
    gigaam_engine = gigaam.GigaamEngine(
        os.environ.get("HF_HOME", "/models"),
        os.environ.get("HF_ENDPOINT", "https://huggingface.co"),
    )

    log.info("Загрузка T-one pipeline из HuggingFace (первый раз — качает веса)...")
    pipeline = StreamingCTCPipeline.from_hugging_face()
    log.info("T-one готов.")

    if DIARIZATION_MODE == "off":
        log.info("Разметка по голосу выключена (DIARIZATION=off).")
        return
    # Сбой разметки не должен ронять распознавание: без неё сервис работает как раньше.
    try:
        import diarize

        diarizer = diarize.load(DIAR_MODEL_DIR, _diar_threshold())
        log.info("Разметка по голосу готова.")
    except Exception as e:  # noqa: BLE001
        diarizer = None
        log.warning("Разметка по голосу не загружена: %s", type(e).__name__)


def _diar_threshold() -> float:
    import diarize

    try:
        return float(os.environ.get("DIARIZATION_THRESHOLD", ""))
    except ValueError:
        return diarize.DEFAULT_THRESHOLD


@app.get("/health")
def health() -> dict:
    return {
        "ok": pipeline is not None,
        "diarization": diarizer is not None,
        "gigaam": gigaam_engine.status()["state"] if gigaam_engine else "absent",
    }


@app.get("/engines")
def engines() -> dict:
    return {"tone": {"ready": pipeline is not None}, "gigaam": gigaam_engine.status()}


@app.post("/engines/gigaam/prepare")
def engines_gigaam_prepare() -> JSONResponse:
    return JSONResponse({"state": gigaam_engine.prepare()}, status_code=202)


@app.post("/engines/gigaam/release")
async def engines_gigaam_release() -> dict:
    def locked() -> str:
        with _infer_lock:  # не выгружаем модель посреди расшифровки
            return gigaam_engine.release()

    return {"state": await run_in_threadpool(locked)}


def _empty(diar: str = "skipped", engine: str = "tone", fallback=None) -> dict:
    return {"text": "", "duration_sec": 0, "phrases": [], "diarization": diar,
            "engine": engine, "engine_fallback": fallback}


def _diarize(phrases: list, samples16, duration_sec: float, off: str, wav=None) -> tuple:
    """Разметка фраз по голосу (меняет phrases: speaker). Возвращает (статус, голосов, секунд).
    samples16 нет — читаем wav сами, и только если разметка действительно нужна."""
    import diarize

    diar = off
    speakers = 0
    took = 0.0
    if diarizer is not None and DIARIZATION_MODE != "off":
        if (samples16 is not None or wav) and diarize.should_diarize(duration_sec, len(phrases), DIAR_MAX_SEC):
            t0 = time.monotonic()
            try:
                if samples16 is None:
                    import soundfile as sf

                    samples16, _ = sf.read(wav, dtype="float32")  # тот же wav, 16 кГц моно
                segs = diarize.run(diarizer, samples16)
                raw_labels = diarize.assign_speakers(
                    [(p["start"], p["end"]) for p in phrases], segs
                )
                labels, diar = diarize.finalize_labels(raw_labels)
                speakers = len({x for x in labels if x is not None})
                for p, lab in zip(phrases, labels):
                    p["speaker"] = lab
            except Exception as e:  # noqa: BLE001
                log.warning("diarization error: %s", type(e).__name__)
                diar = "failed"
            took = time.monotonic() - t0
        else:
            diar = "skipped"
    for p in phrases:
        p.setdefault("speaker", None)
    return diar, speakers, took


def _transcribe_file(raw: bytes, engine: str = "tone", fallback=None) -> dict:
    """Тяжёлая синхронная часть: ffmpeg → T-one или GigaAM → (разметка по голосу).
    Вызывается в потоке и под замком (по одному тяжёлому запросу за раз)."""
    from tone import read_audio

    off = "off" if (DIARIZATION_MODE == "off" or diarizer is None) else "skipped"

    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "in")
        wav = os.path.join(d, "out.wav")
        with open(src, "wb") as f:
            f.write(raw)

        # Декодим что угодно (webm/opus/ogg/wav/mp4) → wav 16 кГц моно. Белый список
        # протоколов не даёт входному файлу подтянуть http/tcp и т.п. (SSRF);
        # форматы не ограничиваем: Safari пишет mp4, Chrome/Firefox — webm/ogg.
        try:
            proc = subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error",
                 "-protocol_whitelist", "file,pipe",
                 "-format_whitelist", "mov,mp4,m4a,3gp,matroska,webm,ogg,wav,mp3",
                 "-i", src, "-ac", "1", "-ar", "16000", "-f", "wav", wav],
                capture_output=True,
                timeout=FFMPEG_TIMEOUT_SEC,
            )
        except subprocess.TimeoutExpired:
            log.warning("ffmpeg timeout")
            return _empty(off, engine, fallback)
        if proc.returncode != 0:
            log.warning("ffmpeg fail: %s", proc.stderr.decode(errors="ignore")[:200])
            return _empty(off, engine, fallback)

        # wav 16 кГц читаем в память только для GigaAM; для разметки — лишь если она нужна
        samples16 = None
        if engine == "gigaam":
            import soundfile as sf

            samples16, _ = sf.read(wav, dtype="float32")

        phrases = None
        if engine == "gigaam":
            try:
                phrases = gigaam_engine.transcribe(samples16)
                duration_sec = len(samples16) / 16000.0
            except Exception as e:  # noqa: BLE001
                log.warning("gigaam error: %s", type(e).__name__)
                engine, fallback = "tone", "error"
        if phrases is None:
            audio = read_audio(wav)
            # read_audio ресемплит ВСЕГДА в 8 кГц (см. tone/audio.py), даже если
            # мы декодировали ffmpeg-ом в 16к выше — делить нужно на 8000, иначе
            # длительность занижается вдвое.
            duration_sec = len(audio) / 8000.0
            tone_phrases = pipeline.forward_offline(audio)
            phrases = [
                {"start": float(p.start_time), "end": float(p.end_time), "text": p.text}
                for p in tone_phrases
            ]
        text = " ".join(p["text"] for p in phrases).strip()

        diar, speakers, diar_took = _diarize(phrases, samples16, duration_sec, off, wav)

    # Содержимое транскрипта не логируем, только длину и счётчики.
    if text:
        log.info("OK: %d chars, %.1fs, engine=%s fallback=%s diar=%s speakers=%d diar_took=%.1fs",
                 len(text), duration_sec, engine, fallback, diar, speakers, diar_took)
    return {"text": text, "duration_sec": duration_sec, "phrases": phrases, "diarization": diar,
            "engine": engine, "engine_fallback": fallback}


@app.post("/transcribe")
async def transcribe(request: Request) -> dict:
    """Принимает сырое аудио (любой формат, который понимает ffmpeg) в теле
    запроса, возвращает {"text", "duration_sec", "phrases": [{start, end, text,
    speaker}], "diarization", "engine", "engine_fallback"}.

    ?engine=tone|gigaam (по умолчанию tone; иное — 400). GigaAM не готов или упал —
    расшифровка идёт через T-one, engine_fallback = "not_ready" | "error".
    duration_sec — длительность распознанного аудио. speaker — 1..N только при
    diarization == "ok", иначе null."""
    q = request.query_params.get("engine")
    requested = "tone" if q is None else gigaam.parse_engine(q)
    if requested is None:
        raise HTTPException(status_code=400, detail="unknown engine")
    if pipeline is None:
        raise HTTPException(status_code=503, detail="model not loaded")

    engine, fallback = requested, None
    if requested == "gigaam" and not gigaam_engine.ready():
        engine, fallback = "tone", "not_ready"

    raw = await request.body()
    if not raw:
        return _empty("off" if (DIARIZATION_MODE == "off" or diarizer is None) else "skipped",
                      engine, fallback)

    def locked() -> dict:
        with _infer_lock:
            return _transcribe_file(raw, engine, fallback)

    return await run_in_threadpool(locked)


# ─── Потоковый режим (real-time стенограмма) ─────────────────────────────────
# T-one — СТРИМИНГОВАЯ CTC-модель. Правильное использование — forward(chunk, state)
# с прокидыванием state через всю запись, а не forward_offline на изолированных
# кусках (так рвутся слова на стыках и теряется контекст). Клиент шлёт сырой PCM
# int16 mono @ 8 кГц непрерывным потоком, мы режем на чанки по AUDIO_CHUNK_SAMPLES
# и кормим модель, отдавая фразы по мере готовности.
#

AUDIO_CHUNK_SAMPLES = 2400  # 300 мс @ 8 кГц — StreamingCTCModel.AUDIO_CHUNK_SAMPLES


@app.websocket("/stream")
async def stream(ws: WebSocket) -> None:
    await ws.accept()
    if pipeline is None:
        await ws.close(code=1011)
        return

    state = None
    buf = np.empty(0, dtype=np.int32)
    total_chars = 0

    async def _emit(phrases) -> None:
        nonlocal total_chars
        for p in phrases:
            t = (p.text or "").strip()
            if t:
                total_chars += len(t)
                await ws.send_json({"text": t})

    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break

            data = msg.get("bytes")
            if data is None:
                # текстовое управляющее сообщение (flush) — завершаем поток
                txt = msg.get("text") or ""
                if "flush" in txt:
                    break
                continue

            # int16 mono 8 кГц → int32 (как делает read_audio T-one)
            samples = np.frombuffer(data, dtype=np.int16).astype(np.int32)
            buf = np.concatenate([buf, samples])

            while buf.shape[0] >= AUDIO_CHUNK_SAMPLES:
                chunk = buf[:AUDIO_CHUNK_SAMPLES]
                buf = buf[AUDIO_CHUNK_SAMPLES:]
                phrases, state = pipeline.forward(chunk, state)
                await _emit(phrases)
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        log.warning("stream error: %s", type(e).__name__)
    finally:
        # Дослать хвост: финализируем состояние модели (последняя фраза).
        try:
            phrases, _ = pipeline.finalize(state)
            await _emit(phrases)
        except Exception:  # noqa: BLE001
            pass
        # В лог идёт только длина, без текста.
        log.info("stream closed: %d chars", total_chars)
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass
