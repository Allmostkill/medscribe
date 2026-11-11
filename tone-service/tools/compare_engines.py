#!/usr/bin/env python3
"""Сравнение движков tone-сервиса на одном файле (stdlib only).

Запуск: python3 compare_engines.py <tone_url> <audio> <out_dir>
  tone_url — адрес сервиса, например http://127.0.0.1:5001
  audio    — любой файл, который понимает ffmpeg (wav/webm/…)
  out_dir  — сюда пишутся response_tone.json и response_gigaam.json (для eval_diarization.py)

Шлёт файл в /transcribe?engine=tone и ?engine=gigaam, печатает время, число символов,
фраз, diarization, engine и engine_fallback. Текст в консоль не выводится.
"""
import json
import os
import sys
import time
import urllib.request


def call(base: str, engine: str, data: bytes) -> tuple:
    req = urllib.request.Request(
        f"{base.rstrip('/')}/transcribe?engine={engine}", data=data,
        headers={"Content-Type": "application/octet-stream"},
    )
    t0 = time.monotonic()
    with urllib.request.urlopen(req, timeout=1800) as r:
        body = r.read()
    return json.loads(body), time.monotonic() - t0


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 0
    base, audio, out_dir = sys.argv[1:]
    with open(audio, "rb") as f:
        data = f.read()
    os.makedirs(out_dir, exist_ok=True)
    print(f"{'engine':<8} {'req_s':>7} {'audio_s':>8} {'chars':>6} {'phrases':>7} "
          f"{'diarization':<11} {'got':<7} fallback")
    for engine in ("tone", "gigaam"):
        resp, took = call(base, engine, data)
        with open(os.path.join(out_dir, f"response_{engine}.json"), "w", encoding="utf-8") as f:
            json.dump(resp, f, ensure_ascii=False)
        print(f"{engine:<8} {took:7.1f} {resp.get('duration_sec', 0):8.1f} "
              f"{len(resp.get('text') or ''):6d} {len(resp.get('phrases') or []):7d} "
              f"{str(resp.get('diarization')):<11} {str(resp.get('engine')):<7} "
              f"{resp.get('engine_fallback')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
