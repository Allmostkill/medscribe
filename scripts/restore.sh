#!/usr/bin/env bash
# Восстановление MedScribe из копии.
#   scripts/restore.sh <файл.dump>            - вернуть базу (текущие данные будут заменены)
#   scripts/restore.sh --secrets <файл.tar>   - вернуть ключи на НОВОМ компьютере, до первого запуска
set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
  echo "Использование:" >&2
  echo "  scripts/restore.sh <файл.dump>" >&2
  echo "  scripts/restore.sh --secrets <файл.tar>" >&2
  exit 1
}

[ -f docker-compose.yml ] || { echo "Не найден docker-compose.yml. Запускайте скрипт из папки программы." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Не найден docker. Установите и запустите Docker." >&2; exit 1; }
[ $# -ge 1 ] || usage

# имя проекта compose: из окружения, иначе из строки COMPOSE_PROJECT_NAME= в .env, иначе medscribe
project="${COMPOSE_PROJECT_NAME:-}"
if [ -z "$project" ] && [ -f .env ]; then
  project="$(grep -E '^[[:space:]]*COMPOSE_PROJECT_NAME=' .env | tail -n 1 | cut -d= -f2- | tr -d '\r"'"'"'[:space:]' || true)"
fi
project="${project:-medscribe}"

if [ "$1" = "--secrets" ]; then
  [ $# -eq 2 ] || usage
  file="$2"
  [ -s "$file" ] || { echo "Файл не найден или пустой: $file" >&2; exit 1; }
  existing="$(docker compose run --rm --no-deps -T --entrypoint sh init -c 'ls -A /app/secrets' </dev/null)" || {
    echo "Не удалось проверить каталог ключей. Docker запущен? Проверьте: docker compose ps" >&2
    exit 1
  }
  if [ -n "$existing" ]; then
    echo "Отказ: на этом компьютере уже есть ключи MedScribe (каталог секретов не пуст)." >&2
    echo "Ключи восстанавливаются только на новом компьютере, до первого запуска:" >&2
    echo "иначе новые ключи не подойдут к уже созданной базе, и данные станут нечитаемыми." >&2
    exit 1
  fi
  if docker volume inspect "$project"_pgdata > /dev/null 2>&1; then
    echo "Отказ: на этом компьютере уже есть база MedScribe (хранилище ${project}_pgdata)." >&2
    echo "Ключи восстанавливаются только на новом компьютере, до первого запуска." >&2
    exit 1
  fi
  tar -tf "$file" > /dev/null 2>&1 || { echo "Архив повреждён или это не файл ключей: $file" >&2; exit 1; }
  docker compose run --rm --no-deps -T --entrypoint tar init -C /app/secrets -xf - < "$file"
  echo "Ключи восстановлены. Дальше: docker compose up -d, затем scripts/restore.sh <файл.dump>"
  exit 0
fi

[ $# -eq 1 ] || usage
file="$1"
[ -s "$file" ] || { echo "Файл не найден или пустой: $file" >&2; exit 1; }
docker compose exec -T postgres true > /dev/null 2>&1 </dev/null || {
  echo "База не запущена. Выполните: docker compose up -d, подождите минуту и повторите." >&2
  exit 1
}
if ! docker compose exec -T postgres pg_restore --list < "$file" > /dev/null; then
  echo "Файл не читается как копия базы: $file" >&2
  exit 1
fi

echo "ВНИМАНИЕ. Текущая база MedScribe (аккаунт, протоколы, черновики) будет"
echo "ПОЛНОСТЬЮ заменена содержимым файла:"
echo "  $file"
echo "Отменить это нельзя. Если сомневаетесь, сначала сделайте копию: scripts/backup.sh"
printf 'Чтобы продолжить, введите слово ВОССТАНОВИТЬ: '
read -r answer || answer=""
if [ "$answer" != "ВОССТАНОВИТЬ" ]; then
  echo "Отменено, ничего не изменено."
  exit 0
fi

if ! docker compose exec -T postgres pg_restore -U postgres -d medscribe --clean --if-exists --single-transaction < "$file"; then
  echo "Восстановление не удалось, база осталась прежней (операция выполняется целиком или не выполняется)." >&2
  exit 1
fi
echo "База восстановлена. Чтобы применить возможные обновления схемы: docker compose up -d"
