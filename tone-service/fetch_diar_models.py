"""
Скачивает модели разметки по голосу в образ tone (только stdlib).

  python fetch_diar_models.py --out /opt/diar [--base URL]

Файлы проверяются по sha256; несовпадение — ошибка сборки. Из архива сегментации
берём только model.onnx и LICENSE (MIT, © 2022 CNRS — лицензия должна ехать с моделью).
"""

import argparse
import hashlib
import os
import shutil
import sys
import tarfile
import tempfile
import time
import urllib.request

DEFAULT_BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download"

SEG_PATH = "speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2"
SEG_SHA = "24615ee884c897d9d2ba09bb4d30da6bb1b15e685065962db5b02e76e4996488"
EMB_PATH = "speaker-recongition-models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx"
EMB_SHA = "357a834f702b80161e5b981182c038e18553c1f2ca752ed6cec2052365d4129b"

ATTEMPTS = 3


def download(url: str, dest: str, sha256: str) -> None:
    last = ""
    for attempt in range(1, ATTEMPTS + 1):
        try:
            h = hashlib.sha256()
            with urllib.request.urlopen(url, timeout=120) as r, open(dest, "wb") as f:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    h.update(chunk)
                    f.write(chunk)
            if h.hexdigest() == sha256:
                return
            last = "sha256 mismatch"
        except Exception as e:  # noqa: BLE001
            last = type(e).__name__
        print(f"attempt {attempt}/{ATTEMPTS} failed for {url}: {last}", file=sys.stderr)
        time.sleep(2 * attempt)
    raise SystemExit(f"failed to fetch {url}: {last}")


def extract_member(tar: tarfile.TarFile, suffix: str, dest: str) -> None:
    """Достаёт ровно один обычный файл по имени (без распаковки путей архива)."""
    for m in tar.getmembers():
        parts = m.name.split("/")
        if m.isfile() and parts[-1] == suffix and ".." not in parts and not m.name.startswith("/"):
            src = tar.extractfile(m)
            if src is None:
                break
            with src, open(dest, "wb") as f:
                shutil.copyfileobj(src, f)
            return
    raise SystemExit(f"{suffix} not found in archive")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    base = a.base.rstrip("/")
    os.makedirs(a.out, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        arc = os.path.join(tmp, "seg.tar.bz2")
        download(f"{base}/{SEG_PATH}", arc, SEG_SHA)
        with tarfile.open(arc, "r:bz2") as tar:
            extract_member(tar, "model.onnx", os.path.join(a.out, "segmentation.onnx"))
            extract_member(tar, "LICENSE", os.path.join(a.out, "LICENSE-pyannote-segmentation-3.0"))

    download(f"{base}/{EMB_PATH}", os.path.join(a.out, "embedding.onnx"), EMB_SHA)
    print("models ready:", sorted(os.listdir(a.out)))


if __name__ == "__main__":
    main()
