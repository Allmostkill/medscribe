"""Тесты чистой логики gigaam.py. Запуск: python3 tone-service/test_gigaam.py"""

import hashlib
import os
import sys
import tempfile
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import gigaam  # noqa: E402
from gigaam import (  # noqa: E402
    MANIFEST, GigaamEngine, disk_enough, file_url, parse_engine, phrases_from_segments,
)

# манифест
assert len(MANIFEST) == 7
for repo, rev, name, sub, size, sha in MANIFEST:
    assert len(sha) == 64 and all(c in "0123456789abcdef" for c in sha), name
    assert size > 0 and len(rev) == 40
    assert "/" not in name and ".." not in name and sub in ("asr", "vad")
assert 227_000_000 < gigaam.TOTAL_BYTES < 228_000_000

# file_url
assert file_url("https://hf.example/", "a/b", "r1", "f.onnx") == "https://hf.example/a/b/resolve/r1/f.onnx"
assert file_url("http://m:8080", "a/b", "r1", "f") == "http://m:8080/a/b/resolve/r1/f"
for bad in ("ftp://x", "file:///etc", "huggingface.co", ""):
    try:
        file_url(bad, "a/b", "r", "f")
        raise SystemExit("file_url accepted " + bad)
    except ValueError:
        pass

# phrases_from_segments
S = SimpleNamespace
assert phrases_from_segments([S(start=0, end=1.5, text=" Привет. "), S(start=2, end=3, text="  "), S(start=3, end=4, text=None)]) == [
    {"start": 0.0, "end": 1.5, "text": "Привет."}
]
assert phrases_from_segments([]) == []

# disk_enough / parse_engine
assert disk_enough(300 * 1024 * 1024) and not disk_enough(10)
assert disk_enough(5, 5) and not disk_enough(4, 5)
assert parse_engine("tone") == "tone" and parse_engine("gigaam") == "gigaam"
for bad in (None, "", "GigaAM", "whisper", "tone "):
    assert parse_engine(bad) is None


# загрузка через фальшивый opener: подменяем манифест маленькими файлами
class Resp:
    def __init__(self, data: bytes) -> None:
        self.data, self.pos = data, 0

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self, n):
        c = self.data[self.pos:self.pos + n]
        self.pos += len(c)
        return c


FILES = {name: ("content-" + sub + name).encode() for _r, _v, name, sub, _s, _h in MANIFEST}
gigaam.MANIFEST = [
    (repo, rev, name, sub, len(FILES[name]), hashlib.sha256(FILES[name]).hexdigest())
    for repo, rev, name, sub, _s, _h in MANIFEST
]
# имена config.json/LICENSE.txt повторяются в asr и vad; одинаковое содержимое подходит обоим
gigaam.TOTAL_BYTES = sum(m[4] for m in gigaam.MANIFEST)


def good_opener(url, timeout=0):
    return Resp(FILES[url.rsplit("/", 1)[1]])


def run(engine):
    assert engine.prepare() == "downloading"
    engine._thread.join(10)
    return engine.status()


def make(root, opener, free=10**12):
    # _load_only без onnx_asr здесь не нужен: подменяем загрузку в память
    e = GigaamEngine(root, "https://hf.example", opener, free_bytes=lambda p: free, sleep=lambda s: None)
    e._ensure_loaded = lambda: None
    return e


with tempfile.TemporaryDirectory() as root:
    e = make(root, good_opener)
    assert e.status()["state"] == "absent" and not e.ready()
    st = run(e)
    assert st["state"] == "ready" and st["error"] is None, st
    assert st["downloaded_bytes"] == st["total_bytes"] == gigaam.TOTAL_BYTES
    assert os.path.isfile(os.path.join(root, "gigaam", gigaam.DIR_NAME, "ok.json"))
    assert os.path.isfile(os.path.join(root, "gigaam", gigaam.DIR_NAME, "asr", "v3_e2e_ctc.int8.onnx"))
    assert not os.path.exists(os.path.join(root, "gigaam", gigaam.DIR_NAME + ".tmp"))
    assert e.prepare() == "loading"  # ready без модели → только загрузка в память
    e._thread.join(10)
    # новый процесс: ready без загрузки; остатки .tmp удаляются
    os.makedirs(os.path.join(root, "gigaam", gigaam.DIR_NAME + ".tmp"))
    e2 = make(root, lambda *a, **k: (_ for _ in ()).throw(AssertionError("network")))
    assert e2.status()["state"] == "ready" and e2.ready()
    assert not os.path.exists(os.path.join(root, "gigaam", gigaam.DIR_NAME + ".tmp"))
    # ревизия в ok.json не совпала → absent
    import json
    p = os.path.join(root, "gigaam", gigaam.DIR_NAME, "ok.json")
    ok = json.load(open(p))
    ok["files"]["asr/config.json"]["rev"] = "0" * 40
    json.dump(ok, open(p, "w"))
    assert make(root, good_opener).status()["state"] == "absent"

# неверный sha → failed/checksum
with tempfile.TemporaryDirectory() as root:
    st = run(make(root, lambda url, timeout=0: Resp(b"broken")))
    assert st["state"] == "failed" and st["error"] == "checksum", st
    assert not os.path.exists(os.path.join(root, "gigaam", gigaam.DIR_NAME))
    assert not os.path.exists(os.path.join(root, "gigaam", gigaam.DIR_NAME + ".tmp"))


# исключение → failed/network; повтор после сбоя качает заново
def boom(url, timeout=0):
    raise OSError("unreachable")


with tempfile.TemporaryDirectory() as root:
    e = make(root, boom)
    st = run(e)
    assert st["state"] == "failed" and st["error"] == "network", st
    e._opener = good_opener
    assert run(e)["state"] == "ready"

# мало места → disk_space, сеть не трогаем
with tempfile.TemporaryDirectory() as root:
    st = run(make(root, boom, free=1000))
    assert st["state"] == "failed" and st["error"] == "disk_space", st


# ─── отмена, лимиты, повторная проверка ───────────────────────────────────
import threading  # noqa: E402


class Resp2(Resp):
    def __init__(self, data: bytes, headers=None, gate=None, extra=b"") -> None:
        super().__init__(data + extra)
        self.headers = headers or {}
        self.gate = gate

    def read(self, n):
        if self.gate is not None:
            self.gate.wait(10)
        return super().read(n)


def mk(root, opener, **kw):
    e = GigaamEngine(root, "https://hf.example", opener, free_bytes=lambda p: 10**12,
                     sleep=lambda s: None, **kw)
    e._ensure_loaded = lambda: None
    return e


def exists(root, *parts):
    return os.path.exists(os.path.join(root, "gigaam", *parts))


# release во время скачивания: остановка, .tmp убран, absent, в память не грузим
with tempfile.TemporaryDirectory() as root:
    gate = threading.Event()
    e = mk(root, lambda url, timeout=0: Resp2(FILES[url.rsplit("/", 1)[1]], gate=gate))
    loaded = []
    e._ensure_loaded = lambda: loaded.append(1)
    assert e.prepare() == "downloading"
    e.release()
    gate.set()
    e._thread.join(10)
    st = e.status()
    assert st["state"] == "absent" and st["error"] is None and not st["loaded"], st
    assert st["downloaded_bytes"] == 0 and not loaded
    assert not exists(root, gigaam.DIR_NAME + ".tmp") and not exists(root, gigaam.DIR_NAME)

# prepare после release до того, как поток заметил отмену: продолжаем и доходим до ready
with tempfile.TemporaryDirectory() as root:
    gate = threading.Event()
    e = mk(root, lambda url, timeout=0: Resp2(FILES[url.rsplit("/", 1)[1]], gate=gate))
    e.prepare()
    e.release()
    e.prepare()
    gate.set()
    e._thread.join(10)
    assert e.status()["state"] == "ready", e.status()

# release во время загрузки в память: после загрузки модель сбрасывается
with tempfile.TemporaryDirectory() as root:
    e = mk(root, good_opener)
    assert run(e)["state"] == "ready"
    go, started = threading.Event(), threading.Event()

    def slow_load():
        started.set()
        go.wait(10)
        e._model = object()

    e._ensure_loaded = slow_load
    assert e.prepare() == "loading"
    started.wait(10)
    assert e.release() == "loading"
    go.set()
    e._thread.join(10)
    st = e.status()
    assert st["state"] == "ready" and not st["loaded"], st

# prepare из failed при целых файлах: повторяем только загрузку в память (сеть не трогаем)
with tempfile.TemporaryDirectory() as root:
    e = mk(root, good_opener)
    run(e)
    e._opener = lambda *a, **k: (_ for _ in ()).throw(AssertionError("network"))
    e._set("failed", "load")
    assert e.prepare() == "verifying"
    e._thread.join(10)
    assert e.status()["state"] == "ready" and e.status()["error"] is None
    # файлы целы по размеру, но повреждены → sha не совпал → качаем заново
    e._set("failed", "load")
    bad = os.path.join(root, "gigaam", gigaam.DIR_NAME, "asr", "config.json")
    data = open(bad, "rb").read()
    open(bad, "wb").write(b"X" * len(data))
    e._opener = good_opener
    e.prepare()
    e._thread.join(10)
    assert e.status()["state"] == "ready" and open(bad, "rb").read() == data

# transcribe: сбой загрузки модели → failed/load
with tempfile.TemporaryDirectory() as root:
    e = mk(root, good_opener)
    run(e)

    def broken():
        raise RuntimeError("nope")

    e._ensure_loaded = broken
    try:
        e.transcribe([0.0])
        raise SystemExit("transcribe must fail")
    except RuntimeError:
        pass
    assert e.status()["state"] == "failed" and e.status()["error"] == "load"

# файлов нет (том подменили): _ensure_loaded не идёт в onnx-asr, состояние absent
with tempfile.TemporaryDirectory() as root:
    e = GigaamEngine(root, "https://hf.example", good_opener, free_bytes=lambda p: 10**12)
    e._set("ready")
    try:
        e._ensure_loaded()
        raise SystemExit("must raise")
    except gigaam._Fail:
        pass
    assert e.status()["state"] == "absent"

# поток длиннее заявленного размера → checksum, файл удалён
with tempfile.TemporaryDirectory() as root:
    e = mk(root, lambda url, timeout=0: Resp2(FILES[url.rsplit("/", 1)[1]], extra=b"extra-bytes"))
    st = run(e)
    assert st["state"] == "failed" and st["error"] == "checksum", st
    assert not exists(root, gigaam.DIR_NAME + ".tmp")

# Content-Length не совпал с размером → checksum
with tempfile.TemporaryDirectory() as root:
    e = mk(root, lambda url, timeout=0: Resp2(FILES[url.rsplit("/", 1)[1]], headers={"Content-Length": "999999"}))
    st = run(e)
    assert st["state"] == "failed" and st["error"] == "checksum", st

# верный Content-Length проходит
with tempfile.TemporaryDirectory() as root:
    e = mk(root, lambda url, timeout=0: (lambda d: Resp2(d, headers={"Content-Length": str(len(d))}))(FILES[url.rsplit("/", 1)[1]]))
    assert run(e)["state"] == "ready"

# предел по времени на файл → network
with tempfile.TemporaryDirectory() as root:
    ticks = iter(range(0, 10**9, 10**6))
    e = mk(root, good_opener, clock=lambda: next(ticks))
    st = run(e)
    assert st["state"] == "failed" and st["error"] == "network", st

# ошибка записи, не ENOSPC (права, read-only том) → unknown; ENOSPC → disk_space
import errno  # noqa: E402

for code, want in ((errno.EACCES, "unknown"), (errno.ENOSPC, "disk_space")):
    with tempfile.TemporaryDirectory() as root:
        e = mk(root, good_opener)
        real_open = open

        def fake_open(path, mode="r", *a, **k):
            if "wb" in mode and str(path).endswith(".onnx"):
                raise OSError(code, "x")
            return real_open(path, mode, *a, **k)

        gigaam.open = fake_open  # подмена builtins.open только внутри модуля
        try:
            st = run(e)
        finally:
            del gigaam.open
        assert st["state"] == "failed" and st["error"] == want, (code, st)

print("OK")

