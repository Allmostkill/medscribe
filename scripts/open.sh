#!/bin/sh
# Открывает MedScribe одним действием (его зовёт ярлык на рабочем столе, можно и вручную):
# запускает Docker Desktop, если он выключен, поднимает остановленные контейнеры программы
# (ничего не скачивая и не собирая), ждёт ответа и открывает программу в браузере.
# Использование: sh scripts/open.sh [папка-установки]   (по умолчанию - папка выше scripts/)
# Переменные (необязательные): APP_PORT, MEDSCRIBE_NO_BROWSER=1 (не открывать браузер),
#   MEDSCRIBE_GUI=1 (показывать уведомления и окно ошибки; ставят ярлыки).
set -eu

WAIT_SEC=180

# ярлык запускает нас с урезанным PATH: добавляем места, где живёт docker
PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$HOME/.docker/bin"
export PATH

if [ -n "${1:-}" ]; then
  dir="$1"
else
  dir="$(cd "$(dirname "$0")/.." && pwd)"
fi

info_out="$(mktemp "${TMPDIR:-/tmp}/medscribe-open.XXXXXX")"
trap 'rm -f "$info_out"' EXIT

say() { printf '%s\n' "$*"; }
now() { date +%s; }

# короткое уведомление (только из ярлыка); в терминале - просто строка
notify() {
  say "$1"
  [ "${MEDSCRIBE_GUI:-}" = "1" ] || return 0
  # на macOS уведомления просят разрешение системы: там прогресс - значок программы в Dock
  if [ "$(uname -s)" = "Darwin" ]; then
    return 0
  elif command -v notify-send >/dev/null 2>&1; then
    notify-send "MedScribe" "$1" >/dev/null 2>&1 || true
  fi
}

# ошибка: текст в stderr (на macOS его покажет окно ярлыка), на Linux из ярлыка - окно
fail() {
  printf '%s\n' "$*" >&2
  if [ "${MEDSCRIBE_GUI:-}" = "1" ] && [ "$(uname -s)" != "Darwin" ]; then
    if command -v zenity >/dev/null 2>&1; then
      zenity --error --title=MedScribe --no-markup --text="$*" >/dev/null 2>&1 || true
    elif command -v kdialog >/dev/null 2>&1; then
      kdialog --title MedScribe --error "$*" >/dev/null 2>&1 || true
    elif command -v notify-send >/dev/null 2>&1; then
      notify-send -u critical "MedScribe" "$*" >/dev/null 2>&1 || true
    fi
  fi
  exit 1
}

# значение ключа из .env установки (без кавычек и пробелов); пусто, если нет
env_get() {
  [ -f "$dir/.env" ] || return 0
  sed -n "s/^[[:space:]]*$1=//p" "$dir/.env" | tail -n 1 | tr -d '\r"'"'"'[:space:]'
}

# /api/health отвечает 200 и без базы: готовой считаем программу, когда в ответе "db":true
health_ok() {
  hb="$(curl -fsS --max-time 3 "http://127.0.0.1:$port/api/health" 2>/dev/null </dev/null || true)"
  case "$hb" in
    *'"db":true'*) return 0 ;;
  esac
  return 1
}

# docker info с ограничением 10 секунд: зависший Docker Desktop не должен молча вешать ярлык
docker_ok() {
  docker info >"$info_out" 2>&1 </dev/null &
  dpid=$!
  n=0
  while kill -0 "$dpid" 2>/dev/null; do
    n=$(( n + 1 ))
    if [ "$n" -gt 10 ]; then
      kill "$dpid" 2>/dev/null || true
      wait "$dpid" 2>/dev/null || true
      return 1
    fi
    sleep 1
  done
  wait "$dpid"
}

wait_docker() {
  limit=$(( $(now) + WAIT_SEC ))
  while [ "$(now)" -lt "$limit" ]; do
    if docker_ok; then return 0; fi
    sleep 3
  done
  return 1
}

wait_app() {
  limit=$(( $(now) + WAIT_SEC ))
  while [ "$(now)" -lt "$limit" ]; do
    if health_ok; then return 0; fi
    sleep 3
  done
  return 1
}

# адрес для браузера: до создания первой учётной записи нужна ссылка с кодом из журнала
# (как find_open_url в install.sh). У /api/setup/status лимит 60 запросов за 15 минут: запросов мало.
first_run_url() {
  needs=""
  tries=0
  while [ "$tries" -lt 3 ]; do
    st="$(curl -fsS --max-time 5 "http://127.0.0.1:$port/api/setup/status" 2>/dev/null </dev/null || true)"
    case "$st" in
      *'"needsSetup":true'*) needs=yes; break ;;
      *'"needsSetup":false'*) needs=no; break ;;
    esac
    tries=$(( tries + 1 ))
    sleep 3
  done
  if [ "$needs" != "yes" ]; then
    printf '%s' "$url"
    return 0
  fi
  # код появляется в журнале не сразу: ждём до минуты
  limit=$(( $(now) + 60 ))
  token=""
  while [ "$(now)" -lt "$limit" ]; do
    token="$(docker compose logs --no-log-prefix --no-color app 2>/dev/null </dev/null \
      | grep -Eo 'setup#token=[A-Z0-9-]+' | tail -n 1 || true)"
    [ -z "$token" ] || break
    sleep 3
  done
  if [ -n "$token" ]; then printf '%s%s' "$url" "$token"; else printf '%ssetup' "$url"; fi
}

open_url() {
  [ "${MEDSCRIBE_NO_BROWSER:-}" != "1" ] || return 0
  if [ "$(uname -s)" = "Darwin" ]; then
    open "$1" >/dev/null 2>&1 || fail "Не получилось открыть браузер. Откройте вручную: $1"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 || fail "Не получилось открыть браузер. Откройте вручную: $1"
  else
    fail "Не получилось открыть браузер. Откройте вручную: $1"
  fi
}

[ -f "$dir/docker-compose.yml" ] || fail "Не найдена папка программы MedScribe ($dir). Запустите установку заново."
cd "$dir"

port="${APP_PORT:-}"
[ -n "$port" ] || port="$(env_get APP_PORT)"
case "$port" in ''|*[!0-9]*) port=3000 ;; esac
url="http://localhost:$port/"

# уже работает: сразу открываем
if command -v curl >/dev/null 2>&1 && health_ok; then
  open_url "$(first_run_url)"
  exit 0
fi
command -v curl >/dev/null 2>&1 || fail "Не найдена программа curl. Установите её и повторите."

command -v docker >/dev/null 2>&1 \
  || fail "Не найден Docker. Установите Docker Desktop (https://www.docker.com/products/docker-desktop/), запустите его и откройте MedScribe снова."

if ! docker_ok; then
  if [ "$(uname -s)" = "Darwin" ]; then
    notify "Запускаю Docker Desktop, это может занять до 3 минут"
    open -a Docker >/dev/null 2>&1 || fail "Не удалось запустить Docker Desktop. Откройте его вручную и запустите MedScribe снова."
    wait_docker || fail "Docker не запустился за 3 минуты. Дождитесь, пока Docker Desktop полностью загрузится, и откройте MedScribe снова."
  elif grep -qi "permission denied" "$info_out" 2>/dev/null; then
    fail "Нет доступа к Docker. Добавьте себя в группу docker: sudo usermod -aG docker \$USER, выйдите из системы, войдите снова и откройте MedScribe."
  elif [ -d /opt/docker-desktop ]; then
    fail "Docker Desktop не запущен. Запустите его (systemctl --user start docker-desktop или из меню приложений), дождитесь готовности и откройте MedScribe снова."
  else
    fail "Docker не запущен. Запустите его (sudo systemctl start docker) и откройте MedScribe снова."
  fi
fi

notify "Запускаю MedScribe, это около минуты"
# без скачивания: нужны только уже установленные образы
if ! out="$(docker compose up -d --pull never 2>&1 </dev/null)"; then
  case "$out" in
    *"port is already allocated"*|*"address already in use"*|*"Bind for"*|*"Ports are not available"*)
      fail "Порт $port занят другой программой. Закройте её или поставьте другой порт (см. инструкцию) и откройте MedScribe снова." ;;
    *"No such image"*|*"pull access denied"*)
      fail "Не найдены файлы программы в Docker (возможно, их удалили). Запустите команду установки из инструкции ещё раз: это безопасно, ваши данные сохранятся." ;;
    *)
      fail "Не удалось запустить MedScribe. Если Docker только что запустился, подождите минуту и повторите. Подробности: docker compose logs --tail 50 (в папке $dir)." ;;
  esac
fi

wait_app || fail "MedScribe не ответил за 3 минуты. Подождите минуту и откройте его снова. Если не помогает: docker compose logs --tail 50 app (в папке $dir)."
open_url "$(first_run_url)"
