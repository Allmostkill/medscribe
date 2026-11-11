#!/bin/sh
# Пересобирает значки ярлыка (medscribe.icns, medscribe.ico, medscribe.png) из public/favicon.svg.
# Нужен macOS: qlmanage, sips, iconutil (встроенные) и python3 (для сборки .ico).
# Использование: sh scripts/icons/make-icons.sh [папка-для-результата]   (по умолчанию scripts/icons)
set -eu
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="${1:-$root/scripts/icons}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$out" "$work/png" "$work/medscribe.iconset"

# SVG -> PNG 1024 (прозрачные углы сохраняются)
qlmanage -t -s 1024 -o "$work" "$root/public/favicon.svg" >/dev/null 2>&1
[ -f "$work/favicon.svg.png" ] || { echo "qlmanage не создал PNG" >&2; exit 1; }
for sz in 16 32 48 64 128 256 512 1024; do
  sips -z "$sz" "$sz" "$work/favicon.svg.png" --out "$work/png/$sz.png" >/dev/null
done

# .icns: набор размеров для iconutil
i="$work/medscribe.iconset"
cp "$work/png/16.png" "$i/icon_16x16.png";     cp "$work/png/32.png" "$i/icon_16x16@2x.png"
cp "$work/png/32.png" "$i/icon_32x32.png";     cp "$work/png/64.png" "$i/icon_32x32@2x.png"
cp "$work/png/128.png" "$i/icon_128x128.png";  cp "$work/png/256.png" "$i/icon_128x128@2x.png"
cp "$work/png/256.png" "$i/icon_256x256.png";  cp "$work/png/512.png" "$i/icon_256x256@2x.png"
cp "$work/png/512.png" "$i/icon_512x512.png";  cp "$work/png/1024.png" "$i/icon_512x512@2x.png"
iconutil -c icns "$i" -o "$out/medscribe.icns"

# .png для Linux
cp "$work/png/256.png" "$out/medscribe.png"

# .ico (Windows): PNG внутри контейнера ICO, размеры 16-256
python3 - "$work/png" "$out/medscribe.ico" <<'PYEOF'
import struct, sys
src, dst = sys.argv[1], sys.argv[2]
sizes = [16, 32, 48, 64, 128, 256]
imgs = [open('%s/%d.png' % (src, s), 'rb').read() for s in sizes]
head = struct.pack('<HHH', 0, 1, len(sizes))
off = 6 + 16 * len(sizes)
entries = b''
data = b''
for s, d in zip(sizes, imgs):
    side = s if s < 256 else 0
    entries += struct.pack('<BBBBHHII', side, side, 0, 0, 1, 32, len(d), off + len(data))
    data += d
open(dst, 'wb').write(head + entries + data)
PYEOF
echo "Значки готовы: $out"
