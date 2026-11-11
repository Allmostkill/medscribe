#!/usr/bin/env bash
# Собирает пакет релиза: medscribe-bundle.tar.gz + medscribe-bundle.tar.gz.sha256.
# Использование: scripts/release/make-bundle.sh <версия> <папка-для-результата>
# Пример:        scripts/release/make-bundle.sh 0.2.0 out
#
# Закрепление образов по дайджесту (для выпуска): ссылки ghcr.io/allmostkill/...:<тег>
# в compose-файлах пакета получают @sha256:<дайджест>. Режимы:
#   MEDSCRIBE_DIGESTS_FILE=<файл>  строки «ссылка дайджест» (ссылка с тегом, без дайджеста)
#   MEDSCRIBE_PIN_DIGESTS=1        дайджесты берутся у опубликованных образов (docker buildx imagetools)
# Нет дайджеста для какой-то ссылки в этом режиме - сборка падает. Без режима ничего не меняется.
set -euo pipefail
cd "$(dirname "$0")/../.."

[ $# -eq 2 ] || { echo "Использование: scripts/release/make-bundle.sh <версия> <папка>" >&2; exit 1; }
version="$1"
out="$2"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || {
  echo "Версия должна быть вида 1.2.3 или 1.2.3-rc.1: $version" >&2
  exit 1
}

files=(
  docker-compose.yml docker-compose.server.yml Caddyfile .env.example
  db/migrate.sh
  scripts/backup.sh scripts/restore.sh scripts/update.sh scripts/open.sh scripts/open.ps1
  scripts/diagnose.sh scripts/diagnose.ps1
  LICENSE NOTICE DISCLAIMER.md
)
for f in "${files[@]}" db/initdb/10-roles.sh db/initdb/20-schema.sql db/migrations scripts/icons; do
  [ -e "$f" ] || { echo "Нет файла для пакета: $f" >&2; exit 1; }
done

mkdir -p "$out"
out="$(cd "$out" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
dir="$work/medscribe-bundle"
mkdir -p "$dir/db/initdb" "$dir/db/migrations" "$dir/scripts/icons"

for f in "${files[@]}"; do
  cp "$f" "$dir/$f"
done
cp db/initdb/10-roles.sh db/initdb/20-schema.sql "$dir/db/initdb/"
# README в миграциях тоже копируем: он описывает формат имён
cp db/migrations/* "$dir/db/migrations/"
# значки ярлыка (macOS, Linux, Windows)
cp scripts/icons/medscribe.* "$dir/scripts/icons/"

# теги наших образов: main -> версия
sed -E "s#(ghcr\.io/allmostkill/medscribe-(app|tone)):main#\1:${version}#" docker-compose.yml > "$dir/docker-compose.yml"
if grep -q ':main' "$dir/docker-compose.yml"; then
  echo "В docker-compose.yml пакета остался тег :main:" >&2
  grep -n ':main' "$dir/docker-compose.yml" >&2
  exit 1
fi

# закрепление по дайджесту (необязательное)
digests_file="${MEDSCRIBE_DIGESTS_FILE:-}"
if [ -n "$digests_file" ] || [ "${MEDSCRIBE_PIN_DIGESTS:-}" = "1" ]; then
  [ -z "$digests_file" ] || [ -f "$digests_file" ] || { echo "Нет файла дайджестов: $digests_file" >&2; exit 1; }

  lookup_digest() {
    local ref="$1" digest=""
    if [ -n "$digests_file" ]; then
      digest="$(awk -v ref="$ref" '$1 == ref { print $2; exit }' "$digests_file")"
    else
      digest="$(docker buildx imagetools inspect "$ref" --format '{{.Manifest.Digest}}')" || digest=""
    fi
    [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || {
      echo "Не найден дайджест для $ref (получено: '${digest}')" >&2
      return 1
    }
    printf '%s\n' "$digest"
  }

  for compose in docker-compose.yml docker-compose.server.yml; do
    refs="$(grep -oE 'image:[[:space:]]*ghcr\.io/allmostkill/[^[:space:]@]+([[:space:]]|$)' "$dir/$compose" | sed -E 's/^image:[[:space:]]*//; s/[[:space:]]+$//' | sort -u || true)"
    for ref in $refs; do
      digest="$(lookup_digest "$ref")" || exit 1
      esc="$(printf '%s' "$ref" | sed 's/[][\.*^$#/]/\\&/g')"
      sed -E "s#^([[:space:]]*image:[[:space:]]*)${esc}([[:space:]]*)\$#\1${ref}@${digest}\2#" "$dir/$compose" > "$dir/$compose.new"
      mv "$dir/$compose.new" "$dir/$compose"
    done
    if grep -E 'image:[[:space:]]*ghcr\.io/allmostkill/' "$dir/$compose" | grep -vq '@sha256:'; then
      echo "В $compose пакета остались образы без дайджеста:" >&2
      grep -E 'image:[[:space:]]*ghcr\.io/allmostkill/' "$dir/$compose" | grep -v '@sha256:' >&2
      exit 1
    fi
  done
fi

printf '%s\n' "$version" > "$dir/VERSION"

archive="$out/medscribe-bundle.tar.gz"
tar -C "$work" -czf "$archive" medscribe-bundle
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$out" && sha256sum medscribe-bundle.tar.gz > medscribe-bundle.tar.gz.sha256)
else
  (cd "$out" && shasum -a 256 medscribe-bundle.tar.gz > medscribe-bundle.tar.gz.sha256)
fi

echo "Пакет $version готов:"
echo "  $archive"
echo "  $archive.sha256"
