"""
Разметка записи по голосу (диаризация) для MedScribe.

sherpa-onnx: сегментация pyannote segmentation-3.0 + отпечатки голоса 3D-Speaker
CAM++ + кластеризация. Модели лежат в образе (/opt/diar), сети не нужно.

Отпечатки голоса — биометрия: наружу не отдаём и нигде не храним, наружу идут
только номера кластеров по времени.

sherpa_onnx и numpy импортируем только внутри load/run — чистая логика
(assign_speakers, finalize_labels) тестируется без сторонних пакетов.
"""

import os
from typing import Optional

MAX_SPEAKERS = 4
# калибровка на синтетике (TTS): ≤0.8 дробит 2 голоса на 3–4, 0.9–1.0 даёт верные 2 голоса;
# на 20 мин 1.0 дробит меньше (3 против 4). Выше 1.0 не пробовали
DEFAULT_THRESHOLD = 1.0
# Дольше этого разметку не запускаем (цена растёт с длиной); клиент режет запись на ≤20 мин
DEFAULT_MAX_SEC = 1320.0
MIN_SEC = 3.0


class Diarizer:
    """Два готовых диаризатора: auto (порог) и two (ровно 2 голоса)."""

    def __init__(self, auto, two) -> None:
        self.auto = auto
        self.two = two


def load(model_dir: str, threshold: float) -> Diarizer:
    import sherpa_onnx

    threads = min(4, os.cpu_count() or 1)

    def make(num_clusters: int):
        cfg = sherpa_onnx.OfflineSpeakerDiarizationConfig(
            segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
                pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                    model=os.path.join(model_dir, "segmentation.onnx"),
                    window_shift_ratio=0.5,
                ),
                num_threads=threads,
            ),
            embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(
                model=os.path.join(model_dir, "embedding.onnx"),
                num_threads=threads,
            ),
            clustering=sherpa_onnx.FastClusteringConfig(
                num_clusters=num_clusters, threshold=threshold
            ),
            min_duration_on=0.3,
            min_duration_off=0.5,
        )
        if not cfg.validate():
            raise ValueError("invalid diarization config")
        return sherpa_onnx.OfflineSpeakerDiarization(cfg)

    return Diarizer(auto=make(-1), two=make(2))


def _process(sd, samples):
    res = sd.process(samples).sort_by_start_time()
    return [(float(r.start), float(r.end), int(r.speaker)) for r in res]


def run(d: Diarizer, samples_16k) -> list:
    """samples_16k — numpy float32 моно 16 кГц. Возвращает [(start, end, cluster)]."""
    import numpy as np

    samples = np.ascontiguousarray(samples_16k, dtype=np.float32)
    segs = _process(d.auto, samples)
    # сеть голосов больше разумного → просим ровно двоих (врач и пациент)
    if len({c for _, _, c in segs}) > MAX_SPEAKERS:
        segs = _process(d.two, samples)
    return segs


def assign_speakers(
    phrases: list, segments: list, max_gap: float = 1.0
) -> list:
    """Кластер каждой фразы: с наибольшим суммарным перекрытием; нет перекрытия —
    ближайший сегмент при зазоре ≤ max_gap, иначе None."""
    out: list = []
    for p_start, p_end in phrases:
        overlap: dict = {}
        for s_start, s_end, cl in segments:
            o = min(p_end, s_end) - max(p_start, s_start)
            if o > 0:
                overlap[cl] = overlap.get(cl, 0.0) + o
        if overlap:
            out.append(max(overlap, key=lambda c: overlap[c]))
            continue
        best: Optional[int] = None
        best_gap = max_gap
        for s_start, s_end, cl in segments:
            gap = max(s_start - p_end, p_start - s_end, 0.0)
            if gap <= best_gap and (best is None or gap < best_gap):
                best, best_gap = cl, gap
        out.append(best)
    return out


def finalize_labels(labels: list) -> tuple:
    """Перенумерация 1..N по первому появлению. Нет голосов → "skipped",
    один → "single" (метки не нужны), иначе "ok"."""
    mapping: dict = {}
    for cl in labels:
        if cl is not None and cl not in mapping:
            mapping[cl] = len(mapping) + 1
    if not mapping:
        return [None] * len(labels), "skipped"
    if len(mapping) == 1:
        return [None] * len(labels), "single"
    return [None if cl is None else mapping[cl] for cl in labels], "ok"


def should_diarize(duration_sec: float, n_phrases: int, max_sec: float) -> bool:
    """Запускать ли разметку: нужны фразы и длительность в [MIN_SEC, max_sec]."""
    return n_phrases > 0 and MIN_SEC <= duration_sec <= max_sec
