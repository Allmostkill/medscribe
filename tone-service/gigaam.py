"""
GigaAM v3 (Сбер, MIT) для MedScribe: второй движок итоговой расшифровки.

Готовая ONNX-конвертация istupakov/gigaam-v3-onnx (v3_e2e_ctc, int8, с пунктуацией
и нормализацией) + Silero VAD; запускает пакет onnx-asr (numpy + onnxruntime, без torch).
Веса в образ не вшиты: врач нажимает «скачать» в кабинете, файлы идут в том моделей
(HF_HOME) с зеркала HF_ENDPOINT, закреплены ревизией и sha256.

numpy, onnxruntime и onnx_asr импортируем только внутри функций — чистая логика
(манифест, загрузка, разбор сегментов) тестируется без сторонних пакетов.
Текст расшифровки не логируем.
"""

import errno
import hashlib
import json
import logging
import os
import shutil
import threading
import time
import urllib.request
from typing import Optional

MODEL_ID = "gigaam-v3-e2e-ctc-int8"
DIR_NAME = "v3_e2e_ctc_int8"

ASR_REPO = "istupakov/gigaam-v3-onnx"
ASR_REV = "322c3b29492673eb7d0b434bfa9dfb8653e34d02"
VAD_REPO = "istupakov/silero-vad-onnx"
VAD_REV = "b3e3ee3cce4c11ceb63b1a0b229d916069c1ddf6"

# (repo, rev, имя файла, подпапка, байт, sha256). config.json обязателен: без "version":"v3"
# onnx-asr берёт препроцессор v2.
MANIFEST = [
    (ASR_REPO, ASR_REV, "v3_e2e_ctc.int8.onnx", "asr", 224893347,
     "2e3fcb7a7b66030336fd10c2fcfb033bd1dc7e1bf238fe5cfd83b1d0cfc9d28e"),
    (ASR_REPO, ASR_REV, "v3_e2e_ctc_vocab.txt", "asr", 2007,
     "142de7570b3de5b3035ce111a89c228e80e6085273731d944093ddf24fa539cd"),
    (ASR_REPO, ASR_REV, "config.json", "asr", 135,
     "0641fcf73f4af791c73f05083e38a658ff5dcbee3534a0c61396c10f4b97f0fe"),
    (ASR_REPO, ASR_REV, "LICENSE.txt", "asr", 1070,
     "f00de6715714c7a63d08639cdbfaa40224eefc407302614bd19f1a8b98c875aa"),
    (VAD_REPO, VAD_REV, "silero_vad.onnx", "vad", 2327524,
     "1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3"),
    (VAD_REPO, VAD_REV, "config.json", "vad", 30,
     "1094039d370c82889582ba739a3d1caac5754c8b3a17a66a534200c9f72086e2"),
    (VAD_REPO, VAD_REV, "LICENSE.txt", "vad", 1075,
     "2e63e9a38b6e8fc0c7bc37ce174caca1862870856c6daf5697cfb785e925520b"),
]
TOTAL_BYTES = sum(m[4] for m in MANIFEST)
# запас под загрузку: 227 МБ файлов + проверка и переименование
NEED_FREE_BYTES = 300 * 1024 * 1024

ATTEMPTS = 3
# на один файл: 60 с запаса + размер при минимальной скорости 100 КБ/с (медленнее — сеть считаем мёртвой)
FETCH_BASE_SEC = 60
FETCH_MIN_SPEED = 100 * 1024
VAD_BATCH_SIZE = 4
log = logging.getLogger("tone-service")
STATES = ("absent", "downloading", "verifying", "loading", "ready", "failed")


def file_url(endpoint: str, repo: str, rev: str, name: str) -> str:
    base = endpoint.rstrip("/")
    if not (base.startswith("http://") or base.startswith("https://")):
        raise ValueError("endpoint must be http(s)")
    return f"{base}/{repo}/resolve/{rev}/{name}"


def disk_enough(free: int, need: int = NEED_FREE_BYTES) -> bool:
    return free >= need


def parse_engine(v) -> Optional[str]:
    """Значение ?engine= → "tone" | "gigaam"; всё прочее — None (400)."""
    return v if v in ("tone", "gigaam") else None


def phrases_from_segments(segs) -> list:
    """Сегменты onnx-asr (start, end, text) → фразы {start, end, text}; пустые отбрасываем."""
    out = []
    for s in segs:
        text = (s.text or "").strip()
        if not text:
            continue
        out.append({"start": float(s.start), "end": float(s.end), "text": text})
    return out


class _Fail(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class _Cancel(Exception):
    """Врач вернулся к T-one: загрузку прекращаем."""


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


class GigaamEngine:
    def __init__(self, models_root: str, endpoint: str, opener=urllib.request.urlopen,
                 free_bytes=None, sleep=time.sleep, clock=time.monotonic) -> None:
        self._base = os.path.join(models_root, "gigaam")
        self._final = os.path.join(self._base, DIR_NAME)
        self._tmp = self._final + ".tmp"
        self._endpoint = endpoint
        self._opener = opener
        self._free_bytes = free_bytes or (lambda p: shutil.disk_usage(p).free)
        self._sleep = sleep
        self._clock = clock
        self._lock = threading.Lock()       # состояние
        self._load_lock = threading.Lock()  # загрузка модели в память
        self._thread: Optional[threading.Thread] = None
        self._model = None
        self._error: Optional[str] = None
        self._downloaded = 0
        self._want = False    # модель нужна в памяти (prepare → True, release → False)
        self._cancel = False  # release во время загрузки: качать дальше не надо
        # остатки прерванной загрузки не нужны; том может быть недоступен на запись
        shutil.rmtree(self._tmp, ignore_errors=True)
        self._state = "ready" if self._files_ok() else "absent"
        if self._state == "ready":
            self._downloaded = TOTAL_BYTES

    # ─── состояние ────────────────────────────────────────────────────────

    def _files_ok(self) -> bool:
        try:
            with open(os.path.join(self._final, "ok.json"), encoding="utf-8") as f:
                ok = json.load(f)
            files = ok.get("files", {})
            for repo, rev, name, sub, size, _sha in MANIFEST:
                rec = files.get(f"{sub}/{name}")
                if not rec or rec.get("repo") != repo or rec.get("rev") != rev:
                    return False
                if os.path.getsize(os.path.join(self._final, sub, name)) != size:
                    return False
            return True
        except (OSError, ValueError, AttributeError):
            return False

    def _sha_ok(self) -> bool:
        try:
            return all(
                _sha256_file(os.path.join(self._final, sub, name)) == sha
                for _r, _v, name, sub, _s, sha in MANIFEST
            )
        except OSError:
            return False

    def status(self) -> dict:
        with self._lock:
            return {
                "state": self._state,
                "loaded": self._model is not None,
                "downloaded_bytes": self._downloaded,
                "total_bytes": TOTAL_BYTES,
                "error": self._error,
                "model": MODEL_ID,
            }

    def ready(self) -> bool:
        with self._lock:
            return self._state == "ready"

    def _set(self, state: str, error: Optional[str] = None) -> None:
        with self._lock:
            self._state = state
            self._error = error

    # ─── загрузка ─────────────────────────────────────────────────────────

    def prepare(self) -> str:
        """absent/failed — скачать и загрузить в память; ready без модели — загрузить
        в память; иначе ничего. Работает в фоне, возвращает текущее состояние."""
        with self._lock:
            self._want = True
            self._cancel = False  # снова нужна, пока качается: продолжаем
            if self._state == "failed" and self._files_ok():
                # файлы на месте, модель не запустилась: сверяем sha и грузим в память
                self._state, self._error = "verifying", None
                target = self._reverify_and_load
            elif self._state in ("absent", "failed"):
                self._state, self._error, self._downloaded = "downloading", None, 0
                target = self._download_and_load
            elif self._state == "ready" and self._model is None:
                self._state = "loading"
                target = self._load_only
            else:
                return self._state
            self._thread = threading.Thread(target=target, daemon=True)
            self._thread.start()
            return self._state

    def _reverify_and_load(self) -> None:
        if self._sha_ok():
            self._set("loading")
            self._load_only()
            return
        log.warning("gigaam: files on disk are corrupted, downloading again")
        shutil.rmtree(self._final, ignore_errors=True)
        self._set("downloading")
        self._download_and_load()

    def _download_and_load(self) -> None:
        while True:
            try:
                self._download_all()
                break
            except _Cancel:
                shutil.rmtree(self._tmp, ignore_errors=True)
                with self._lock:
                    if self._cancel:  # prepare мог снова позвать модель — тогда качаем заново
                        self._state, self._error, self._downloaded = "absent", None, 0
                        self._cancel = False
                        return
                    # Модель снова попросили: качаем с нуля, и кабинет видит загрузку, а не проверку.
                    self._state, self._error, self._downloaded = "downloading", None, 0
            except _Fail as e:
                self._set("failed", e.code)
                shutil.rmtree(self._tmp, ignore_errors=True)
                return
            except Exception as e:  # noqa: BLE001
                log.warning("gigaam: download failed: %s", type(e).__name__)
                self._set("failed", "unknown")
                shutil.rmtree(self._tmp, ignore_errors=True)
                return
        if not self._want:  # врач вернулся к T-one: файлы оставляем, в память не грузим
            self._set("ready")
            return
        self._set("loading")
        self._load_only()

    def _load_only(self) -> None:
        try:
            self._ensure_loaded()
        except _Fail as e:
            self._set("failed" if e.code != "absent" else "absent", None if e.code == "absent" else e.code)
            return
        except Exception as e:  # noqa: BLE001
            log.warning("gigaam: load failed: %s", type(e).__name__)
            self._set("failed", "load")
            return
        with self._lock:
            if not self._want:  # release пришёл во время загрузки в память
                self._model = None
            self._state, self._error = "ready", None

    def _check_cancel(self) -> None:
        if self._cancel:
            raise _Cancel()

    def _download_all(self) -> None:
        os.makedirs(self._base, exist_ok=True)
        try:
            free = self._free_bytes(self._base)
        except OSError:
            raise _Fail("unknown")
        if not disk_enough(free):
            raise _Fail("disk_space")
        shutil.rmtree(self._tmp, ignore_errors=True)
        for sub in ("asr", "vad"):
            os.makedirs(os.path.join(self._tmp, sub))

        done = 0
        for repo, rev, name, sub, size, sha in MANIFEST:
            dest = os.path.join(self._tmp, sub, name)
            url = file_url(self._endpoint, repo, rev, name)
            self._fetch(url, dest, size, sha, done, f"{sub}/{name}")
            done += size
            with self._lock:
                self._downloaded = done

        self._check_cancel()
        self._set("verifying")
        records = {}
        for repo, rev, name, sub, size, sha in MANIFEST:
            self._check_cancel()
            p = os.path.join(self._tmp, sub, name)
            if os.path.getsize(p) != size or _sha256_file(p) != sha:
                raise _Fail("checksum")
            records[f"{sub}/{name}"] = {"repo": repo, "rev": rev, "size": size, "sha256": sha}
        with open(os.path.join(self._tmp, "ok.json"), "w", encoding="utf-8") as f:
            json.dump({"model": MODEL_ID, "files": records}, f)
        self._check_cancel()
        shutil.rmtree(self._final, ignore_errors=True)
        os.rename(self._tmp, self._final)

    def _fetch(self, url: str, dest: str, size: int, sha: str, done_before: int, label: str) -> None:
        """Один файл: 3 попытки; sha256 и размер считаем на лету, лишние байты и
        расхождение с Content-Length обрываем, на файл есть предел по времени."""
        last = "network"
        for attempt in range(1, ATTEMPTS + 1):
            self._check_cancel()
            try:
                f = open(dest, "wb")
            except OSError as e:
                raise _write_fail(e)
            err = None
            try:
                with f:
                    h = hashlib.sha256()
                    got = 0
                    deadline = self._clock() + FETCH_BASE_SEC + size / FETCH_MIN_SPEED
                    try:
                        with self._opener(url, timeout=120) as r:
                            cl = getattr(r, "headers", None)
                            cl = cl.get("Content-Length") if cl is not None else None
                            if cl is not None and cl != str(size):
                                err = "checksum"
                            while err is None:
                                self._check_cancel()
                                if self._clock() > deadline:
                                    err = "network"
                                    break
                                # read1 отдаёт то, что уже пришло: срок и отмена проверяются
                                # и при очень медленной отдаче (read(n) ждал бы n байт).
                                chunk = getattr(r, "read1", r.read)(64 * 1024)
                                if not chunk:
                                    break
                                got += len(chunk)
                                if got > size:
                                    err = "checksum"
                                    break
                                h.update(chunk)
                                try:
                                    f.write(chunk)
                                except OSError as e:
                                    raise _write_fail(e)
                                with self._lock:
                                    self._downloaded = done_before + got
                    except (_Fail, _Cancel):
                        raise
                    except Exception as e:  # noqa: BLE001
                        err = "network"
                        log.warning("gigaam: fetch error: file=%s attempt=%d err=%s",
                                    label, attempt, type(e).__name__)
                if err is None and (got != size or h.hexdigest() != sha):
                    err = "checksum"
            except (_Fail, _Cancel):
                raise
            if err is None:
                return
            last = err
            log.warning("gigaam: fetch failed: file=%s attempt=%d code=%s", label, attempt, err)
            try:
                os.remove(dest)
            except OSError:
                pass
            if attempt < ATTEMPTS:
                self._sleep(2 * attempt)
        raise _Fail(last)

    # ─── модель в памяти ──────────────────────────────────────────────────

    def _ensure_loaded(self) -> None:
        with self._load_lock:
            if self._model is not None:
                return
            # onnx-asr при отсутствии файлов полез бы в HuggingFace сам — не даём:
            # грузим только проверенную папку
            if not self._files_ok():
                self._set("absent")
                raise _Fail("absent")
            import onnxruntime as ort
            import onnx_asr

            so = ort.SessionOptions()
            so.intra_op_num_threads = min(8, os.cpu_count() or 1)
            model = onnx_asr.load_model(
                "gigaam-v3-e2e-ctc", path=os.path.join(self._final, "asr"),
                quantization="int8", sess_options=so,
            )
            vad = onnx_asr.load_vad(
                "silero", path=os.path.join(self._final, "vad"), sess_options=so,
            )
            self._model = model.with_vad(vad, batch_size=VAD_BATCH_SIZE)

    def release(self) -> str:
        """Врач вернулся к T-one: прервать скачивание, выгрузить модель из памяти
        (скачанные файлы остаются). Вызывать под _infer_lock приложения."""
        with self._lock:
            self._want = False
            if self._state in ("downloading", "verifying"):
                self._cancel = True
            if self._state != "loading":
                self._model = None  # при loading модель сбросит поток загрузки
            return self._state

    def transcribe(self, samples16) -> list:
        """samples16 — numpy float32 моно 16 кГц. Возвращает фразы {start, end, text}
        (по сегментам VAD). Грузит модель в память при первом вызове."""
        if not self.ready():
            raise RuntimeError("gigaam not ready")
        try:
            self._ensure_loaded()
        except _Fail:
            raise
        except Exception:
            log.warning("gigaam: load failed on transcribe")
            self._set("failed", "load")
            raise
        import numpy as np

        x = np.ascontiguousarray(samples16, dtype=np.float32)
        return phrases_from_segments(self._model.recognize(x, sample_rate=16000))


def _write_fail(e: OSError) -> _Fail:
    """Ошибка записи на диск: нет места — disk_space, прочее (права, read-only том) — unknown."""
    log.warning("gigaam: write error: errno=%s", e.errno)
    return _Fail("disk_space" if e.errno == errno.ENOSPC else "unknown")
