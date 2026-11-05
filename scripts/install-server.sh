#!/bin/sh
# Установка MedScribe на сервер с собственным доменом и HTTPS (Linux):
#   curl -fsSL https://raw.githubusercontent.com/Allmostkill/medscribe/main/scripts/install-server.sh | sh
# Спрашивает домен и почту (или берёт MEDSCRIBE_DOMAIN и ACME_EMAIL из окружения), проверяет
# порты 80 и 443 и запускает основной установщик в серверном режиме: Caddy сам получит сертификат.
# Весь код лежит в функциях, а запуск - последняя строка: оборванная загрузка ничего не выполнит.
set -eu

main() {
  RELEASES="https://github.com/Allmostkill/medscribe/releases/latest/download"
  dir="${MEDSCRIBE_DIR:-$HOME/medscribe}"
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/medscribe-server.XXXXXX")"
  trap cleanup EXIT
  trap 'exit 130' INT TERM HUP

  # Порядок: спросить домен и почту, проверить DNS и порты, запустить основной установщик
  # в серверном режиме (он поставит Caddy и включит HTTPS), дождаться сайта, показать ссылку и
  # совет про файрвол, и только потом показать прогресс загрузки модели речи (его можно прервать
  # по Ctrl+C: к этому моменту ссылка и советы уже напечатаны).
  # Ничего не удаляется и файрвол не меняется: только совет.
  [ "$(uname -s)" = "Linux" ] || fail "Серверная установка работает только на Linux. На своём компьютере используйте обычную установку (install.sh)."

  ask_domain
  ask_email
  check_dns
  check_ports
  find_installer

  say ""
  say "Запускаю установку для $domain..."
  MEDSCRIBE_DIR="$dir" MEDSCRIBE_SERVER=1 MEDSCRIBE_DOMAIN="$domain" ACME_EMAIL="$email" \
    MEDSCRIBE_NO_BROWSER=1 MEDSCRIBE_NO_PROGRESS=1 sh "$installer" </dev/null

  wait_https
  print_link
  advise
  model_progress
}

say() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
fail() { warn "ОШИБКА: $*"; exit 1; }

cleanup() {
  if [ -n "${tmp:-}" ] && [ -d "$tmp" ]; then rm -rf "$tmp"; fi
}

# читает ответ с клавиатуры даже когда скрипт запущен через curl | sh
prompt() {
  if ( : </dev/tty ) 2>/dev/null; then
    printf '%s' "$1" >/dev/tty
    IFS= read -r answer </dev/tty || answer=""
    printf '%s' "$answer"
  fi
}

ask_domain() {
  domain="${MEDSCRIBE_DOMAIN:-}"
  if [ -z "$domain" ]; then
    domain="$(prompt 'Домен сайта (например med.example.com): ')"
  fi
  [ -n "$domain" ] || fail "Не указан домен. Задайте его: MEDSCRIBE_DOMAIN=med.example.com (в начале команды запуска, перед sh)."
  domain="$(printf '%s' "$domain" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  if printf '%s' "$domain" | LC_ALL=C grep -q '[^ -~]'; then
    fail "Домен нужно писать латиницей. Для домена в зоне .рф используйте punycode (xn--...): его показывает регистратор домена."
  fi
  if [ "$domain" != "localhost" ]; then
    printf '%s' "$domain" | grep -Eq '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$' \
      || fail "Некорректный домен: $domain. Пример: med.example.com"
  fi
}

ask_email() {
  email="${ACME_EMAIL:-}"
  if [ -z "$email" ]; then
    email="$(prompt 'Почта для сертификата (Let'"'"'s Encrypt пришлёт на неё напоминания): ')"
  fi
  [ -n "$email" ] || fail "Не указана почта. Задайте её: ACME_EMAIL=name@example.com (в начале команды запуска, перед sh)."
  printf '%s' "$email" | grep -Eq '^[^[:space:]"@]+@[^[:space:]"@]+\.[^[:space:]"@]+$' \
    || fail "Некорректная почта: $email"
}

check_dns() {
  [ "$domain" != "localhost" ] || return 0
  if ! command -v getent >/dev/null 2>&1 || [ -z "$(getent hosts "$domain" 2>/dev/null || true)" ]; then
    warn "Внимание: домен $domain пока не указывает ни на один адрес (или это нельзя проверить)."
    warn "Создайте у регистратора запись A на IP этого сервера. Пока её нет, сертификат не выдадут."
  fi
}

# слушает ли что-то порт $1 на этом сервере
port_busy() {
  command -v ss >/dev/null 2>&1 || return 1
  ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"
}

# наш ли Caddy держит порт (повторный запуск установки)
port_is_ours() {
  command -v docker >/dev/null 2>&1 || return 1
  project="${COMPOSE_PROJECT_NAME:-}"
  if [ -z "$project" ] && [ -f "$dir/.env" ]; then
    project="$(sed -n 's/^[[:space:]]*COMPOSE_PROJECT_NAME=//p' "$dir/.env" | tail -n 1 | tr -d '\r"'"'"'[:space:]')"
  fi
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null </dev/null \
    | grep -E "^${project:-medscribe}-caddy-" | grep -Eq ":$1->"
}

check_ports() {
  for p in 80 443; do
    if port_busy "$p" && ! port_is_ours "$p"; then
      fail "Порт $p на этом сервере уже занят другой программой (например, nginx или apache). Caddy нужны порты 80 и 443: остановите её или настройте HTTPS вручную (инструкция, раздел «HTTPS»). Ничего не изменено."
    fi
  done
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

find_installer() {
  # для проверок: готовый установщик из файла
  if [ -n "${MEDSCRIBE_INSTALLER_FILE:-}" ]; then
    [ -f "$MEDSCRIBE_INSTALLER_FILE" ] || fail "Не найден установщик: $MEDSCRIBE_INSTALLER_FILE"
    installer="$MEDSCRIBE_INSTALLER_FILE"
    return 0
  fi
  # рядом лежащий install.sh берём только если запущен именно файл install-server.sh;
  # при curl | sh ($0 равен sh) всегда скачиваем
  if [ -f "$0" ] && [ "$(basename "$0")" = "install-server.sh" ]; then
    here="$(cd "$(dirname "$0")" && pwd)"
    if [ -f "$here/install.sh" ]; then
      installer="$here/install.sh"
      return 0
    fi
  fi
  # установщик берём из релиза и сверяем с контрольной суммой из того же релиза
  installer="$tmp/install.sh"
  curl -fsSL --proto '=https' --tlsv1.2 -o "$installer" "$RELEASES/install.sh" </dev/null \
    || fail "Не удалось скачать установщик. Проверьте интернет и повторите."
  curl -fsSL --proto '=https' --tlsv1.2 -o "$installer.sha256" "$RELEASES/install.sh.sha256" </dev/null \
    || fail "Не удалось скачать контрольную сумму установщика. Проверьте интернет и повторите."
  want="$(cut -d' ' -f1 < "$installer.sha256" | head -n 1)"
  have="$(sha256_of "$installer")"
  if [ -z "$want" ] || [ "$want" != "$have" ]; then
    fail "Контрольная сумма установщика не совпала: файл повреждён или подменён. Установка остановлена, ничего не изменено."
  fi
}

wait_https() {
  say ""
  say "Жду, пока сайт откроется по HTTPS (сертификат выдаётся до 2 минут)..."
  limit=$(( $(date +%s) + 120 ))
  while [ "$(date +%s)" -lt "$limit" ]; do
    if curl -fsS --max-time 5 "https://$domain/api/health" >/dev/null 2>&1 </dev/null; then
      say "Сайт отвечает: https://$domain"
      return 0
    fi
    sleep 5
  done
  warn "Сайт пока не открывается по HTTPS. Обычно причина одна из трёх:"
  warn "  - запись A домена $domain ещё не указывает на этот сервер;"
  warn "  - порты 80 и 443 закрыты файрволом;"
  warn "  - сертификат ещё выдаётся. Журнал Caddy: cd $dir && docker compose logs --tail 30 caddy"
  warn "Программа при этом запущена, повторите проверку позже."
}

# спрашивает у программы, нужен ли первый вход (до 3 попыток); печатает needs / done / unknown
setup_state() {
  n=0
  while [ "$n" -lt 3 ]; do
    body="$(curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT/api/setup/status" 2>/dev/null </dev/null || true)"
    case "$body" in
      *'"needsSetup":true'*) printf 'needs'; return 0 ;;
      *'"needsSetup":false'*) printf 'done'; return 0 ;;
    esac
    n=$(( n + 1 ))
    sleep 2
  done
  printf 'unknown'
}

print_link() {
  APP_PORT="${APP_PORT:-}"
  [ -n "$APP_PORT" ] || APP_PORT="$(sed -n 's/^[[:space:]]*APP_PORT=//p' "$dir/.env" 2>/dev/null | tail -n 1 | tr -d '\r"'"'"'[:space:]')"
  case "$APP_PORT" in ''|*[!0-9]*) APP_PORT=3000 ;; esac
  token=""
  if [ "$(setup_state)" = "needs" ]; then
    token="$( (cd "$dir" && docker compose logs --no-log-prefix --no-color app 2>/dev/null </dev/null) \
      | grep -Eo 'setup#token=[A-Z0-9-]+' | tail -n 1 || true)"
  fi
  say ""
  if [ -n "$token" ]; then
    say "Первый вход (создайте аккаунт врача): https://$domain/$token"
    say "Ссылка с кодом работает до создания аккаунта. Никому её не передавайте."
  else
    say "Откройте: https://$domain/"
  fi
}

advise() {
  say ""
  say "Файрвол мы не меняли. Если сайт недоступен снаружи, откройте порты 80 и 443, например:"
  say "  sudo ufw allow 80/tcp && sudo ufw allow 443/tcp"
  say "Порт приложения 3000 наружу не публикуется (только 127.0.0.1)."
  say "Обновление: $dir/scripts/update.sh"
}

# прогресс загрузки модели речи; Ctrl+C безопасен: установка идёт в фоне
model_progress() {
  trap 'exit 0' INT
  MEDSCRIBE_DIR="$dir" MEDSCRIBE_PROGRESS_ONLY=1 sh "$installer" </dev/null || true
  trap 'exit 130' INT
}

main "$@"
