#!/usr/bin/env bash
# Резервная копия MedScribe: дамп базы + секреты (ключ шифрования).
# Использование: scripts/backup.sh [папка]   (по умолчанию ~/medscribe-backup)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f docker-compose.yml ] || { echo "Не найден docker-compose.yml. Запускайте скрипт из папки программы." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Не найден docker. Установите и запустите Docker." >&2; exit 1; }

umask 077
dir="${1:-$HOME/medscribe-backup}"
# папка копий доступна только владельцу; чужую существующую папку (свой путь) не трогаем
if [ -n "${1:-}" ] && [ -d "$dir" ]; then :; else mkdir -p "$dir"; chmod 700 "$dir"; fi
stamp="$(date +%F_%H%M%S)"
dump="$dir/medscribe-$stamp.dump"
secrets="$dir/medscribe-secrets-$stamp.tar"

# существующие копии не перезаписываем
for f in "$dump" "$secrets"; do
  [ ! -e "$f" ] || { echo "Файл уже существует: $f. Подождите секунду и повторите." >&2; exit 1; }
done

ok=0
created=()
cleanup() {
  if [ "$ok" -ne 1 ]; then
    # удаляем только то, что создал этот запуск
    [ "${#created[@]}" -eq 0 ] || rm -f "${created[@]}"
    echo "Копия не сделана, неполные файлы удалены." >&2
  fi
}
trap cleanup EXIT

echo "Делаю копию базы..."
created+=("$dump")
if ! docker compose exec -T postgres pg_dump -U postgres -d medscribe -Fc </dev/null > "$dump"; then
  echo "Не удалось снять копию базы. Программа запущена? Проверьте: docker compose ps" >&2
  exit 1
fi
[ -s "$dump" ] || { echo "Файл копии базы пустой." >&2; exit 1; }
if ! docker compose exec -T postgres pg_restore --list < "$dump" > /dev/null; then
  echo "Копия базы повреждена: она не читается." >&2
  exit 1
fi

echo "Делаю копию ключей (секретов)..."
created+=("$secrets")
if ! docker compose exec -T app tar -C /app/secrets -cf - . </dev/null > "$secrets"; then
  echo "Не удалось снять копию ключей. Программа запущена? Проверьте: docker compose ps" >&2
  exit 1
fi
[ -s "$secrets" ] || { echo "Файл копии ключей пустой." >&2; exit 1; }
tar -tf "$secrets" > /dev/null 2>&1 || { echo "Копия ключей повреждена: архив не читается." >&2; exit 1; }

chmod 600 "$dump" "$secrets"

ok=1
echo
echo "Готово. Файлы:"
echo "  база:  $dump"
echo "  ключи: $secrets"
echo
echo "Без файла с ключами протоколы из базы прочитать нельзя. Храните файл ключей"
echo "(medscribe-secrets-*.tar) ОТДЕЛЬНО от копии базы (medscribe-*.dump), например на"
echo "разных носителях, или зашифруйте: у кого есть оба файла, тот прочитает протоколы."
echo "Не публикуйте их и не отправляйте в облако без шифрования."
