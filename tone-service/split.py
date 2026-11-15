"""Нарезка длинной записи приёма: исходник приходит частями, ffmpeg склеивает поток
и режет на части по 20 мин (ogg/opus 32k моно 16 кГц) для обычной цепочки расшифровки.

Исходник по умолчанию на диск не пишется (поток в stdin ffmpeg). Исключение — mp4/m4a/3gp:
moov может стоять в конце файла, ffmpeg нужен поиск, поэтому такой файл пишется во
временный файл в /tmp (tmpfs). В журнал — только размеры, длительности, коды, число частей.
Имя файла пользователя сюда не попадает, теги (ID3 с ФИО) срезает -map_metadata -1."""

import base64
import glob
import logging
import os
import secrets
import shutil
import subprocess
import tempfile
import threading
import time

log = logging.getLogger("tone-service")

MAX_TASKS = 2  # одновременных задач
MAX_PART_BYTES = 17 * 1024 * 1024  # одна часть от браузера (шлёт по 16 МБ)
MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024  # исходник целиком
MAX_MP4_BYTES = 300 * 1024 * 1024  # mp4 пишется в tmpfs (512 МБ у контейнера)
# Общий бюджет временных mp4 по ВСЕМ задачам: tmpfs 512 МБ делится ещё с wav обычной расшифровки,
# две задачи по 300 МБ в него не влезут. Часть, выходящая за бюджет из-за чужой задачи, — busy.
MAX_MP4_BUDGET = 320 * 1024 * 1024
MAX_TOTAL_SEC = 7200.0  # 2 часа
CUT_LIMIT_SEC = 7201  # ffmpeg -t: на секунду больше предела, чтобы отличить «ровно 2 ч» от «длиннее»
SEGMENT_SEC = 1200  # 20 мин
MAX_SEGMENTS = 7
IDLE_SEC = 600  # задача без активности удаляется (активность — только принятая следующая часть)
# Общий предел жизни задачи от создания (повторы seq её не продлевают): 2 ГБ на канале
# медленнее ~4,8 Мбит/с за 1 ч не успевают. Задачу с идущим finish (working) по нему не убиваем.
MAX_LIFETIME_SEC = 3 * 3600
# Задача, у которой не принята ни одна часть (сирота после обрыва start), держит очередь недолго.
NO_PART_IDLE_SEC = 420  # с запасом больше requestTimeout Node (300 с): на медленном канале первая часть 16 МБ идёт минутами
FINISH_TIMEOUT_SEC = 1800  # декодирование 2 ч звука
PROBE_TIMEOUT_SEC = 30

# Имена ДЕМУКСЕРОВ ffmpeg (не расширения): mov,mp4,m4a,3gp — один демуксер; ogg покрывает opus;
# aac — сырой ADTS, amr — 3GPP AMR. WMA/DSS (asf и т.п.) намеренно не пускаем.
FORMAT_WHITELIST = "mov,mp4,m4a,3gp,matroska,webm,ogg,wav,mp3,flac,amr,aac"


class SplitError(Exception):
    """Ошибка с кодом ответа: app превращает её в JSON {code}."""

    def __init__(self, status: int, code: str, **extra):
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra  # дополнительные поля JSON (например, format="mp4")


def detect_container(head: bytes) -> str:
    """"mp4" — семейство ISO BMFF (ftyp на смещении 4: mp4/m4a/3gp/mov), нужен поиск по файлу;
    "stream" — остальное, можно кормить ffmpeg потоком."""
    if len(head) >= 8 and head[4:8] == b"ftyp":
        return "mp4"
    return "stream"


def ffmpeg_split_cmd(src: str, out_dir: str) -> list:
    """Команда ffmpeg: любой вход → сегменты seg000.ogg… по SEGMENT_SEC. Чистая функция.
    src — "pipe:0" (поток) или путь к файлу. Без shell и без имени файла пользователя."""
    return ["ffmpeg", "-hide_banner", "-loglevel", "error",
            "-protocol_whitelist", "file,pipe",
            "-format_whitelist", FORMAT_WHITELIST,
            "-i", src, "-t", str(CUT_LIMIT_SEC),
            "-map", "0:a:0", "-vn", "-map_metadata", "-1",
            # главы и теги потока (в m4a там бывает ФИО) в части не попадают
            "-map_chapters", "-1", "-map_metadata:s:a", "-1",
            "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "32k",
            "-f", "segment", "-segment_time", str(SEGMENT_SEC), "-reset_timestamps", "1",
            os.path.join(out_dir, "seg%03d.ogg")]


def classify_seq(next_seq: int, seq: int) -> str:
    """Порядок частей: "dup" — уже принята (200 без записи), "next" — ожидаемая, "gap" — пропуск."""
    if seq < 0 or seq > next_seq:
        return "gap"
    return "dup" if seq < next_seq else "next"


def check_limits(total_after: int, mode: str) -> None:
    """Суммарный размер после приёма очередной части; 413 too_big при превышении."""
    if mode == "mp4" and total_after > MAX_MP4_BYTES:
        raise SplitError(413, "too_big", format="mp4")
    if total_after > MAX_TOTAL_BYTES:
        raise SplitError(413, "too_big")


def _probe_duration(path: str) -> float:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, timeout=PROBE_TIMEOUT_SEC, check=True).stdout
        sec = float(out.decode().strip())
    except (subprocess.SubprocessError, ValueError, OSError):
        raise SplitError(415, "unsupported")
    if not sec >= 0 or sec == float("inf"):
        raise SplitError(415, "unsupported")
    return sec


class Task:
    def __init__(self, base_dir: str = None, mgr: "Manager" = None):
        self.mgr = mgr
        self.dir = tempfile.mkdtemp(prefix="split-", dir=base_dir)
        os.chmod(self.dir, 0o700)
        self.out_dir = os.path.join(self.dir, "out")
        os.mkdir(self.out_dir, 0o700)
        self.err_path = os.path.join(self.dir, "ffmpeg.err")
        self.src_path = os.path.join(self.dir, "in")
        self.mode = None  # определяется по первой части
        self.next_seq = 0
        self.total = 0
        self.proc = None
        self.reserved = 0  # байты mp4 в общем бюджете MAX_MP4_BUDGET
        self.finished = False  # finish уже начат: повтор finish/part — not_found
        self.in_flight = False  # часть в пути: вторая одновременная — 409
        self.created = time.monotonic()
        self.touched = self.created
        self.working = False  # идёт приём части или finish — не удалять по простою
        self.lock = threading.Lock()
        self.destroyed = False  # destroy начат: add_part/finish отказывают и на диск не пишут

    def _start_ffmpeg(self, src: str) -> None:
        with open(self.err_path, "wb") as err:  # stderr в файл: не забьёт канал и не держит память
            self.proc = subprocess.Popen(
                ffmpeg_split_cmd(src, self.out_dir),
                stdin=subprocess.PIPE if src == "pipe:0" else subprocess.DEVNULL,
                stdout=subprocess.DEVNULL, stderr=err)

    def kill(self) -> None:
        p = self.proc
        if p is not None and p.poll() is None:
            p.kill()
        if p is not None:
            try:
                p.wait(timeout=10)
            except subprocess.SubprocessError:
                pass
            if p.stdin:
                try:
                    p.stdin.close()
                except OSError:
                    pass

    def destroy(self) -> None:
        # Сначала флаг и kill без замка: ffmpeg умирает, и add_part/finish, держащие t.lock на записи
        # в stdin или в wait, возвращаются сами. Потом под замком добиваем (ffmpeg мог стартовать
        # уже после первого kill) и стираем каталог: параллельный add_part не пересоздаст файл.
        self.destroyed = True
        self.kill()
        with self.lock:
            self.kill()
            shutil.rmtree(self.dir, ignore_errors=True)

    def _ffmpeg_exited_early(self) -> None:
        """ffmpeg завершился до finish: дошёл до -t (запись > 2 ч) или не узнал формат.
        Дальше грузить файл бессмысленно — отвечаем ошибкой сразу."""
        try:
            rc = self.proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            return
        has_out = bool(glob.glob(os.path.join(self.out_dir, "seg*.ogg")))
        log.warning("split: ffmpeg вышел раньше finish, rc=%s, bytes=%d", rc, self.total)
        if rc == 0 and has_out:
            raise SplitError(413, "too_long")
        raise SplitError(415, "unsupported")

    def add_part(self, seq: int, data: bytes) -> None:
        with self.lock:
            if self.finished or self.destroyed:
                raise SplitError(404, "not_found")
            state = classify_seq(self.next_seq, seq)
            if state == "gap":
                raise SplitError(409, "gap")
            if state == "dup":
                return  # дубль не продлевает жизнь задачи
            if len(data) > MAX_PART_BYTES:
                raise SplitError(413, "too_big")
            if self.mode is None:
                if not data:
                    raise SplitError(415, "unsupported")
                self.mode = detect_container(data[:12])
                if self.mode == "stream":
                    self._start_ffmpeg("pipe:0")
            check_limits(self.total + len(data), self.mode)
            if self.mode == "mp4":
                self._reserve(len(data))
                try:
                    with open(self.src_path, "ab") as f:
                        f.write(data)
                except OSError:
                    self._release(len(data))
                    raise
            else:
                if self.proc.poll() is not None:
                    self._ffmpeg_exited_early()
                try:
                    self.proc.stdin.write(data)
                    self.proc.stdin.flush()
                except (BrokenPipeError, ValueError, OSError):
                    if self.destroyed:  # ffmpeg убил destroy (задачу сняли), а не формат
                        raise SplitError(404, "not_found")
                    self._ffmpeg_exited_early()
                    raise SplitError(415, "unsupported")
            self.total += len(data)
            self.next_seq += 1
            self.touched = time.monotonic()

    def _reserve(self, n: int) -> None:
        if self.mgr is not None:
            self.mgr.reserve_mp4(self, n)

    def _release(self, n: int) -> None:
        if self.mgr is not None:
            self.mgr.release_mp4(self, n)

    def finish(self) -> dict:
        with self.lock:
            if self.finished or self.destroyed:
                raise SplitError(404, "not_found")
            self.finished = True  # повтор finish после этого — not_found
            if self.mode is None:
                raise SplitError(415, "unsupported")
            if self.mode == "mp4":
                self._start_ffmpeg(self.src_path)
            else:
                try:
                    self.proc.stdin.close()
                except OSError:
                    pass
            try:
                rc = self.proc.wait(timeout=FINISH_TIMEOUT_SEC)
            except subprocess.TimeoutExpired:
                self.kill()
                log.warning("split: ffmpeg timeout")
                raise SplitError(415, "unsupported")
            files = sorted(glob.glob(os.path.join(self.out_dir, "seg*.ogg")))
            if rc != 0 or not files:
                log.warning("split: ffmpeg rc=%s, parts=%d, bytes=%d", rc, len(files), self.total)
                raise SplitError(415, "unsupported")
            durs = [_probe_duration(p) for p in files]
            total_sec = sum(durs)
            if total_sec > MAX_TOTAL_SEC or len(files) > MAX_SEGMENTS:
                log.warning("split: too long %.0fs", total_sec)
                raise SplitError(413, "too_long")
            if total_sec < 0.1:
                raise SplitError(415, "unsupported")
            segments = []
            for path, dur in zip(files, durs):
                with open(path, "rb") as f:
                    segments.append({"durationSec": dur,
                                     "audio": base64.b64encode(f.read()).decode("ascii")})
            log.info("split: ok, src=%d bytes mode=%s, parts=%d, total=%.1fs",
                     self.total, self.mode, len(segments), total_sec)
            return {"totalSec": total_sec, "segments": segments}


class Manager:
    def __init__(self, base_dir: str = None):
        self.base_dir = base_dir
        self.tasks = {}
        self.lock = threading.Lock()

    def create(self) -> str:
        with self.lock:
            if len(self.tasks) >= MAX_TASKS:
                raise SplitError(503, "busy")
            tid = secrets.token_urlsafe(24)  # 192 бита
            self.tasks[tid] = Task(self.base_dir, self)
            return tid

    def get(self, tid: str) -> Task:
        with self.lock:
            t = self.tasks.get(tid)
        if t is None:
            raise SplitError(404, "not_found")
        return t

    def reserve_mp4(self, task: Task, n: int) -> None:
        """Занимает байты в общем бюджете mp4; нехватка из-за чужих задач — 503 busy."""
        with self.lock:
            if task.reserved + n > MAX_MP4_BUDGET:
                raise SplitError(413, "too_big", format="mp4")
            others = sum(t.reserved for t in self.tasks.values() if t is not task)
            if others + task.reserved + n > MAX_MP4_BUDGET:
                raise SplitError(503, "busy")
            task.reserved += n

    def release_mp4(self, task: Task, n: int) -> None:
        with self.lock:
            task.reserved = max(0, task.reserved - n)

    def begin_part(self, tid: str, seq: int, content_length: int = 0) -> Task:
        """Проверки ДО чтения тела: известна ли задача, не пропуск ли seq, нет ли части в пути,
        влезает ли часть по Content-Length. Ставит in_flight; снять — end_part."""
        t = self.get(tid)
        too_big = False
        with self.lock:
            if t.finished:
                raise SplitError(404, "not_found")
            if classify_seq(t.next_seq, seq) == "gap":
                raise SplitError(409, "gap")
            if t.in_flight:
                raise SplitError(409, "part_in_flight")
            if content_length > MAX_PART_BYTES:
                too_big = True
            else:
                t.in_flight = True
        if too_big:
            self.drop(tid)  # иначе задача висела бы до таймаута
            raise SplitError(413, "too_big")
        return t

    def end_part(self, t: Task) -> None:
        with self.lock:
            t.in_flight = False

    def drop(self, tid: str) -> None:
        with self.lock:
            t = self.tasks.pop(tid, None)
        if t is not None:
            t.destroy()

    def run(self, tid: str, fn):
        """Выполняет операцию над задачей; при ошибке, кроме gap, задача стирается."""
        t = self.get(tid)
        t.working = True
        try:
            return fn(t)
        except SplitError as e:
            if e.code != "gap":
                self.drop(tid)
            raise
        except Exception:
            self.drop(tid)
            raise
        finally:
            t.working = False  # touched не трогаем: активность — только принятая часть

    def finish(self, tid: str) -> dict:
        res = self.run(tid, lambda t: t.finish())
        self.drop(tid)  # каталог стираем сразу после ответа
        return res

    def reap(self, now: float = None) -> int:
        """Удаляет задачи без активности IDLE_SEC (без единой части — NO_PART_IDLE_SEC) и прожившие
        дольше MAX_LIFETIME_SEC (кроме идущей операции: ffmpeg посреди finish не убиваем); возвращает сколько."""
        now = time.monotonic() if now is None else now
        with self.lock:
            stale = []
            for k, t in self.tasks.items():
                if t.working:
                    continue  # приём части или finish: дождёмся конца, следующий обход решит
                idle = NO_PART_IDLE_SEC if t.next_seq == 0 else IDLE_SEC
                if now - t.created > MAX_LIFETIME_SEC or (not t.in_flight and now - t.touched > idle):
                    stale.append(k)
        for k in stale:
            self.drop(k)
        return len(stale)

    def reaper_loop(self, every: float = 30.0) -> None:
        while True:
            time.sleep(every)
            try:
                self.reap()
            except Exception as e:  # noqa: BLE001
                log.warning("split reaper: %s", type(e).__name__)
