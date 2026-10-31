#!/usr/bin/env python3
"""Оценка точности разметки по голосу (stdlib only).

Запуск: python3 eval_diarization.py truth.json response.json
  truth.json    — эталон от make_test_dialog.sh: [{"start","end","speaker":"A"|"B"|"C"}]
  response.json — ответ tone POST /transcribe: {"phrases":[{"start","end","text","speaker"}],"diarization":"ok",...}

Как получить response.json со стенда (контейнер tone запущен, том моделей не трогаем):
  docker compose cp <out_dir>/dialog.wav tone:/tmp/dialog.wav
  docker compose exec -T tone python3 -c "
  import urllib.request
  r = urllib.request.Request('http://127.0.0.1:5001/transcribe',
      data=open('/tmp/dialog.wav','rb').read(), headers={'Content-Type': 'application/octet-stream'})
  print(urllib.request.urlopen(r, timeout=300).read().decode())" > response.json
(формат тела запроса — как у текущего /transcribe в tone-service/app.py; если он другой, повторить его.)

Для каждой фразы настоящий говорящий — тот, чья реплика из эталона перекрывается с ней сильнее всего.
Кластер сопоставляется говорящему по большинству (по длительности). Выводит число найденных
голосов, долю длительности фраз с верной меткой и таблицу путаницы. Код выхода всегда 0.
"""
import json
import sys
from collections import defaultdict


def overlap(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 0
    with open(sys.argv[1], encoding="utf-8") as f:
        truth = json.load(f)
    with open(sys.argv[2], encoding="utf-8") as f:
        resp = json.load(f)

    status = resp.get("diarization")
    phrases = resp.get("phrases") or []
    print(f"diarization: {status}, фраз: {len(phrases)}")

    # weights[кластер][настоящий говорящий] = суммарная длительность фраз
    weights = defaultdict(lambda: defaultdict(float))
    items = []  # (длительность, кластер, настоящий)
    for p in phrases:
        s, e = float(p["start"]), float(p["end"])
        by_spk = defaultdict(float)
        for t in truth:
            by_spk[t["speaker"]] += overlap(s, e, float(t["start"]), float(t["end"]))
        real = max(by_spk, key=by_spk.get) if by_spk and max(by_spk.values()) > 0 else None
        cl = p.get("speaker")
        dur = max(0.0, e - s)
        items.append((dur, cl, real))
        if real is not None:
            weights[cl][real] += dur

    clusters = sorted((c for c in weights if c is not None), key=lambda c: (c is None, c))
    print(f"голосов найдено: {len(clusters)}, настоящих: {len({t['speaker'] for t in truth})}")

    # кластер -> говорящий по большинству
    mapping = {c: max(weights[c], key=weights[c].get) for c in clusters}

    total = ok = 0.0
    for dur, cl, real in items:
        if real is None:
            continue
        total += dur
        if cl is not None and mapping.get(cl) == real:
            ok += dur
    share = (ok / total * 100) if total else 0.0
    print(f"верно по длительности: {share:.1f}% ({ok:.1f} из {total:.1f} с)")

    real_spk = sorted({r for _, _, r in items if r is not None})
    print("\nПутаница (секунды): строки — кластер, столбцы — настоящий говорящий")
    print("кластер".ljust(10) + "".join(str(r).rjust(8) for r in real_spk) + "   -> сопоставлен")
    for c in clusters + ([None] if None in weights else []):
        row = "".join(f"{weights[c].get(r, 0.0):8.1f}" for r in real_spk)
        label = "нет" if c is None else str(c)
        print(label.ljust(10) + row + "   -> " + str(mapping.get(c, "-")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
