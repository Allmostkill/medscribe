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


def _env_float(name: str, default: float, lo: float, hi: float) -> float:
    """Число из переменной окружения; пусто, мусор, nan, inf или вне (lo, hi] → default."""
    try:
        v = float(os.environ.get(name, ""))
    except ValueError:
        return default
    return v if lo < v <= hi else default


# Меньший голос должен занимать хотя бы такую долю речи, иначе это выброс (кашель,
# наложение, шум), а не второй собеседник. 0,10 (решение 15.11.2026): при 0,05 на 20-минутной
# записи «две петлички» принимался ложный второй голос (~6% речи, 54% верных ролей). Цена:
# пациент, который только поддакивает (<10% речи), уходит в «один голос» — роли по смыслу.
# Диапазон DIAR_MIN_SHARE — (0; 0,5): от 0,5 и выше любая запись была бы unreliable,
# верхняя граница исключается (_env_float допускает hi, поэтому берём число чуть меньше).
MIN_SHARE = _env_float("DIAR_MIN_SHARE", 0.10, 0.0, 0.4999)
# Доверие к доле меньшего голоса — только когда суммарная длительность размеченных
# фраз не меньше этого (с): паузы и тишина статистики не дают
MIN_JUDGE_SEC = 60.0
MIN_MINOR_PHRASES = 5
# Косинус центров двух половин по отпечаткам окон: выше — это один голос.
# Замер на синтетике (15.11.2026): два голоса 0,47–0,49, один голос 0,92–0,93 — порог
# посередине с запасом; на живых записях ещё уточнить.
SINGLE_COS = 0.72
# Окна для повторной разметки по отпечаткам: длина, шаг, минимум (с)
WIN, HOP, MIN_WIN = 2.0, 1.0, 1.0
MIN_WINDOWS = 10
RESTARTS, SEED = 10, 0
# Разметка фраз: короче этого отпечаток ненадёжен — метка None, соседа не наследуем (с);
# длиннее PHRASE_LONG отпечаток — среднее по окнам WIN без перекрытия (с)
MIN_PHRASE_SEC = 0.5
PHRASE_LONG = 6.0


class Diarizer:
    """auto — диаризатор sherpa-onnx (порог); extractor — отпечатки голоса для окон
    (та же модель embedding.onnx, что внутри auto)."""

    def __init__(self, auto, extractor) -> None:
        self.auto = auto
        self.extractor = extractor


def load(model_dir: str, threshold: float) -> Diarizer:
    import sherpa_onnx

    threads = min(4, os.cpu_count() or 1)
    emb_cfg = dict(model=os.path.join(model_dir, "embedding.onnx"), num_threads=threads)

    cfg = sherpa_onnx.OfflineSpeakerDiarizationConfig(
        segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
            pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                model=os.path.join(model_dir, "segmentation.onnx"),
                window_shift_ratio=0.5,
            ),
            num_threads=threads,
        ),
        embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(**emb_cfg),
        clustering=sherpa_onnx.FastClusteringConfig(num_clusters=-1, threshold=threshold),
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    if not cfg.validate():
        raise ValueError("invalid diarization config")
    ex_cfg = sherpa_onnx.SpeakerEmbeddingExtractorConfig(**emb_cfg)
    if not ex_cfg.validate():
        raise ValueError("invalid embedding config")
    return Diarizer(
        auto=sherpa_onnx.OfflineSpeakerDiarization(cfg),
        extractor=sherpa_onnx.SpeakerEmbeddingExtractor(ex_cfg),
    )


def _process(sd, samples):
    res = sd.process(samples).sort_by_start_time()
    return [(float(r.start), float(r.end), int(r.speaker)) for r in res]


def _spans(segs: list, gap: float = 0.2) -> list:
    """Речевые участки: сегменты всех кластеров по времени, слитые при зазоре ≤ gap."""
    out: list = []
    for s, e, _ in sorted(segs):
        if out and s - out[-1][1] <= gap:
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out


def windows(regions: list, win: float, hop: float, min_len: float) -> list:
    """Окна длиной win с шагом hop по речевым участкам [(s, e)]. Участок короче win —
    одно окно целиком; короче min_len — пропускаем. Хвост добирается окном до края."""
    out: list = []
    for s, e in regions:
        if e - s < min_len:
            continue
        if e - s <= win:
            out.append((s, e))
            continue
        t = s
        while t + win < e:
            out.append((t, t + win))
            t += hop
        out.append((e - win, e))
    return out


def _unit(x):
    import numpy as np

    n = np.linalg.norm(x, axis=-1, keepdims=True)
    return x / np.maximum(n, 1e-9)


def two_way(emb):
    """Делит отпечатки окон [N, D] на два голоса. Возвращает (метки 0/1, косинус центров).
    Подробности — в two_way_full."""
    labels, cos, _, _ = two_way_full(emb)
    return labels, cos


def two_way_full(emb):
    """То же, что two_way, но ещё возвращает (метки, косинус, центроиды [2, D], среднее):
    центроиды — в пространстве после вычитания общего среднего (его и отдаём), чтобы
    разметить по ним новые отпечатки через label_by_centroids. Центроиды None, если
    деление не удалось (мало окон или кластер-выброс). Только в памяти.
    Общее среднее вычитаем (убирает отпечаток канала, общий для обоих голосов); сферический
    k-means (k=2, k-means++), RESTARTS запусков с фиксированным SEED; запуски с кластером
    < 2% окон отбрасываем (это выбросы). Косинус центров — по нецентрированным отпечаткам."""
    import numpy as np

    n = len(emb)
    if n < 2:
        return np.zeros(n, dtype=int), 1.0, None, None
    raw = _unit(np.asarray(emb, dtype=np.float64))
    mean = raw.mean(axis=0)
    x = _unit(raw - mean)
    rng = np.random.default_rng(SEED)
    best = None
    best_score = -np.inf
    for _ in range(RESTARTS):
        c0 = x[rng.integers(n)]
        d = np.clip(1.0 - x @ c0, 0.0, None) ** 2
        c1 = x[rng.choice(n, p=d / d.sum())] if d.sum() > 0 else x[rng.integers(n)]
        cent = np.stack([c0, c1])
        labels = np.zeros(n, dtype=int)
        for it in range(50):
            new = np.argmax(x @ cent.T, axis=1)
            if it and np.array_equal(new, labels):
                break
            labels = new
            for k in (0, 1):
                if np.any(labels == k):
                    cent[k] = _unit(x[labels == k].sum(axis=0))
        sizes = np.bincount(labels, minlength=2)
        if sizes.min() < 0.02 * n:
            continue
        score = float(np.sum(x * cent[labels]))
        if score > best_score:
            best, best_score = labels.copy(), score
    if best is None:
        return np.zeros(n, dtype=int), 1.0, None, None
    c = [_unit(raw[best == k].mean(axis=0)) for k in (0, 1)]
    cents = np.stack([_unit(x[best == k].mean(axis=0)) for k in (0, 1)])
    return best, float(c[0] @ c[1]), cents, mean


def label_by_centroids(phrase_embs, centroids, mean) -> list:
    """Метка 0/1 каждому отпечатку [N, D]: ближайший центроид по косинусу, после того же
    вычитания общего среднего, что в two_way_full."""
    import numpy as np

    e = np.asarray(phrase_embs, dtype=np.float64)
    if e.size == 0:
        return []
    x = _unit(_unit(e) - mean)
    return [int(k) for k in np.argmax(x @ np.asarray(centroids).T, axis=1)]


def _embed(extractor, samples, wins: list):
    """Отпечатки окон [(s, e)] → ndarray [N, D]. Наружу не уходят."""
    import numpy as np

    sr = 16000
    out = []
    for s, e in wins:
        st = extractor.create_stream()
        st.accept_waveform(sr, samples[int(s * sr):int(e * sr)])
        st.input_finished()
        out.append(np.asarray(extractor.compute(st), dtype=np.float32))
    return np.stack(out)


def _phrase_embs(extractor, samples, phrases: list) -> tuple:
    """Отпечатки фраз ≥ MIN_PHRASE_SEC: фраза целиком, а длиннее PHRASE_LONG — среднее
    отпечатков её окон по WIN без перекрытия. Возвращает (индексы фраз, ndarray [M, D]).
    Наружу не уходят."""
    import numpy as np

    idx: list = []
    embs: list = []
    total = len(samples) / 16000.0
    for i, (s, e) in enumerate(phrases):
        e = min(e, total)  # фраза не должна выходить за конец записи
        if e - s < MIN_PHRASE_SEC:
            continue
        parts = windows([(s, e)], WIN, WIN, MIN_WIN) if e - s > PHRASE_LONG else [(s, e)]
        if not parts:
            continue
        v = _unit(_embed(extractor, samples, parts).astype(np.float64)).mean(axis=0)
        idx.append(i)
        embs.append(v)
    return idx, (np.stack(embs) if embs else np.zeros((0, 0)))


def _second_share(durs: dict) -> float:
    """Доля второго по длительности голоса в суммарной речи."""
    total = sum(durs.values())
    if total <= 0 or len(durs) < 2:
        return 0.0
    return sorted(durs.values(), reverse=True)[1] / total


def accept_auto(segs: list) -> bool:
    """Принять результат auto: 2..MAX_SPEAKERS кластеров и доля второго по длительности
    голоса ≥ MIN_SHARE (при 3+ кластерах считаем по второму по длительности)."""
    durs: dict = {}
    for s, e, c in segs:
        durs[c] = durs.get(c, 0.0) + (e - s)
    return 2 <= len(durs) <= MAX_SPEAKERS and _second_share(durs) >= MIN_SHARE


def run(d: Diarizer, samples_16k, phrases: Optional[list] = None) -> tuple:
    """samples_16k — numpy float32 моно 16 кГц. phrases — [(start, end)] фраз распознавания.
    Возвращает ([(start, end, cluster)], path), path: "auto" | "two_way" | "single".
    С phrases в пути two_way центроиды двух голосов считаем по окнам (нарезка внутри
    каждого сегмента auto, границы не пересекаем), затем КАЖДУЮ фразу размечаем по её
    собственному отпечатку и возвращаем сегменты = фразы с метками: короткое «да» между
    длинными репликами врача не склеивается с ними. Без phrases — сегменты-окна."""
    import numpy as np

    samples = np.ascontiguousarray(samples_16k, dtype=np.float32)
    segs = _process(d.auto, samples)
    if accept_auto(segs):
        return segs, "auto"
    # auto дал 1 голос, выброс вместо второго или россыпь: смотрим на окна по речи
    regions = _spans(segs)
    by_phrase = bool(phrases)
    wins = windows([(s, e) for s, e, _ in sorted(segs)] if by_phrase else regions, WIN, HOP, MIN_WIN)
    if len(wins) < MIN_WINDOWS:
        return segs, "auto"
    labels, cos, cents, mean = two_way_full(_embed(d.extractor, samples, wins))
    if cos >= SINGLE_COS:
        return [(s, e, 0) for s, e in regions], "single"
    if by_phrase and cents is not None:
        idx, embs = _phrase_embs(d.extractor, samples, phrases)
        if idx:
            got = label_by_centroids(embs, cents, mean)
            lab: list = [None] * len(phrases)
            for i, g in zip(idx, got):
                lab[i] = g
            # короткие фразы (< MIN_PHRASE_SEC) остаются None: «не определён» честнее чужой роли
            return [(s, e, l) for (s, e), l in zip(phrases, lab)], "two_way"
    return [(s, e, int(c)) for (s, e), c in zip(wins, labels)], "two_way"


def reliability(labels: list, phrases: list) -> str:
    """"unreliable", если суммарная длительность размеченных фраз ≥ MIN_JUDGE_SEC (длину
    записи не берём: паузы и тишина доли голосов не показывают) и второй голос — выброс:
    его доля речи < MIN_SHARE или фраз < MIN_MINOR_PHRASES. Иначе "ok".
    phrases — [(start, end)]."""
    durs: dict = {}
    cnt: dict = {}
    for lab, (s, e) in zip(labels, phrases):
        if lab is None:
            continue
        durs[lab] = durs.get(lab, 0.0) + max(e - s, 0.0)
        cnt[lab] = cnt.get(lab, 0) + 1
    if len(durs) < 2 or sum(durs.values()) < MIN_JUDGE_SEC:
        return "ok"
    second = sorted(durs, key=lambda k: durs[k], reverse=True)[1]
    if _second_share(durs) < MIN_SHARE or cnt[second] < MIN_MINOR_PHRASES:
        return "unreliable"
    return "ok"


def minor_share(labels: list, phrases: list) -> float:
    """Доля второго по длительности голоса (для журнала)."""
    durs: dict = {}
    for lab, (s, e) in zip(labels, phrases):
        if lab is not None:
            durs[lab] = durs.get(lab, 0.0) + max(e - s, 0.0)
    return _second_share(durs)


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
