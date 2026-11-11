"""Тесты audio_level.py. Запуск: python3 tone-service/test_audio_level.py"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from audio_level import (LEVELER_FILTER, MAX_SAMPLES, ffmpeg_decode_cmd,  # noqa: E402
                         leveler_enabled, normalize_gain)  # noqa: E402

rng = np.random.default_rng(1)
N = 16000 * 3


def speech(amp):
    """Похоже на речь: синус с медленной огибающей, пик ровно amp."""
    t = np.arange(N) / 16000.0
    x = np.sin(2 * np.pi * 220 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 2 * t))
    return (x / np.abs(x).max() * amp).astype(np.float32)


# тишина и пустой массив — без изменений
z = np.zeros(N, dtype=np.float32)
y, g = normalize_gain(z)
assert g == 1.0 and y is z
y, g = normalize_gain((rng.standard_normal(N) * 1e-6).astype(np.float32))
assert g == 1.0
y, g = normalize_gain(np.zeros(0, dtype=np.float32))
assert g == 1.0 and y.size == 0

# громкая запись — без изменений
loud = speech(0.8)
y, g = normalize_gain(loud)
assert g == 1.0 and np.array_equal(y, loud)

# чуть тише нужного, но усиление < 1.25 — без изменений
y, g = normalize_gain(speech(0.42))
assert g == 1.0

# тихая речь — усиление, до целевого уровня
quiet = speech(0.1)
y, g = normalize_gain(quiet)
assert 1.25 < g <= 8.0, g
assert abs(np.abs(y).max() - 0.5) < 0.02, np.abs(y).max()

# очень тихая — упирается в max_gain
y, g = normalize_gain(speech(0.01))
assert g == 8.0
y, g = normalize_gain(speech(0.01), max_gain=4.0)
assert g == 4.0

# одиночный щелчок при тихой речи: усиление всё равно есть
clicky = speech(0.1)
clicky[N // 2] = 0.9
y, g = normalize_gain(clicky)
assert g > 4.0, g
assert np.abs(y).max() <= 1.0  # щелчок ограничен, не вылетает за диапазон

# клиппинг ограничен
y, g = normalize_gain(clicky, target=0.9, max_gain=8.0)
assert y.max() <= 1.0 and y.min() >= -1.0

# тип и форма; вход не изменён
src = speech(0.1)
before = src.copy()
y, g = normalize_gain(src)
assert y.dtype == np.float32 and y.shape == src.shape
assert np.array_equal(src, before)
y, g = normalize_gain(src.astype(np.float64))
assert y.dtype == np.float32

# inplace=True: тот же массив усилен на месте, без копии
buf = speech(0.1)
y, g = normalize_gain(buf, inplace=True)
assert y is buf and g > 1.25 and abs(np.abs(buf).max() - 0.5) < 0.02
# inplace=True и тишина/громкая запись: без изменений
loud2 = speech(0.8)
ref_copy = loud2.copy()
y, g = normalize_gain(loud2, inplace=True)
assert g == 1.0 and np.array_equal(loud2, ref_copy)

# длинная запись (> MAX_SAMPLES отсчётов): перцентиль по прореженной выборке, усиление то же
long_n = MAX_SAMPLES * 2 + 12345
t = np.arange(long_n) / 16000.0
long_x = (np.sin(2 * np.pi * 220 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * t)) * 0.1).astype(np.float32)
y, g = normalize_gain(long_x)
assert 1.25 < g <= 8.0, g
assert y.shape == long_x.shape and np.abs(y).max() <= 1.0
assert abs(np.abs(y).max() - 0.5) < 0.05, np.abs(y).max()
assert np.abs(long_x).max() < 0.11  # вход не изменён

# команда ffmpeg: фильтр выравнивания до -ar 16000, параметры на месте
cmd = ffmpeg_decode_cmd("in", "out.wav", 1505, True)
assert "-af" in cmd and cmd[cmd.index("-af") + 1] == LEVELER_FILTER
assert cmd.index("-af") < cmd.index("-ac") < cmd.index("-ar")
assert cmd[cmd.index("-t") + 1] == "1505" and cmd[cmd.index("-ar") + 1] == "16000"
assert cmd[cmd.index("-ac") + 1] == "1" and cmd[-3:] == ["-f", "wav", "out.wav"][-3:]
assert cmd[cmd.index("-i") + 1] == "in" and "-protocol_whitelist" in cmd
off = ffmpeg_decode_cmd("in", "out.wav", 1505, False)
assert "-af" not in off and "dynaudnorm" not in " ".join(off)
assert [a for a in cmd if a not in ("-af", LEVELER_FILTER)] == off
# выключатель
assert leveler_enabled("") and leveler_enabled("on") and leveler_enabled("1")
assert not any(leveler_enabled(v) for v in ("off", "OFF", "0", "false", " False "))

print("audio_level: ok")
