"""Тесты чистой логики diarize.py. Запуск: python3 tone-service/test_diarize.py"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

from diarize import (  # noqa: E402
    _env_float, accept_auto, assign_speakers, finalize_labels, label_by_centroids, reliability,
    should_diarize, two_way, two_way_full, windows,
)

# перекрытие: по времени побеждает кластер с большей суммой
assert assign_speakers([(0.0, 4.0)], [(0.0, 1.0, 0), (1.0, 4.0, 1)]) == [1]
# суммируется по нескольким сегментам одного кластера
assert assign_speakers([(0.0, 4.0)], [(0.0, 1.5, 0), (1.5, 2.0, 1), (2.0, 3.5, 0)]) == [0]

# нет перекрытия: ближайший в пределах 1 с
assert assign_speakers([(5.0, 6.0)], [(0.0, 1.0, 0), (6.5, 8.0, 1)]) == [1]
assert assign_speakers([(5.0, 6.0)], [(0.0, 4.5, 0), (7.5, 8.0, 1)]) == [0]
# дальше 1 с → None
assert assign_speakers([(5.0, 6.0)], [(0.0, 3.0, 0), (8.0, 9.0, 1)]) == [None]
assert assign_speakers([(5.0, 6.0)], []) == [None]

# перенумерация по первому появлению: кластер 3 первый → 1
assert finalize_labels([3, 0, 3, 0, 7]) == ([1, 2, 1, 2, 3], "ok")
assert finalize_labels([3, None, 0]) == ([1, None, 2], "ok")

# один голос → single, метки не нужны
assert finalize_labels([2, 2, None, 2]) == ([None, None, None, None], "single")

# пусто → skipped
assert finalize_labels([]) == ([], "skipped")
assert finalize_labels([None, None]) == ([None, None], "skipped")

# лимит длительности: [3 с, max] и есть фразы
assert should_diarize(60.0, 5, 1320.0)
assert should_diarize(1320.0, 5, 1320.0)
assert not should_diarize(1320.1, 5, 1320.0)
assert not should_diarize(2.9, 5, 1320.0)
assert not should_diarize(60.0, 0, 1320.0)

# windows: короткий участок — одно окно, слишком короткий — пропуск
assert windows([(0.0, 1.5)], 2.0, 1.0, 1.0) == [(0.0, 1.5)]
assert windows([(0.0, 0.8)], 2.0, 1.0, 1.0) == []
# длинный: шаг 1 с, хвост добирается окном до края
assert windows([(0.0, 5.0)], 2.0, 1.0, 1.0) == [(0.0, 2.0), (1.0, 3.0), (2.0, 4.0), (3.0, 5.0)]
w = windows([(0.0, 4.5)], 2.0, 1.0, 1.0)
assert w[0] == (0.0, 2.0) and w[-1] == (2.5, 4.5) and all(abs(b - a - 2.0) < 1e-9 for a, b in w)
# окна соседних участков не смешиваются и перекрываются внутри участка
w = windows([(0.0, 3.0), (10.0, 11.5)], 2.0, 1.0, 1.0)
assert (10.0, 11.5) in w and all(not (3.0 < a < 10.0) for a, _ in w)
assert w[0][1] > w[1][0]

# reliability: фразы по 5 с; 15 фраз = 75 с суммарно
def ph(n, dur=5.0):
    return [(i * dur, (i + 1) * dur) for i in range(n)]

bal = [1, 2] * 8
assert reliability(bal, ph(16)) == "ok"
# второй голос — 1% речи → unreliable
minor = [1] * 40 + [2] * 1
phr = ph(40) + [(200.0, 200.5)]
assert reliability(minor, phr) == "unreliable"
# мало фраз у второго при заметной доле (две длинные реплики) → unreliable
few = [1] * 30 + [2] * 3
assert reliability(few, ph(30) + [(200.0, 215.0), (220.0, 235.0), (240.0, 255.0)]) == "unreliable"
# короткая запись (< 60 с) → всегда ok
assert reliability([1] * 9 + [2], ph(9, 5.0) + [(50.0, 50.2)]) == "ok"
# метки None игнорируются
assert reliability([None, None], ph(2)) == "ok"


def clouds(n_a, n_b, n_out, dim=192, seed=1):
    r = np.random.default_rng(seed)
    chan = r.normal(size=dim) * 2.0  # общий отпечаток канала
    ca, cb = r.normal(size=dim), r.normal(size=dim)
    a = chan + ca + r.normal(size=(n_a, dim)) * 0.35
    b = chan + cb + r.normal(size=(n_b, dim)) * 0.35
    out = chan + r.normal(size=(n_out, dim)) * 3.0
    x = np.vstack([a, b, out])
    truth = np.array([0] * n_a + [1] * n_b + [2] * n_out)
    return x, truth


# два облака с общим смещением и 3% выбросов → верное деление ≥ 95%, выбросы не забирают кластер
x, truth = clouds(200, 200, 12)
lab, cos = two_way(x)
m = truth < 2
acc = max(np.mean(lab[m] == truth[m]), np.mean(lab[m] != truth[m]))
assert acc >= 0.95, acc
assert min(np.bincount(lab)) > 0.3 * len(x), np.bincount(lab)
assert cos < 0.8, cos

# одно облако → центры почти совпадают
r = np.random.default_rng(2)
one = r.normal(size=192) * 2.0 + r.normal(size=(300, 192)) * 0.35
_, cos1 = two_way(one)
assert cos1 > 0.9, cos1

# мало окон → все в 0
lab0, _ = two_way(one[:1])
assert list(lab0) == [0]

# two_way_full: центроиды и среднее отдаются, метки те же, что у two_way
lab_f, cos_f, cents, mean = two_way_full(x)
assert list(lab_f) == list(lab) and cos_f == cos and cents.shape == (2, 192) and mean.shape == (192,)
assert two_way_full(one[:1])[2] is None

# label_by_centroids: новые отпечатки размечаются по центроидам после вычитания среднего
r = np.random.default_rng(5)
chan = r.normal(size=192) * 2.0
va, vb = r.normal(size=192), r.normal(size=192)
win = np.vstack([chan + va + r.normal(size=(100, 192)) * 0.3, chan + vb + r.normal(size=(100, 192)) * 0.3])
wl, _, cents, mean = two_way_full(win)
ka, kb = int(wl[0]), int(wl[-1])
assert ka != kb
# искусственные фразы: «да» голосом A, «нет» голосом B, одиночные отпечатки с шумом
short = np.vstack([chan + va + r.normal(size=192) * 0.5, chan + vb + r.normal(size=192) * 0.5])
assert label_by_centroids(short, cents, mean) == [ka, kb]
assert label_by_centroids(np.zeros((0, 192)), cents, mean) == []

# accept_auto: доля второго по длительности голоса против MIN_SHARE (0,10)
assert accept_auto([(0, 88, 0), (88, 100, 1)])  # 0,12 — второй голос принят
assert not accept_auto([(0, 94, 0), (94, 100, 1)])  # 0,06 — ложный «голос» на 20 мин, отсекаем
assert not accept_auto([(0, 98.7, 0), (98.7, 100, 1)])  # 0,013 — как у клиники
assert not accept_auto([(0, 100, 0)])
# 4 кластера: решает второй по длительности (0,12 ≥ 0,10), а не доли хвоста
assert accept_auto([(0, 76, 0), (76, 88, 1), (88, 94, 2), (94, 100, 3)])
# 4 кластера, второй по длительности 0,02 < 0,10
assert not accept_auto([(0, 96, 0), (96, 98, 1), (98, 99, 2), (99, 100, 3)])
# 5 кластеров — больше MAX_SPEAKERS
assert not accept_auto([(0, 50, 0), (50, 70, 1), (70, 80, 2), (80, 90, 3), (90, 100, 4)])

# короткие фразы (< MIN_PHRASE_SEC) метку соседа не наследуют: fill_short удалён,
# _phrase_embs пропускает такие фразы, run оставляет им None
import diarize  # noqa: E402
assert not hasattr(diarize, "fill_short")
rr = np.random.default_rng(7)
chan2, vdoc, vpat = rr.normal(size=192) * 0.5, rr.normal(size=192), rr.normal(size=192)


def _fake_embed(_ex, _samples, wins):  # отпечаток по середине окна: пациент говорит 40–50 с
    return np.stack([chan2 + (vpat if 40.0 <= (s + e) / 2 < 50.0 else vdoc) + rr.normal(size=192) * 0.3
                     for s, e in wins])


diarize._process = lambda _auto, _samples: [(0.0, 70.0, 0)]
diarize._embed = _fake_embed
ph3 = [(0.0, 20.0), (20.1, 20.4), (20.5, 40.0), (40.0, 50.0), (50.0, 70.0)]
segs3, path3 = diarize.run(diarize.Diarizer(None, None), np.zeros(16000 * 70, dtype=np.float32), ph3)
labs3 = [c for _, _, c in segs3]
assert path3 == "two_way", path3
# короткая фраза между двумя фразами врача — None, а не метка врача
assert labs3[1] is None, labs3
assert labs3[0] == labs3[2] == labs3[4] != labs3[3], labs3

# _env_float: nan, inf, минус, ноль, выше границы → default; граница hi допустима
for bad_v in ("nan", "inf", "-inf", "-1", "0", "2.5", "abc", ""):
    os.environ["T_ENV"] = bad_v
    assert _env_float("T_ENV", 1.0, 0.0, 2.0) == 1.0, bad_v
os.environ["T_ENV"] = "2"
assert _env_float("T_ENV", 1.0, 0.0, 2.0) == 2.0
os.environ["T_ENV"] = "0.8"
assert _env_float("T_ENV", 1.0, 0.0, 2.0) == 0.8
del os.environ["T_ENV"]

print("OK")
