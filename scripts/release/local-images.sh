#!/usr/bin/env bash
# Готовит образы на этом компьютере без публикации: для проверки установщика.
# Использование: scripts/release/local-images.sh <тег>     (например 0.2.0-local)
# Собирает ghcr.io/allmostkill/medscribe-{app,tone}:<тег> и кладёт под эти же имена
# сторонние образы из scripts/release/third-party-images.txt.
set -euo pipefail
cd "$(dirname "$0")/../.."

[ $# -eq 1 ] || { echo "Использование: scripts/release/local-images.sh <тег>" >&2; exit 1; }
tag="$1"
registry="ghcr.io/allmostkill"
command -v docker >/dev/null 2>&1 || { echo "Не найден docker." >&2; exit 1; }

docker build -t "$registry/medscribe-app:$tag" .
docker build -t "$registry/medscribe-tone:$tag" tone-service

while read -r source target; do
  case "$source" in ''|'#'*) continue ;; esac
  [ -n "${target:-}" ] || { echo "Строка без цели в third-party-images.txt: $source" >&2; exit 1; }
  # Docker Hub из России недоступен: официальные образы берём с зеркала
  pull="${source/#docker.io\/library\//mirror.gcr.io/library/}"
  docker pull "$pull"
  docker tag "$pull" "$registry/$target"
done < scripts/release/third-party-images.txt

echo "Готово: образы с тегом $tag и сторонние образы лежат локально."
