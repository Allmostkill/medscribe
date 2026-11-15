#!/bin/sh
# Только чтение. Отчёт по разрешённым полям, без выгрузки журналов, .env и данных врача.
# sh scripts/diagnose.sh [папка установки]; ничего не отправляет в интернет.
set -eu
dir="${1:-$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)}"
[ -d "$dir" ] || { printf '%s\n' 'Папка программы не найдена.' >&2; exit 1; }
PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$HOME/.docker/bin"
export PATH
umask 077
scratch="$(mktemp -d "${TMPDIR:-/tmp}/medscribe-diagnostic.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT
report="$(mktemp "$dir/medscribe-diagnostic.XXXXXX")"
mv "$report" "$report.txt"
report="$report.txt"

# Ограничиваем ожидание Docker. Его stderr и произвольные строки никогда не попадают в отчёт.
limited() {
  "$@" >"$scratch/out" 2>/dev/null </dev/null &
  task_pid=$!
  ticks=0
  while kill -0 "$task_pid" 2>/dev/null; do
    ticks=$(( ticks + 1 ))
    if [ "$ticks" -gt 10 ]; then
      kill "$task_pid" 2>/dev/null || true
      wait "$task_pid" 2>/dev/null || true
      return 1
    fi
    sleep 1
  done
  wait "$task_pid" || return 1
  cat "$scratch/out"
}

cd "$dir"
{
  printf '%s\n' 'MedScribe diagnostic v1'
  printf 'time_utc=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  case "$(uname -s)" in Darwin) echo 'os=macOS' ;; Linux) echo 'os=Linux' ;; *) echo 'os=unknown' ;; esac
  case "$(uname -m)" in arm64|aarch64) echo 'arch=arm64' ;; x86_64|amd64) echo 'arch=amd64' ;; *) echo 'arch=unknown' ;; esac
  version=unknown
  if [ -f VERSION ]; then
    candidate="$(cat VERSION)"
    if printf '%s\n' "$candidate" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' && [ "$(printf '%s\n' "$candidate" | wc -l | tr -d ' ')" = 1 ]; then version="$candidate"; fi
  fi
  printf 'version=%s\n' "$version"
  if command -v docker >/dev/null 2>&1; then
    echo 'docker_cli=present'
    engine_ready=0
    if limited docker info --format '{{.OSType}}' >/dev/null; then engine_ready=1; echo 'docker_engine=reachable'; else echo 'docker_engine=unreachable'; fi
    for service in app tone postgres migrate; do
      state=unknown
      if [ "$engine_ready" -eq 1 ]; then state="$(limited docker compose ps -a --format '{{.State}}' "$service" || true)"; fi
      case "$state" in running|exited|created|restarting|paused|dead) ;; *) state=unknown ;; esac
      printf 'service_%s=%s\n' "$service" "$state"
    done
  else
    echo 'docker_cli=missing'
    echo 'docker_engine=unknown'
  fi
  # Только числовой порт. Ни адрес провайдера, ни его ключ не читаются.
  port="${APP_PORT:-}"
  if [ -z "$port" ] && [ -f .env ]; then
    port="$(sed -n 's/^[[:space:]]*APP_PORT=//p' .env | tail -n 1 | tr -d '\r"'"'"'[:space:]')"
  fi
  case "$port" in ''|*[!0-9]*) port=3000 ;; esac
  if [ "${#port}" -gt 5 ] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then port=3000; fi
  body="$(curl --noproxy '*' -fsS --max-time 5 "http://127.0.0.1:$port/api/health" 2>/dev/null || true)"
  for field in db tone llm; do
    value=unknown
    if printf '%s' "$body" | grep -Eq "\"$field\"[[:space:]]*:[[:space:]]*true([[:space:],}]|$)"; then value=true
    elif printf '%s' "$body" | grep -Eq "\"$field\"[[:space:]]*:[[:space:]]*false([[:space:],}]|$)"; then value=false; fi
    printf 'health_%s=%s\n' "$field" "$value"
  done
  echo 'health_llm means configured, not a successful provider test.'
} >"$report"
printf 'Диагностика сохранена: %s (в папке программы)\n' "$(basename "$report")"
printf '%s\n' 'Откройте файл и проверьте содержимое перед отправкой. Отчёт не отправлен автоматически.'
printf '%s\n' 'Сообщить о проблеме: https://github.com/Allmostkill/medscribe/issues/new?template=bug_report.md'
