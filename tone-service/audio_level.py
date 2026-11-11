"""
Выравнивание общего уровня записи перед распознаванием (MedScribe).

Браузер при очном приёме не усиливает микрофон сам (иначе теряется голос второго
собеседника), поэтому тихая запись с ноутбука на расстоянии приходит тихой — поднимаем
её здесь, один раз на весь файл, до T-one, разметки по голосу и GigaAM.

numpy импортируем на уровне модуля: он и так нужен сервису.
"""

import os

import numpy as np

# Выравнивание по ходу записи (ffmpeg dynaudnorm): подтягивает тихого собеседника
# (пациент далеко от микрофона, второй микрофон тише). Применяется до понижения
# частоты. Замер на синтетическом диалоге (тише на 18 дБ): доля распознанных слов
# тихого у GigaAM 11% → 84%, у T-one 11% → 46%; на обычном диалоге изменение в шуме метрики.
# Варианты f=250/g=31 и speechnorm не помогли.
LEVELER_FILTER = "dynaudnorm=f=150:g=15:p=0.9:m=10"


def leveler_enabled(value=None) -> bool:
    """Выключатель TONE_LEVELER: по умолчанию включено; off/0/false/no — выключено."""
    if value is None:
        value = os.environ.get("TONE_LEVELER", "")
    return value.strip().lower() not in ("off", "0", "false", "no")


def ffmpeg_decode_cmd(src: str, wav: str, max_sec, leveler: bool = True) -> list:
    """Команда ffmpeg: любой вход → wav 16 кГц моно. Чистая функция (ffmpeg не запускает).
    -af стоит раньше -ac/-ar: ffmpeg применяет фильтр к исходному звуку (его частота и
    каналы), а приведение к 16 кГц моно вставляет уже после цепочки фильтров."""
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error",
           "-protocol_whitelist", "file,pipe",
           "-format_whitelist", "mov,mp4,m4a,3gp,matroska,webm,ogg,wav,mp3",
           "-i", src, "-t", str(max_sec)]
    if leveler:
        cmd += ["-af", LEVELER_FILTER]
    return cmd + ["-ac", "1", "-ar", "16000", "-f", "wav", wav]


# Опорный уровень — 99,9-й перцентиль |x|, а не максимум: единичный щелчок или стук
# по столу не должен мешать поднять тихую речь.
REF_PERCENTILE = 99.9
# Ниже этого опорного уровня считаем запись пустой (тишина/шум АЦП) и не усиливаем.
SILENCE_REF = 1e-4
# Перцентиль считаем не больше чем по стольким отсчётам (≈ 2 млн float32 — около 8 МБ).
MAX_SAMPLES = 2_000_000


def _ref_level(x) -> float:
    """99,9-й перцентиль |x| по прореженной выборке (не больше ~MAX_SAMPLES значений):
    на длинной записи полная копия |x| стоила бы лишней памяти, а на точность это не влияет."""
    step = max(1, x.size // MAX_SAMPLES)
    return float(np.percentile(np.abs(x[::step]), REF_PERCENTILE))


def normalize_gain(x, target: float = 0.5, max_gain: float = 8.0, min_gain: float = 1.25,
                   inplace: bool = False) -> tuple:
    """Поднимает общий уровень float-записи. Возвращает (массив float32, усиление).
    Тишина или нужное усиление меньше min_gain — запись без изменений, усиление 1.0.
    По умолчанию входной массив не меняется (делается одна копия); inplace=True —
    float32-массив усиливается на месте, без копий (вызывающий отдаёт его насовсем)."""
    x = np.asarray(x, dtype=np.float32)
    if x.size == 0:
        return x, 1.0
    ref = _ref_level(x)
    if ref < SILENCE_REF:
        return x, 1.0
    need = target / ref
    if need < min_gain:
        return x, 1.0
    g = min(need, max_gain)
    y = x if inplace else x.copy()
    np.multiply(y, np.float32(g), out=y)
    np.clip(y, -1.0, 1.0, out=y)
    return y, g
