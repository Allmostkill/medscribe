#!/usr/bin/env bash
# Обновление MedScribe: копия -> новая версия -> запуск -> ожидание готовности.
# Использование: scripts/update.sh [--build]
#   --build  только для установки из git: собрать образы из исходников вместо загрузки готовых.
# Установка через установщик (есть файл .medscribe-install) обновляется самим установщиком.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

[ -f docker-compose.yml ] || { echo "Не найден docker-compose.yml. Запускайте скрипт из папки программы." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Не найден docker. Установите и запустите Docker." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "Не найден curl." >&2; exit 1; }

build=0
case "${1:-}" in
  "") ;;
  --build) build=1 ;;
  *) echo "Использование: scripts/update.sh [--build]" >&2; exit 1 ;;
esac

# Установка установщиком: он сам делает копию (если версия новая), ставит файлы и запускает программу
if [ -f .medscribe-install ]; then
  tmp="$(mktemp)"
  trap 'rm -f "$tmp" "$tmp.sha256"' EXIT
  if [ -n "${MEDSCRIBE_INSTALLER_FILE:-}" ]; then
    cp "$MEDSCRIBE_INSTALLER_FILE" "$tmp"
  else
    base=https://github.com/Allmostkill/medscribe/releases/latest/download
    curl -fsSL --proto '=https' --tlsv1.2 -o "$tmp" "$base/install.sh" \
      || { echo "Не удалось скачать установщик. Проверьте интернет. Ничего не изменено." >&2; exit 1; }
    curl -fsSL --proto '=https' --tlsv1.2 -o "$tmp.sha256" "$base/install.sh.sha256" \
      || { echo "Не удалось скачать контрольную сумму установщика. Проверьте интернет. Ничего не изменено." >&2; exit 1; }
    want="$(cut -d' ' -f1 < "$tmp.sha256" | head -n 1)"
    if command -v sha256sum >/dev/null 2>&1; then have="$(sha256sum "$tmp" | cut -d' ' -f1)"; else have="$(shasum -a 256 "$tmp" | cut -d' ' -f1)"; fi
    if [ -z "$want" ] || [ "$want" != "$have" ]; then
      echo "Контрольная сумма установщика не совпала: файл повреждён или подменён. Обновление остановлено, ничего не изменено." >&2
      exit 1
    fi
  fi
  MEDSCRIBE_DIR="$PWD" MEDSCRIBE_UPDATE=1 sh "$tmp"
  exit $?
fi

# Ни git, ни установщика: папка скачана архивом (ZIP)
if [ ! -d .git ]; then
  echo "Эта папка скачана архивом (ZIP), обновить её автоматически нельзя."
  echo "Поставьте новую версию через установщик (одна строка из инструкции, раздел «Установка»)."
  echo "Ваши данные хранятся в Docker и сохранятся."
  exit 0
fi

if [ -d .git ] && ! git symbolic-ref -q HEAD >/dev/null 2>&1; then
  echo "Сейчас открыта не ветка, а отдельная версия (после git checkout). Вернитесь на основную ветку: git checkout main — и запустите обновление снова." >&2
  echo "Ничего не изменено." >&2
  exit 1
fi

if [ -d .git ] && ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  echo "Эта папка не привязана к GitHub (нет удалённого репозитория), поэтому обновить её автоматически нельзя." >&2
  echo "Вероятно, программа установлена не клонированием с GitHub. Что делать: см. инструкцию, раздел «Обновление»." >&2
  echo "Ничего не изменено." >&2
  exit 1
fi

echo "Шаг 1. Резервная копия перед обновлением."
if ! bash "$SCRIPT_DIR/backup.sh"; then
  echo "Без свежей копии обновлять нельзя. Обновление остановлено, ничего не изменено." >&2
  exit 1
fi

echo
echo "Шаг 2. Загрузка новой версии."
git pull --ff-only

echo
if [ "$build" -eq 1 ]; then
  echo "Шаг 3. Сборка из исходников и запуск."
  docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
else
  echo "Шаг 3. Загрузка образов и запуск."
  docker compose pull
  docker compose up -d
fi

# порт: из окружения, иначе из строки APP_PORT= в .env (файл целиком не подключаем), иначе 3000
port="${APP_PORT:-}"
if [ -z "$port" ] && [ -f .env ]; then
  port="$(grep -E '^[[:space:]]*APP_PORT=' .env | tail -n 1 | cut -d= -f2- | tr -d '\r"'"'"'[:space:]' || true)"
fi
case "$port" in ''|*[!0-9]*) port=3000 ;; esac

echo
echo "Шаг 4. Жду, пока программа будет готова (до 5 минут)..."
url="http://127.0.0.1:$port/api/health"
deadline=$(( $(date +%s) + 300 ))
body=""
while [ "$(date +%s)" -lt "$deadline" ]; do
  if body="$(curl -fsS --max-time 5 "$url" 2>/dev/null)" && printf '%s' "$body" | grep -q '"db":true'; then
    break
  fi
  body=""
  sleep 5
done

if [ -z "$body" ]; then
  echo "Программа не ответила за 5 минут. Посмотрите, что происходит: docker compose logs --tail 50 app" >&2
  echo "Данные не затронуты, копия сделана на шаге 1." >&2
  exit 1
fi

word() { printf '%s' "$body" | grep -q "\"$1\":true" && echo "$2" || echo "$3"; }
echo
echo "Обновление завершено. Состояние:"
echo "  база данных:       $(word db 'работает' 'НЕ отвечает')"
echo "  распознавание речи: $(word tone 'готово' 'ещё загружается (первый раз до 20 минут) или не работает')"
echo "  языковая модель:   $(word llm 'подключена' 'не подключена: Профиль → Настройки ИИ')"
echo "Откройте http://localhost:$port"
