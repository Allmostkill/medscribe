"""Тесты split.py. Запуск: python3 tone-service/test_split.py
Сквозной тест нужен ffmpeg с libopus; без него пропускается."""

import os
import shutil
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import split  # noqa: E402
from split import (Manager, SplitError, check_limits, classify_seq,  # noqa: E402
                   detect_container, ffmpeg_split_cmd)

# --- detect_container
assert detect_container(b"\x00\x00\x00\x20ftypM4A \x00\x00") == "mp4"
assert detect_container(b"\x00\x00\x00\x18ftyp3gp5") == "mp4"
assert detect_container(b"ID3\x04\x00\x00\x00\x00\x00\x00") == "stream"
assert detect_container(b"OggS\x00\x02" + b"\x00" * 10) == "stream"
assert detect_container(b"RIFF\x00\x00\x00\x00WAVE") == "stream"
assert detect_container(b"ftyp") == "stream"  # ftyp не на смещении 4
assert detect_container(b"") == "stream" and detect_container(b"\xff\xfb") == "stream"
assert detect_container(b"\x00\x01\x02") == "stream"

# --- ffmpeg_split_cmd
c = ffmpeg_split_cmd("pipe:0", "/tmp/x")
assert c[0] == "ffmpeg" and isinstance(c, list)
assert c[c.index("-i") + 1] == "pipe:0"
assert c[c.index("-t") + 1] == "7201"
assert c[c.index("-map_metadata") + 1] == "-1"
assert c[c.index("-map_chapters") + 1] == "-1"  # главы не попадают в части
assert c[c.index("-map_metadata:s:a") + 1] == "-1"  # теги аудиопотока тоже
assert "-codec_whitelist" not in c
assert c[c.index("-segment_time") + 1] == "1200"
assert c[c.index("-protocol_whitelist") + 1] == "file,pipe"
assert c[-1] == "/tmp/x/seg%03d.ogg"
assert c.index("-protocol_whitelist") < c.index("-i") and c.index("-format_whitelist") < c.index("-i")
assert c.index("-i") < c.index("-t") < c.index("-map")  # -t после -i: ограничивает вывод
wl = c[c.index("-format_whitelist") + 1].split(",")
for name in ("mov", "mp4", "m4a", "3gp", "matroska", "webm", "ogg", "wav", "mp3", "flac", "amr", "aac"):
    assert name in wl, name
assert "asf" not in wl  # WMA/DSS не принимаем
assert ffmpeg_split_cmd("/tmp/a/in", "/o")[ffmpeg_split_cmd("/tmp/a/in", "/o").index("-i") + 1] == "/tmp/a/in"

# --- порядок частей
assert classify_seq(0, 0) == "next" and classify_seq(3, 3) == "next"
assert classify_seq(3, 2) == "dup" and classify_seq(3, 0) == "dup"
assert classify_seq(3, 4) == "gap" and classify_seq(0, 1) == "gap" and classify_seq(0, -1) == "gap"

# --- лимиты
check_limits(split.MAX_TOTAL_BYTES, "stream")
check_limits(split.MAX_MP4_BYTES, "mp4")
for total, mode in ((split.MAX_TOTAL_BYTES + 1, "stream"), (split.MAX_MP4_BYTES + 1, "mp4")):
    try:
        check_limits(total, mode)
        raise AssertionError("limit")
    except SplitError as e:
        assert (e.status, e.code) == (413, "too_big")
check_limits(split.MAX_MP4_BYTES + 1, "stream")  # поток ограничен только 2 ГБ

# --- менеджер: busy, gap, идемпотентность, простой (ffmpeg не нужен: части только mp4-режима)
base = tempfile.mkdtemp()
m = Manager(base)
a, b = m.create(), m.create()
assert a != b and len(a) >= 22  # >=128 бит в base64url
try:
    m.create()
    raise AssertionError("busy")
except SplitError as e:
    assert (e.status, e.code) == (503, "busy")
MP4 = b"\x00\x00\x00\x20ftypM4A " + b"\x00" * 20
t = m.get(a)
try:
    m.run(a, lambda t: t.add_part(1, b"x"))
    raise AssertionError("gap")
except SplitError as e:
    assert (e.status, e.code) == (409, "gap")
assert a in m.tasks  # gap задачу не стирает
m.run(a, lambda t: t.add_part(0, MP4))
m.run(a, lambda t: t.add_part(0, MP4))  # повтор: байты второй раз не пишутся
assert os.path.getsize(t.src_path) == len(MP4) and t.next_seq == 1
assert oct(os.stat(t.dir).st_mode & 0o777) == "0o700"
t.total = split.MAX_MP4_BYTES  # следующая часть превысит предел tmpfs
try:
    m.run(a, lambda t: t.add_part(1, b"x"))
    raise AssertionError("too_big")
except SplitError as e:
    assert (e.status, e.code) == (413, "too_big")
assert a not in m.tasks and not os.path.exists(t.dir)  # ошибка → каталог стёрт
# простой: reap
t2 = m.get(b)
assert m.reap() == 0
assert m.reap(time.monotonic() + split.NO_PART_IDLE_SEC + 1) == 1 and not os.path.exists(t2.dir)
c = m.create()
m.drop(c)
m.drop(c)  # повторная отмена безвредна
assert not m.tasks and os.listdir(base) == []
shutil.rmtree(base)

# --- дубль не продлевает жизнь, общий предел 3 ч
base = tempfile.mkdtemp()
m = Manager(base)
a = m.create()
t = m.get(a)
m.run(a, lambda t: t.add_part(0, MP4))
t.touched = time.monotonic() - 100
before = t.touched
m.run(a, lambda t: t.add_part(0, MP4))  # дубль
assert t.touched == before
try:
    m.run(a, lambda t: t.add_part(5, MP4))  # пропуск тоже не продлевает
except SplitError:
    pass
assert t.touched == before
m.run(a, lambda t: t.add_part(1, MP4))  # следующая часть — продлевает
assert t.touched > before
now = time.monotonic()
assert m.reap(now + split.IDLE_SEC - 5) == 0
t.touched = now + split.MAX_LIFETIME_SEC  # активность свежая, но задача прожила > 3 ч
assert m.reap(now + split.MAX_LIFETIME_SEC + 1) == 1 and a not in m.tasks and not os.path.exists(t.dir)
shutil.rmtree(base)

# --- пределы жизни: 3 ч, finish не убиваем, сирота без частей — 60 с
assert split.MAX_LIFETIME_SEC == 10800 and split.NO_PART_IDLE_SEC == 420
base = tempfile.mkdtemp()
m = Manager(base)
a, b = m.create(), m.create()
ta, tb = m.get(a), m.get(b)
m.run(a, lambda t: t.add_part(0, MP4))  # у a есть часть, у b нет
now = time.monotonic()
ta.touched = tb.touched = now + 10000  # активность свежая
assert m.reap(now + 3600 + 5) == 0  # старый предел в 1 ч больше не действует
assert m.reap(now + split.NO_PART_IDLE_SEC + 5) == 0  # свежая активность: сирота ещё не простаивает
tb.touched = now
assert m.reap(now + split.NO_PART_IDLE_SEC - 1) == 0
assert m.reap(now + split.NO_PART_IDLE_SEC + 1) == 1 and b not in m.tasks and a in m.tasks  # у a часть есть
tb = None
ta.working = True  # идёт finish: по общему пределу не убиваем
assert m.reap(now + split.MAX_LIFETIME_SEC + 100) == 0 and a in m.tasks
ta.working = False
assert m.reap(now + split.MAX_LIFETIME_SEC + 100) == 1 and a not in m.tasks
# задача без частей, но с частью в пути, простоем не убирается
c = m.create()
tc = m.get(c)
tc.in_flight = True
assert m.reap(time.monotonic() + split.NO_PART_IDLE_SEC + 5) == 0
tc.in_flight = False
assert m.reap(time.monotonic() + split.NO_PART_IDLE_SEC + 5) == 1
assert os.listdir(base) == []
shutil.rmtree(base)

# --- общий бюджет mp4 по задачам
base = tempfile.mkdtemp()
m = Manager(base)
a, b = m.create(), m.create()
m.run(a, lambda t: t.add_part(0, MP4))
ta, tb = m.get(a), m.get(b)
assert ta.reserved == len(MP4)
ta.reserved = split.MAX_MP4_BUDGET - 5  # первая задача заняла почти весь бюджет
tb.mode = "mp4"
try:
    m.run(b, lambda t: t.add_part(0, MP4))
    raise AssertionError("busy")
except SplitError as e:
    assert (e.status, e.code) == (503, "busy")  # из-за чужой задачи
assert b not in m.tasks and a in m.tasks
assert split.MAX_MP4_BUDGET >= split.MAX_MP4_BYTES and split.MAX_MP4_BUDGET == 320 * 1024 * 1024
try:
    check_limits(split.MAX_MP4_BYTES + 1, "mp4")
except SplitError as e:
    assert (e.status, e.code, e.extra) == (413, "too_big", {"format": "mp4"})
m.drop(a)  # стёртая задача освобождает бюджет
c = m.create()
m.run(c, lambda t: t.add_part(0, MP4))
assert m.get(c).reserved == len(MP4)
m.drop(c)
shutil.rmtree(base)

# --- begin_part: gap/занятость/размер до чтения тела
base = tempfile.mkdtemp()
m = Manager(base)
a = m.create()
for seq, code in ((3, "gap"), (-1, "gap")):
    try:
        m.begin_part(a, seq, 10)
        raise AssertionError("gap")
    except SplitError as e:
        assert (e.status, e.code) == (409, "gap")
assert a in m.tasks
t = m.begin_part(a, 0, 10)
try:
    m.begin_part(a, 0, 10)
    raise AssertionError("in_flight")
except SplitError as e:
    assert (e.status, e.code) == (409, "part_in_flight")
assert m.reap(time.monotonic() + split.IDLE_SEC + 1) == 0  # часть в пути — не простой
m.end_part(t)
try:
    m.begin_part(a, 0, split.MAX_PART_BYTES + 1)
    raise AssertionError("too_big")
except SplitError as e:
    assert (e.status, e.code) == (413, "too_big")
assert a not in m.tasks and os.listdir(base) == []  # задача стёрта
shutil.rmtree(base)

# --- после finish задача стёрта: повтор finish/part — not_found
base = tempfile.mkdtemp()
m = Manager(base)
a = m.create()
m.run(a, lambda t: t.add_part(0, MP4))
t = m.get(a)
t.finished = True
for fn in (lambda: m.run(a, lambda t: t.add_part(1, MP4)), lambda: m.begin_part(a, 1, 1)):
    try:
        fn()
        raise AssertionError("gone")
    except SplitError as e:
        assert (e.status, e.code) == (404, "not_found")
m.drop(a)
try:
    m.finish(a)
    raise AssertionError("gone")
except SplitError as e:
    assert (e.status, e.code) == (404, "not_found")
shutil.rmtree(base)

# --- ffmpeg вышел раньше finish: следующая часть сразу отвечает ошибкой, задача стёрта
base = tempfile.mkdtemp()
m = Manager(base)
a = m.create()
t = m.get(a)
t.mode = "stream"
t.proc = subprocess.Popen([sys.executable, "-c", "import sys; sys.exit(1)"], stdin=subprocess.PIPE)
t.proc.wait()
try:
    m.run(a, lambda t: t.add_part(0, b"x" * 100))
    raise AssertionError("unsupported")
except SplitError as e:
    assert (e.status, e.code) == (415, "unsupported")
assert a not in m.tasks and not os.path.exists(t.dir)
# rc=0 и сегменты есть — дошёл до -t: too_long
a = m.create()
t = m.get(a)
t.mode = "stream"
open(os.path.join(t.out_dir, "seg000.ogg"), "wb").close()
t.proc = subprocess.Popen([sys.executable, "-c", "pass"], stdin=subprocess.PIPE)
t.proc.wait()
try:
    m.run(a, lambda t: t.add_part(0, b"x" * 100))
    raise AssertionError("too_long")
except SplitError as e:
    assert (e.status, e.code) == (413, "too_long")
assert a not in m.tasks
shutil.rmtree(base)

# --- drop и add_part: после drop каталог не пересоздаётся
base = tempfile.mkdtemp()
m = Manager(base)
tid = m.create()
t = m.get(tid)
mp4_head = b"\x00\x00\x00\x20ftypM4A \x00\x00" + b"\x00" * 100
t.add_part(0, mp4_head)
m.drop(tid)
assert os.listdir(base) == [] and t.destroyed
try:
    t.add_part(1, b"x" * 10)  # поздний add_part после drop: на диск не пишем
    raise AssertionError("destroyed")
except SplitError as e:
    assert (e.status, e.code) == (404, "not_found")
assert os.listdir(base) == []
# drop параллельно с add_part, держащим замок: drop ждёт замок и стирает после записи
import threading  # noqa: E402
for _ in range(20):
    tid = m.create()
    t = m.get(tid)
    t.add_part(0, mp4_head)
    errs = []

    def _late():
        try:
            t.add_part(1, b"y" * 1000)
        except SplitError as e:
            errs.append(e.code)
    th = threading.Thread(target=_late)
    th.start()
    m.drop(tid)
    th.join()
    assert os.listdir(base) == [], os.listdir(base)
shutil.rmtree(base)

# --- сквозной тест (нужен ffmpeg с libopus)
def _have_ffmpeg() -> bool:
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        return False
    out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True).stdout
    return b"libopus" in out and b"libmp3lame" in out


def _gen(path: str, *extra: str) -> bytes:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=180", *extra, path],
                   check=True)
    with open(path, "rb") as f:
        return f.read()


def _e2e(raw: bytes, mode: str) -> None:
    base = tempfile.mkdtemp()
    mm = Manager(base)
    tid = mm.create()
    step = 700 * 1024  # несколько частей, чтобы проверить склейку
    for i, off in enumerate(range(0, len(raw), step)):
        mm.run(tid, lambda t: t.add_part(i, raw[off:off + step]))
    assert mm.get(tid).mode == mode
    res = mm.finish(tid)
    assert len(res["segments"]) == 1, res["totalSec"]
    assert abs(res["totalSec"] - 180) < 2 and abs(res["segments"][0]["durationSec"] - 180) < 2
    assert res["segments"][0]["audio"]
    assert os.listdir(base) == [] and not mm.tasks  # после finish всё стёрто
    shutil.rmtree(base)


if _have_ffmpeg():
    d = tempfile.mkdtemp()
    _e2e(_gen(os.path.join(d, "a.mp3")), "stream")
    _e2e(_gen(os.path.join(d, "a.m4a"), "-c:a", "aac"), "mp4")
    # не аудио → unsupported, каталог стёрт
    base = tempfile.mkdtemp()
    mm = Manager(base)
    tid = mm.create()
    mm.run(tid, lambda t: t.add_part(0, b"this is not audio at all" * 1000))
    try:
        mm.finish(tid)
        raise AssertionError("unsupported")
    except SplitError as e:
        assert (e.status, e.code) == (415, "unsupported")
    assert os.listdir(base) == []
    shutil.rmtree(base)
    shutil.rmtree(d)
    print("split: ok (с ffmpeg)")
else:
    print("split: ok (ffmpeg нет — сквозной тест пропущен)")
