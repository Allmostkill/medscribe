#!/bin/sh
# Установщик MedScribe для macOS и Linux:
#   curl -fsSL https://raw.githubusercontent.com/Allmostkill/medscribe/main/scripts/install.sh | sh
# Проверяет компьютер, скачивает готовую программу, запускает её и открывает браузер.
# Безопасно запускать повторно: данные не удаляются. Переменные окружения (необязательные):
#   MEDSCRIBE_DIR, MEDSCRIBE_VERSION, MEDSCRIBE_BUNDLE_FILE, MEDSCRIBE_NO_PULL=1,
#   MEDSCRIBE_NO_BROWSER=1, MEDSCRIBE_NO_SHORTCUT=1 (не создавать ярлык MedScribe),
#   MEDSCRIBE_SKIP_MEMORY_CHECK=1, MEDSCRIBE_SKIP_DISK_CHECK=1, MEDSCRIBE_UPDATE=1,
#   MEDSCRIBE_NO_PROGRESS=1 (не показывать прогресс модели речи), MEDSCRIBE_PROGRESS_ONLY=1 (только прогресс),
#   MEDSCRIBE_SERVER=1 + MEDSCRIBE_DOMAIN + ACME_EMAIL, APP_PORT, COMPOSE_PROJECT_NAME.
# Весь код лежит в функциях, а запуск - последняя строка: оборванная загрузка ничего не выполнит.
set -eu

main() {
  RELEASES="https://github.com/Allmostkill/medscribe/releases"
  RAW="https://raw.githubusercontent.com/Allmostkill/medscribe/main"
  MIN_MEMORY=8053063680
  # размер распакованной модели речи (du -sk /models на готовом томе), КБ
  MODEL_EXPECTED_KB=5476632
  MODEL_WAIT_SEC=7200

  tmp=""
  dir=""
  port=3000
  server=0
  domain=""
  steps_total=6
  shortcut=""
  shortcut_note=""
  shortcut_short=""

  dir="${MEDSCRIBE_DIR:-$HOME/medscribe}"
  trap cleanup EXIT
  trap 'exit 130' INT TERM HUP
  if [ "${MEDSCRIBE_PROGRESS_ONLY:-}" = "1" ]; then
    progress_only
    return 0
  fi
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/medscribe.XXXXXX")"

  step 1 "Проверяю компьютер и Docker"
  check_platform
  check_options
  check_docker

  step 2 "Готовлю папку и скачиваю пакет"
  check_dir
  check_disk
  fetch_bundle
  old_version=""
  if [ -f "$dir/.medscribe-install" ]; then
    old_version="$(sed -n 's/^version=//p' "$dir/.medscribe-install" | head -n 1 | tr -d '\r')"
    if [ "$(sed -n 's/^mode=//p' "$dir/.medscribe-install" | head -n 1 | tr -d '\r')" = "server" ]; then server=1; fi
  fi
  if [ "$server" = "1" ]; then
    domain="${MEDSCRIBE_DOMAIN:-}"
    [ -n "$domain" ] || domain="$(env_get MEDSCRIBE_DOMAIN)"
  fi

  step 3 "Устанавливаю файлы"
  if [ -n "$old_version" ] && [ "$old_version" != "$new_version" ]; then
    cd "$dir"
    if docker volume inspect "$(project_name)_pgdata" >/dev/null 2>&1 </dev/null; then
      backup_before_update
    fi
  elif [ -z "$old_version" ] && docker volume inspect "$(project_name)_pgdata" >/dev/null 2>&1 </dev/null; then
    backup_foreign_data
  fi
  mkdir -p "$dir"
  install_files
  cd "$dir"
  say "Файлы установлены в $dir"
  if [ "${caddy_kept:-0}" = "1" ]; then
    warn "Внимание: ваш Caddyfile изменён вручную, поэтому я его не заменил. Новая версия лежит рядом: $dir/Caddyfile.new. Сравните файлы и при желании замените: mv Caddyfile.new Caddyfile"
  fi

  step 4 "Скачиваю образы программы"
  pull_images

  step 5 "Запускаю программу"
  start_app

  step 6 "Открываю MedScribe"
  find_open_url
  create_shortcut
  open_browser
  if [ "${MEDSCRIBE_UPDATE:-}" != "1" ] && [ "${MEDSCRIBE_NO_PROGRESS:-}" != "1" ]; then
    show_model_progress
  fi
  final_summary
}

say() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
fail() { warn "ОШИБКА: $*"; exit 1; }
step() { printf '\nШаг %s из %s. %s\n' "$1" "$steps_total" "$2"; }
now() { date +%s; }

cleanup() {
  if [ -n "$tmp" ] && [ -d "$tmp" ]; then rm -rf "$tmp"; fi
}

on_interrupt() {
  printf '\n'
  say "Установка продолжится в фоне. Чтобы снова увидеть прогресс и ссылку, запустите ту же команду ещё раз."
  exit 0
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# значение ключа из .env установки (без кавычек и пробелов); пусто, если нет
env_get() {
  [ -f "$dir/.env" ] || return 0
  sed -n "s/^[[:space:]]*$1=//p" "$dir/.env" | tail -n 1 | tr -d '\r"'"'"'[:space:]'
}

# заменяет строку KEY="значение" в .env (остальные строки сохраняются), права 600
env_set() {
  f="$dir/.env"
  t="$f.new"
  (
    umask 077
    if [ -f "$f" ]; then
      grep -v "^[[:space:]]*$1=" "$f" > "$t" || true
    else
      : > "$t"
    fi
    printf '%s="%s"\n' "$1" "$2" >> "$t"
  )
  mv "$t" "$f"
  chmod 600 "$f"
}

project_name() {
  p="${COMPOSE_PROJECT_NAME:-}"
  [ -n "$p" ] || p="$(env_get COMPOSE_PROJECT_NAME)"
  printf '%s' "${p:-medscribe}"
}

dc() { docker compose "$@" </dev/null; }

health_body() { curl -fsS --max-time 3 "http://127.0.0.1:$port/api/health" 2>/dev/null || true; }

check_platform() {
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin|Linux) ;;
    *) fail "Этот установщик работает на macOS и Linux. Для Windows используйте install.ps1 (см. инструкцию)." ;;
  esac
  case "$arch" in
    x86_64|amd64|arm64|aarch64) ;;
    *) fail "Процессор $arch не поддерживается. Нужен x86_64 или arm64." ;;
  esac
  for c in curl tar; do
    command -v "$c" >/dev/null 2>&1 || fail "Не найдена программа $c. Установите её и повторите."
  done
  if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
    fail "Не найдена программа для проверки контрольной суммы (sha256sum или shasum)."
  fi
  say "Компьютер подходит: $os, $arch."
}

wait_docker() {
  limit=$(( $(now) + 180 ))
  while [ "$(now)" -lt "$limit" ]; do
    if docker info >/dev/null 2>&1 </dev/null; then return 0; fi
    printf '.'
    sleep 3
  done
  printf '\n'
  return 1
}

# Docker Desktop (память задаётся в его настройках) или обычный Docker Engine на Linux
is_docker_desktop() {
  [ "$(uname -s)" = "Darwin" ] && return 0
  os_name="$(docker info --format '{{.OperatingSystem}}' 2>/dev/null </dev/null || true)"
  case "$os_name" in
    *"Docker Desktop"*) return 0 ;;
  esac
  return 1
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker не установлен. Установите Docker Desktop (https://www.docker.com/products/docker-desktop/), запустите его и повторите команду."
  fi
  if ! docker info >/dev/null 2>&1 </dev/null; then
    info_out="$(docker info 2>&1 </dev/null || true)"
    case "$info_out" in
      *"permission denied"*)
        fail "Нет доступа к Docker. Добавьте себя в группу docker: sudo usermod -aG docker \$USER, выйдите из системы и войдите снова."
        ;;
    esac
    if [ "$(uname -s)" = "Darwin" ]; then
      say "Docker Desktop не запущен. Запускаю (до 3 минут)..."
      open -a Docker >/dev/null 2>&1 || fail "Не удалось запустить Docker Desktop. Откройте его вручную и повторите команду."
      wait_docker || fail "Docker не запустился за 3 минуты. Дождитесь зелёного значка Docker Desktop и повторите команду."
      printf '\n'
    else
      fail "Docker не запущен. Запустите его (sudo systemctl start docker) и повторите команду."
    fi
  fi
  say "Docker работает."

  cv="$(docker compose version --short 2>/dev/null </dev/null || true)"
  cv="${cv#v}"
  cmajor="${cv%%.*}"
  crest="${cv#*.}"
  cminor="${crest%%.*}"
  case "$cmajor$cminor" in
    ''|*[!0-9]*) fail "Не найден Docker Compose. Обновите Docker Desktop до последней версии." ;;
  esac
  if [ "$cmajor" -lt 2 ] || { [ "$cmajor" -eq 2 ] && [ "$cminor" -lt 24 ]; }; then
    fail "Docker Compose $cv слишком старый (нужен 2.24 или новее). Обновите Docker Desktop."
  fi

  if [ "${MEDSCRIBE_SKIP_MEMORY_CHECK:-}" != "1" ]; then
    mem="$(docker info --format '{{.MemTotal}}' 2>/dev/null </dev/null || true)"
    case "$mem" in
      ''|*[!0-9]*) ;;
      *)
        if [ "$mem" -lt "$MIN_MEMORY" ]; then
          if is_docker_desktop; then
            fail "Docker выделено мало памяти ($(( mem / 1048576 )) МБ, нужно не меньше 8 ГБ). Откройте Docker Desktop: Settings → Resources → Memory, поставьте 8 ГБ или больше, нажмите Apply and restart и повторите команду. Проверку можно обойти: MEDSCRIBE_SKIP_MEMORY_CHECK=1."
          fi
          fail "На сервере нужно не меньше 8 ГБ оперативной памяти (сейчас доступно $(( mem / 1048576 )) МБ). Добавьте памяти серверу и повторите команду. Проверку можно обойти: MEDSCRIBE_SKIP_MEMORY_CHECK=1."
        fi
        ;;
    esac
  fi
}

# Свободное место (КБ) на диске, где лежит путь; пусто, если измерить не удалось.
free_kb_of() {
  LC_ALL=C df -Pk "$1" 2>/dev/null </dev/null | awk 'NR==2 {print $4}'
}

# Ничего не создаём: меряем ближайшую существующую папку. Хранилище образов и модели речи
# (около 15 ГБ) лежит в Docker, поэтому на Linux блокирует только его каталог, а у Docker Desktop
# (виртуальный диск в неизвестном месте) нехватка места - лишь предупреждение.
check_disk() {
  if [ "${MEDSCRIBE_SKIP_DISK_CHECK:-}" = "1" ]; then
    say "Проверка свободного места пропущена (MEDSCRIBE_SKIP_DISK_CHECK=1)."
    return 0
  fi
  disk_path="$dir"
  while [ ! -d "$disk_path" ]; do
    disk_parent="$(dirname "$disk_path")"
    [ "$disk_parent" != "$disk_path" ] || break
    disk_path="$disk_parent"
  done
  prog_kb="$(free_kb_of "$disk_path")"
  case "$prog_kb" in *[!0-9]*) prog_kb="" ;; esac
  first=1
  [ ! -f "$dir/.medscribe-install" ] || first=0

  if is_docker_desktop; then
    if [ -z "$prog_kb" ]; then
      warn "Не удалось проверить свободное место. Для первой установки нужно около 15 ГБ: проверьте лимит диска в Docker Desktop (Settings → Resources)."
    elif [ "$first" -eq 1 ] && [ "$prog_kb" -lt 15728640 ]; then
      warn "На диске программы свободно $(( prog_kb / 1048576 )) ГБ, для первой установки нужно около 15 ГБ. Проверьте свободное место и лимит диска в Docker Desktop (Settings → Resources). Если места не хватит, установка остановится с ошибкой, ваши данные не пострадают. Проверку можно отключить: MEDSCRIBE_SKIP_DISK_CHECK=1."
    elif [ "$first" -eq 0 ] && [ "$prog_kb" -lt 5242880 ]; then
      warn "Свободно меньше 5 ГБ. Для обновления и резервной копии может не хватить места; освободите место перед продолжением."
    else
      say "На диске программы свободно $(( prog_kb / 1048576 )) ГБ."
    fi
    return 0
  fi

  # Docker Engine: образы и том модели лежат в его корневом каталоге, он может быть на другом диске.
  root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null </dev/null || true)"
  docker_kb=""
  case "$root" in
    /*) docker_kb="$(free_kb_of "$root")" ;;
  esac
  case "$docker_kb" in *[!0-9]*) docker_kb="" ;; esac
  if [ -z "$docker_kb" ]; then
    warn "Не удалось проверить свободное место в хранилище Docker. Для первой установки в нём нужно не меньше 15 ГБ."
  elif [ "$first" -eq 1 ] && [ "$docker_kb" -lt 15728640 ]; then
    fail "В хранилище Docker ($root) свободно $(( docker_kb / 1048576 )) ГБ. Для первой установки нужно не меньше 15 ГБ: там лежат образы и модель речи. Освободите место и запустите ту же команду ещё раз. Данные программы не удаляйте. Проверку можно обойти: MEDSCRIBE_SKIP_DISK_CHECK=1."
  elif [ "$first" -eq 0 ] && [ "$docker_kb" -lt 5242880 ]; then
    warn "В хранилище Docker свободно меньше 5 ГБ. Для обновления и резервной копии может не хватить места; освободите место перед продолжением."
  else
    say "В хранилище Docker свободно $(( docker_kb / 1048576 )) ГБ."
  fi
  if [ -n "$prog_kb" ] && [ "$prog_kb" -lt 1048576 ]; then
    warn "На диске программы свободно меньше 1 ГБ. Освободите место: нужно для файлов программы и резервных копий."
  fi
}

check_options() {
  p="${APP_PORT:-}"
  if [ -n "$p" ]; then
    case "$p" in
      *[!0-9]*) fail "APP_PORT должен быть числом, например 3100." ;;
    esac
    if [ "$p" -lt 1 ] || [ "$p" -gt 65535 ]; then fail "APP_PORT должен быть от 1 до 65535."; fi
  fi
  p="${COMPOSE_PROJECT_NAME:-}"
  if [ -n "$p" ]; then
    printf '%s' "$p" | grep -Eq '^[a-z0-9][a-z0-9_-]*$' \
      || fail "COMPOSE_PROJECT_NAME: допустимы строчные латинские буквы, цифры, - и _."
  fi
  v="${MEDSCRIBE_VERSION:-}"
  if [ -n "$v" ]; then
    v="${v#v}"
    printf '%s' "$v" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' \
      || fail "MEDSCRIBE_VERSION должна быть вида 0.2.0."
    MEDSCRIBE_VERSION="$v"
  fi
  if [ "${MEDSCRIBE_SERVER:-}" = "1" ]; then server=1; fi
}

check_dir() {
  case "$dir" in
    /*) ;;
    *) dir="$PWD/$dir" ;;
  esac
  if [ -e "$dir" ] && [ ! -d "$dir" ]; then
    fail "$dir уже существует и это не папка. Укажите другую: MEDSCRIBE_DIR=..."
  fi
  if [ -d "$dir" ]; then
    if [ -f "$dir/.medscribe-install" ]; then
      return 0
    elif [ -d "$dir/.git" ]; then
      fail "Здесь ручная установка (git). Обновляйте её scripts/update.sh или укажите другую папку MEDSCRIBE_DIR=... Данные общие, ничего не удаляйте."
    elif [ -n "$(ls -A "$dir")" ]; then
      fail "Папка $dir не пустая и это не установка MedScribe. Укажите другую: MEDSCRIBE_DIR=..."
    fi
  fi
}

# скачивает пакет (или берёт локальный), проверяет контрольную сумму, распаковывает в $tmp/x
fetch_bundle() {
  archive="$tmp/medscribe-bundle.tar.gz"
  sums="$archive.sha256"
  if [ -n "${MEDSCRIBE_BUNDLE_FILE:-}" ]; then
    [ -f "$MEDSCRIBE_BUNDLE_FILE" ] || fail "Не найден пакет: $MEDSCRIBE_BUNDLE_FILE"
    [ -f "$MEDSCRIBE_BUNDLE_FILE.sha256" ] || fail "Рядом с пакетом нет файла $MEDSCRIBE_BUNDLE_FILE.sha256"
    cp "$MEDSCRIBE_BUNDLE_FILE" "$archive"
    cp "$MEDSCRIBE_BUNDLE_FILE.sha256" "$sums"
    say "Беру локальный пакет: $MEDSCRIBE_BUNDLE_FILE"
  else
    if [ -n "${MEDSCRIBE_VERSION:-}" ]; then
      base="$RELEASES/download/v$MEDSCRIBE_VERSION"
    else
      base="$RELEASES/latest/download"
    fi
    say "Скачиваю пакет программы..."
    for f in medscribe-bundle.tar.gz medscribe-bundle.tar.gz.sha256; do
      curl -fsSL --proto '=https' --tlsv1.2 -o "$tmp/$f" "$base/$f" </dev/null \
        || fail "Не удалось скачать $base/$f. Проверьте интернет (GitHub из вашей сети может быть недоступен) и повторите."
    done
  fi
  want="$(cut -d' ' -f1 < "$sums" | head -n 1)"
  have="$(sha256_of "$archive")"
  if [ -z "$want" ] || [ "$want" != "$have" ]; then
    fail "Контрольная сумма пакета не совпала: файл повреждён или подменён. Установка остановлена, ничего не изменено."
  fi
  say "Контрольная сумма совпала."

  if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    fail "В пакете недопустимые пути. Установка остановлена."
  fi
  mkdir -p "$tmp/x"
  tar -xzf "$archive" -C "$tmp/x" || fail "Не удалось распаковать пакет."
  bundle="$tmp/x/medscribe-bundle"
  if [ ! -f "$bundle/VERSION" ] || [ ! -f "$bundle/docker-compose.yml" ]; then
    fail "Пакет неполный: нет VERSION или docker-compose.yml."
  fi
  new_version="$(tr -d '\r\n' < "$bundle/VERSION")"
  printf '%s' "$new_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' \
    || fail "В пакете некорректная версия: $new_version"
  say "Версия программы: $new_version"
}

wait_db() {
  limit=$(( $(now) + 300 ))
  while [ "$(now)" -lt "$limit" ]; do
    case "$(health_body)" in
      *'"db":true'*) return 0 ;;
    esac
    sleep 3
  done
  return 1
}

# копия перед обновлением: поднимаем прежнюю версию на её файлах и вызываем её backup.sh
backup_before_update() {
  say "Обновляю другую версию (было $old_version, будет $new_version): сначала сделаю резервную копию."
  [ -f "$dir/scripts/backup.sh" ] || fail "В установке нет scripts/backup.sh. Обновление остановлено, ничего не изменено."
  command -v bash >/dev/null 2>&1 || fail "Не найден bash, нужный для резервной копии. Обновление остановлено, ничего не изменено."
  old_port="${APP_PORT:-}"
  [ -n "$old_port" ] || old_port="$(env_get APP_PORT)"
  case "$old_port" in ''|*[!0-9]*) old_port=3000 ;; esac
  port="$old_port"
  if ! dc up -d --pull never >/dev/null 2>&1; then
    dc up -d >/dev/null 2>&1 || fail "Не удалось запустить прежнюю версию для копии. Обновление остановлено, ничего не изменено."
  fi
  wait_db || fail "Прежняя версия не отвечает, копию сделать нельзя. Обновление остановлено, ничего не изменено."
  if ! bash "$dir/scripts/backup.sh" </dev/null; then
    fail "Резервная копия не сделана. Обновление остановлено, ничего не изменено."
  fi
}

# Том с базой уже есть, а этой папки у установщика нет (git, ZIP или другая папка): прежде чем
# подключать том к новой версии, снимаем копию. Поднимаем только postgres из файлов пакета.
backup_foreign_data() {
  say "В Docker уже есть данные MedScribe от другой установки (git, ZIP или другая папка). Сначала сохраню их копию."
  p="$(project_name)"
  docker volume inspect "${p}_secrets" >/dev/null 2>&1 </dev/null \
    || fail "Есть база (${p}_pgdata), но нет хранилища ключей (${p}_secrets): без ключей протоколы не прочитать. Установка остановлена, ничего не изменено. Проверьте COMPOSE_PROJECT_NAME и напишите автору."
  bdir="$HOME/medscribe-backup"
  stamp="$(date +%F_%H%M%S)"
  dump="$bdir/medscribe-$stamp.dump"
  secrets="$bdir/medscribe-secrets-$stamp.tar"
  (umask 077; mkdir -p "$bdir") || fail "Не удалось создать папку копий $bdir. Установка остановлена, ничего не изменено."
  chmod 700 "$bdir" 2>/dev/null || true
  if [ -e "$dump" ] || [ -e "$secrets" ]; then fail "Файл копии уже существует. Подождите секунду и повторите."; fi
  cd "$bundle"
  pg_started=0
  if [ -z "$(dc ps -q postgres 2>/dev/null || true)" ]; then
    pg_started=1
    pullflag=""
    [ "${MEDSCRIBE_NO_PULL:-}" != "1" ] || pullflag="--pull never"
    # shellcheck disable=SC2086
    dc up -d $pullflag postgres >/dev/null 2>&1 \
      || fail "Не удалось запустить базу, чтобы снять копию. Установка остановлена, ничего не изменено."
  fi
  ok_pg=0
  limit=$(( $(now) + 120 ))
  while [ "$(now)" -lt "$limit" ]; do
    if dc exec -T postgres pg_isready -h 127.0.0.1 -U postgres -d medscribe >/dev/null 2>&1; then ok_pg=1; break; fi
    sleep 3
  done
  foreign_abort() {
    rm -f "$dump" "$secrets"
    [ "$pg_started" -eq 0 ] || dc stop postgres >/dev/null 2>&1 || true
    fail "$1 Установка остановлена, ничего не изменено."
  }
  [ "$ok_pg" -eq 1 ] || foreign_abort "База не отвечает, копию снять нельзя."
  say "Делаю копию базы..."
  # дамп идёт потоком прямо на компьютер: временных файлов в контейнере нет
  (umask 077; dc exec -T postgres pg_dump -U postgres -d medscribe -Fc > "$dump" 2>/dev/null) \
    || foreign_abort "Не удалось снять копию базы."
  [ -s "$dump" ] || foreign_abort "Файл копии базы пустой."
  docker compose exec -T postgres pg_restore --list < "$dump" >/dev/null 2>&1 \
    || foreign_abort "Копия базы повреждена: она не читается."
  chmod 600 "$dump" 2>/dev/null || true
  say "Делаю копию ключей (секретов)..."
  # том ключей подключён к postgres только для чтения: берём архив прямо из него
  (umask 077; dc exec -T postgres tar -C /run/secrets/medscribe -cf - . > "$secrets" 2>/dev/null) \
    || foreign_abort "Не удалось снять копию ключей."
  if [ ! -s "$secrets" ] || ! tar -tf "$secrets" >/dev/null 2>&1; then
    foreign_abort "Копия ключей повреждена или пустая."
  fi
  chmod 600 "$secrets" 2>/dev/null || true
  [ "$pg_started" -eq 0 ] || dc stop postgres >/dev/null 2>&1 || true
  say "Копия сохранена:"
  say "  база:  $dump"
  say "  ключи: $secrets"
  say "Без файла ключей протоколы из базы прочитать нельзя: храните его отдельно от копии базы."
}

install_files() {
  # Caddyfile решаем отдельно и не копируем вместе с пакетом: правки пользователя не должны
  # пропасть, даже если установку прервут. Файл пользователя заменяется только целиком (mv)
  # и только если он совпадает с поставленным ранее.
  caddy_kept=0
  newcaddy=""
  if [ -f "$bundle/Caddyfile" ]; then
    newcaddy="$tmp/Caddyfile.bundle"
    mv "$bundle/Caddyfile" "$newcaddy"
  fi
  cp -R "$bundle/." "$dir/"
  if [ -n "$newcaddy" ]; then
    mkdir -p "$dir/.medscribe"
    if [ ! -f "$dir/Caddyfile" ]; then
      cp "$newcaddy" "$dir/Caddyfile.tmp" && mv "$dir/Caddyfile.tmp" "$dir/Caddyfile"
      rm -f "$dir/Caddyfile.new"
    elif cmp -s "$dir/Caddyfile" "$newcaddy"; then
      rm -f "$dir/Caddyfile.new"
    elif [ -f "$dir/.medscribe/Caddyfile.dist" ] && cmp -s "$dir/Caddyfile" "$dir/.medscribe/Caddyfile.dist"; then
      # файл не правили: обновляем
      cp "$newcaddy" "$dir/Caddyfile.tmp" && mv "$dir/Caddyfile.tmp" "$dir/Caddyfile"
      rm -f "$dir/Caddyfile.new"
    else
      # файл правили руками (или неизвестно, правили ли): оставляем как есть, новый кладём рядом
      caddy_kept=1
      cp "$newcaddy" "$dir/Caddyfile.new"
    fi
    cp "$newcaddy" "$dir/.medscribe/Caddyfile.dist"
  fi
  chmod +x "$dir"/scripts/*.sh "$dir"/db/migrate.sh "$dir"/db/initdb/*.sh 2>/dev/null || true

  if [ -n "${APP_PORT:-}" ] && [ "$(env_get APP_PORT)" != "$APP_PORT" ]; then
    env_set APP_PORT "$APP_PORT"
  fi
  if [ -n "${COMPOSE_PROJECT_NAME:-}" ] && [ "$(env_get COMPOSE_PROJECT_NAME)" != "$COMPOSE_PROJECT_NAME" ]; then
    env_set COMPOSE_PROJECT_NAME "$COMPOSE_PROJECT_NAME"
  fi

  if [ "$server" = "1" ]; then
    d="${MEDSCRIBE_DOMAIN:-}"
    [ -n "$d" ] || d="$(env_get MEDSCRIBE_DOMAIN)"
    e="${ACME_EMAIL:-}"
    [ -n "$e" ] || e="$(env_get ACME_EMAIL)"
    printf '%s' "$d" | grep -Eq '^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9-]{2,}$|^localhost$' \
      || fail "Для серверного режима нужен домен (MEDSCRIBE_DOMAIN), например med.example.com."
    printf '%s' "$e" | grep -Eq '^[^[:space:]"@]+@[^[:space:]"@]+$' \
      || fail "Для серверного режима нужна почта (ACME_EMAIL) для сертификата."
    domain="$d"
    env_set MEDSCRIBE_DOMAIN "$d"
    env_set ACME_EMAIL "$e"
    env_set PUBLIC_URL "https://$d"
    env_set TRUST_PROXY "true"
    env_set COMPOSE_FILE "docker-compose.yml:docker-compose.server.yml"
  fi
  [ ! -f "$dir/.env" ] || chmod 600 "$dir/.env"

  mode=desktop
  [ "$server" != "1" ] || mode=server
  printf 'version=%s\nmode=%s\n' "$new_version" "$mode" > "$dir/.medscribe-install"

  port="${APP_PORT:-}"
  [ -n "$port" ] || port="$(env_get APP_PORT)"
  case "$port" in ''|*[!0-9]*) port=3000 ;; esac
}

pull_images() {
  if [ "${MEDSCRIBE_NO_PULL:-}" = "1" ]; then
    say "Загрузку образов пропускаю (MEDSCRIBE_NO_PULL=1): беру то, что уже есть на компьютере."
    return 0
  fi
  say "Скачиваю программу (около 1,2 ГБ, можно пока выпить чаю)..."
  dc pull || fail "Не удалось скачать программу. Проверьте интернет (ghcr.io должен открываться) и повторите команду: она продолжит с того же места."
}

start_app() {
  say "Запускаю программу..."
  flags=""
  [ "${MEDSCRIBE_NO_PULL:-}" != "1" ] || flags="--pull never"
  # shellcheck disable=SC2086
  if ! out="$(docker compose up -d $flags 2>&1 </dev/null)"; then
    warn "$out"
    case "$out" in
      *"port is already allocated"*|*"address already in use"*|*"Bind for"*)
        warn ""
        case "$out" in
          *":$port "*|*":$port:"*|*":$port/"*|*":$port,"*)
            warn "Порт $port занят другой программой. Выберите другой порт и повторите:"
            warn "  curl -fsSL $RAW/scripts/install.sh | APP_PORT=3100 sh"
            ;;
          *)
            warn "Нужный порт занят другой программой (он указан в сообщении выше). Освободите его и повторите команду."
            ;;
        esac
        ;;
      *"dependency failed"*|*"exited"*)
        warn ""
        warn "Одна из служб не запустилась. Подробности: docker compose logs --tail 50 migrate postgres app"
        ;;
    esac
    fail "Не удалось запустить программу."
  fi
  say "Жду, пока запустится база данных (до 5 минут)..."
  wait_db || fail "Программа не ответила за 5 минут. Посмотрите, что происходит: docker compose logs --tail 50 app"
  say "База данных готова."
}

# адрес для браузера: ссылка первого запуска с кодом или обычный вход
find_open_url() {
  if [ "$server" = "1" ]; then base="https://$domain"; else base="http://localhost:$port"; fi
  needs=""
  tries=0
  # один запрос на попытку: у /api/setup/status лимит 60 запросов за 15 минут
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
    open_url="$base/"
    return 0
  fi
  limit=$(( $(now) + 60 ))
  token=""
  while [ "$(now)" -lt "$limit" ]; do
    token="$(docker compose logs --no-log-prefix --no-color app 2>/dev/null </dev/null \
      | grep -Eo 'setup#token=[A-Z0-9-]+' | tail -n 1 || true)"
    [ -z "$token" ] || break
    sleep 3
  done
  if [ -n "$token" ]; then
    open_url="$base/$token"
  else
    open_url="$base/setup"
    warn "Код первого запуска пока не появился в журнале. Если страница его попросит: docker compose logs app"
  fi
}

# Ярлык MedScribe: на macOS - программа-обёртка ~/Applications/MedScribe.app (osacompile; на рабочий стол
# не пишем: это вызывает системный запрос доступа), на Linux - файл .desktop (меню и рабочий стол).
# Он зовёт scripts/open.sh. Папки для проверок можно подменить: MEDSCRIBE_DESKTOP_DIR, MEDSCRIBE_APPS_DIR.
# При обновлении (MEDSCRIBE_UPDATE=1) ярлык только обновляется, удалённый врачом не возвращается.
# Чужой файл с тем же именем не трогаем.
create_shortcut() {
  shortcut=""
  shortcut_note=""
  shortcut_short=""
  if [ "$server" = "1" ] || [ "${MEDSCRIBE_NO_SHORTCUT:-}" = "1" ]; then return 0; fi
  nl="$(printf '\n.')"
  nl="${nl%.}"
  case "$dir" in
    *"$nl"*) warn "В пути к папке установки есть перевод строки: ярлык не создаю."; return 0 ;;
  esac
  [ -f "$dir/scripts/open.sh" ] || return 0
  case "$(uname -s)" in
    Darwin) shortcut_fn=shortcut_mac ;;
    *) shortcut_fn=shortcut_linux ;;
  esac
  if ! "$shortcut_fn"; then
    shortcut=""
    warn "Ярлык создать не получилось, на работу программы это не влияет. Открывать её можно скриптом $dir/scripts/open.sh или по адресу http://localhost:$port/"
  fi
}

shortcut_mac() {
  command -v osacompile >/dev/null 2>&1 || return 1
  apps="${MEDSCRIBE_APPS_DIR:-$HOME/Applications}"
  app="$apps/MedScribe.app"
  if [ -e "$app" ]; then
    # наше приложение помечено ключом MedScribeInstallDir. Это только метка владельца: PlistBuddy
    # убирает кавычки и обратные черты, поэтому значение с путём не сравниваем
    if ! /usr/libexec/PlistBuddy -c "Print :MedScribeInstallDir" "$app/Contents/Info.plist" >/dev/null 2>&1; then
      warn "В $apps уже лежит MedScribe.app, созданное не установщиком: не трогаю, ярлык не обновлён."
      return 0
    fi
  elif [ "${MEDSCRIBE_UPDATE:-}" = "1" ]; then
    return 0
  fi
  esc="$(printf '%s' "$dir/scripts/open.sh" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  # ошибки скрипта (stderr) показываем окном: врачу терминал не нужен
  cat > "$tmp/MedScribe.applescript" <<EOF
on run
  try
    with timeout of 600 seconds
      do shell script "MEDSCRIBE_GUI=1 /bin/sh " & quoted form of "$esc"
    end timeout
  on error errMsg
    display dialog errMsg with title "MedScribe" buttons {"OK"} default button "OK" with icon stop
  end try
end run
EOF
  rm -rf "$tmp/MedScribe.app"
  osacompile -o "$tmp/MedScribe.app" "$tmp/MedScribe.applescript" >/dev/null 2>&1 || return 1
  plist="$tmp/MedScribe.app/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :MedScribeInstallDir string $dir" "$plist" >/dev/null 2>&1 || return 1
  if [ -f "$dir/scripts/icons/medscribe.icns" ]; then
    # иконка из Assets.car перебивает applet.icns: убираем её
    cp "$dir/scripts/icons/medscribe.icns" "$tmp/MedScribe.app/Contents/Resources/applet.icns" 2>/dev/null || true
    rm -f "$tmp/MedScribe.app/Contents/Resources/Assets.car"
    /usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$plist" >/dev/null 2>&1 || true
  fi
  # после правок пакета подпись нужно поставить заново
  codesign --force --deep -s - "$tmp/MedScribe.app" >/dev/null 2>&1 || true
  mkdir -p "$apps" || return 1
  rm -rf "$app"
  mv "$tmp/MedScribe.app" "$app" || return 1
  shortcut="$app"
  shortcut_note="Ярлык MedScribe — в Программах: его видно в Launchpad и через поиск Spotlight; перетащите его в Dock, чтобы открывать в один щелчок."
  shortcut_short="ярлык MedScribe из Программ (Launchpad, Spotlight). Он сам запустит Docker Desktop."
}

# кладёт $entry в файл $1, если там ничего нет или лежит наш ярлык: 0 - записан, 1 - пропущен, 2 - ошибка
put_desktop() {
  if [ -e "$1" ]; then
    if ! grep -q '^Exec=env MEDSCRIBE_GUI=1 sh ".*/scripts/open\.sh"$' "$1" 2>/dev/null; then
      warn "Файл $1 создан не установщиком: не трогаю."
      return 1
    fi
  elif [ "${MEDSCRIBE_UPDATE:-}" = "1" ]; then
    return 1
  fi
  cp "$entry" "$1" || return 2
  chmod +x "$1" 2>/dev/null || true
}

shortcut_linux() {
  # пути с кавычками, $, обратной чертой и % ломают строку Exec в .desktop
  case "$dir" in
    *[\"\$\`\\%]*) return 1 ;;
  esac
  desk="${MEDSCRIBE_DESKTOP_DIR:-}"
  if [ -z "$desk" ]; then
    # без графической сессии (сервер, SSH) ярлык не нужен
    [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || return 0
    if command -v xdg-user-dir >/dev/null 2>&1; then desk="$(xdg-user-dir DESKTOP 2>/dev/null || true)"; fi
    [ -n "$desk" ] || desk="$HOME/Desktop"
    [ "$desk" != "$HOME" ] || desk=""
    [ -d "$desk" ] || desk=""
  fi
  apps="${MEDSCRIBE_APPS_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/applications}"
  entry="$tmp/medscribe.desktop"
  {
    printf '[Desktop Entry]\nType=Application\nName=MedScribe\n'
    printf 'Comment=Открыть MedScribe\n'
    printf 'Exec=env MEDSCRIBE_GUI=1 sh "%s/scripts/open.sh"\n' "$dir"
    printf 'Path=%s\nTerminal=false\nCategories=Office;MedicalSoftware;\n' "$dir"
    if [ -f "$dir/scripts/icons/medscribe.png" ]; then printf 'Icon=%s/scripts/icons/medscribe.png\n' "$dir"; fi
  } > "$entry"
  mkdir -p "$apps" || return 1
  r=0
  put_desktop "$apps/medscribe.desktop" || r=$?
  [ "$r" -ne 2 ] || return 1
  if [ "$r" -eq 0 ]; then
    shortcut="$apps/medscribe.desktop"
    shortcut_note="Ярлык «MedScribe» добавлен в меню приложений: им открывайте программу каждый день."
    [ -n "$desk" ] || shortcut_note="Ярлык «MedScribe» добавлен в меню приложений (папки рабочего стола не нашлось): им открывайте программу каждый день."
    shortcut_short="ярлык «MedScribe» в меню приложений."
  fi
  if [ -n "$desk" ]; then
    mkdir -p "$desk" || return 1
    r=0
    put_desktop "$desk/MedScribe.desktop" || r=$?
    [ "$r" -ne 2 ] || return 1
    if [ "$r" -eq 0 ]; then
      # GNOME разрешает запуск файла с рабочего стола только после пометки «доверенный»
      if command -v gio >/dev/null 2>&1; then gio set "$desk/MedScribe.desktop" metadata::trusted true >/dev/null 2>&1 || true; fi
      shortcut="$desk/MedScribe.desktop"
      shortcut_note="Ярлык «MedScribe» лежит на рабочем столе: им открывайте программу каждый день."
      shortcut_short="ярлык «MedScribe» на рабочем столе."
    fi
  fi
}

open_browser() {
  say ""
  if [ -n "$shortcut" ] && [ "${MEDSCRIBE_UPDATE:-}" != "1" ]; then
    say "$shortcut_note"
    say "Ссылка на случай, если ярлык не сработает: $open_url"
  else
    say "Откройте MedScribe: $open_url"
  fi
  if [ "$server" = "1" ] || [ "${MEDSCRIBE_NO_BROWSER:-}" = "1" ] || [ "${MEDSCRIBE_UPDATE:-}" = "1" ]; then
    return 0
  fi
  # на macOS показываем ярлык в Finder (обычное открытие через систему, без разрешений); браузер откроется поверх
  if [ "$(uname -s)" = "Darwin" ] && [ -n "$shortcut" ]; then
    open -R "$shortcut" >/dev/null 2>&1 || true
  fi
  if [ "$(uname -s)" = "Darwin" ]; then
    open "$open_url" >/dev/null 2>&1 || say "Не получилось открыть браузер сам: откройте ссылку выше вручную."
  elif [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$open_url" >/dev/null 2>&1 || say "Не получилось открыть браузер сам: откройте ссылку выше вручную."
  else
    say "Браузер сам не открывается на этом компьютере: откройте ссылку выше вручную."
  fi
}

model_kb() {
  v="$(docker compose exec -T tone du -sk /models 2>/dev/null </dev/null | cut -f1 || true)"
  case "$v" in ''|*[!0-9]*) v="" ;; esac
  printf '%s' "$v"
}

# "2,3" из килобайт (десятичные гигабайты)
gb_text() {
  tenths=$(( $1 * 10240 / 1000000000 ))
  printf '%s,%s' $(( tenths / 10 )) $(( tenths % 10 ))
}

# только прогресс модели речи для уже установленной программы (его зовёт install-server.sh)
progress_only() {
  case "$dir" in
    /*) ;;
    *) dir="$PWD/$dir" ;;
  esac
  [ -f "$dir/.medscribe-install" ] || fail "В папке $dir нет установки MedScribe."
  cd "$dir"
  if [ "$(sed -n 's/^mode=//p' .medscribe-install | head -n 1 | tr -d '\r')" = "server" ]; then server=1; fi
  port="$(env_get APP_PORT)"
  case "$port" in ''|*[!0-9]*) port=3000 ;; esac
  show_model_progress
}

# прогресс загрузки модели речи, пока /api/health не покажет "tone":true
show_model_progress() {
  case "$(health_body)" in
    *'"tone":true'*) say "Модель распознавания речи уже готова."; return 0 ;;
  esac
  say ""
  if [ "$server" = "1" ] || [ "${MEDSCRIBE_NO_BROWSER:-}" = "1" ]; then
    say "Ссылка для входа уже показана выше, регистрироваться можно сейчас. Модель распознавания речи"
  else
    say "Браузер уже открыт, регистрироваться можно сейчас. Модель распознавания речи"
  fi
  say "(около 5,6 ГБ) ещё загружается: без неё нельзя записывать приём. Ctrl+C безопасен, загрузка идёт в фоне."
  trap on_interrupt INT
  tty=0
  [ ! -t 1 ] || tty=1
  start="$(now)"
  kb0=""
  t0="$start"
  last_kb=0
  last_grow="$start"
  warned=0
  n=0
  expected_text="$(gb_text "$MODEL_EXPECTED_KB")"
  while [ $(( $(now) - start )) -lt "$MODEL_WAIT_SEC" ]; do
    case "$(health_body)" in
      *'"tone":true'*)
        [ "$tty" -eq 0 ] || printf '\r\033[K'
        say "Модель распознавания речи готова. Можно записывать приём."
        trap - INT
        return 0
        ;;
    esac
    kb="$(model_kb)"
    t="$(now)"
    if [ -z "$kb" ] || [ "$kb" -eq 0 ]; then
      line="Жду запуск службы распознавания речи..."
    else
      if [ "$kb" -gt "$last_kb" ]; then
        last_kb="$kb"
        last_grow="$t"
      fi
      if [ -z "$kb0" ]; then kb0="$kb"; t0="$t"; fi
      pct=$(( kb * 100 / MODEL_EXPECTED_KB ))
      [ "$pct" -le 99 ] || pct=99
      eta="оцениваю скорость..."
      el=$(( t - t0 ))
      if [ "$el" -ge 20 ] && [ "$kb" -gt "$kb0" ] && [ "$kb" -lt "$MODEL_EXPECTED_KB" ]; then
        rem=$(( (MODEL_EXPECTED_KB - kb) * el / (kb - kb0) ))
        eta="осталось ~$(( (rem + 59) / 60 )) мин"
      elif [ "$kb" -ge "$MODEL_EXPECTED_KB" ]; then
        eta="почти готово"
      fi
      line="Загружаю модель распознавания речи: $(gb_text "$kb") из ~$expected_text ГБ ($pct %), $eta"
    fi
    if [ "$tty" -eq 1 ]; then
      printf '\r\033[K%s' "$line"
    elif [ $(( n % 6 )) -eq 0 ]; then
      say "$line"
    fi
    if [ $(( t - last_grow )) -ge 600 ] && [ "$warned" -eq 0 ]; then
      warned=1
      [ "$tty" -eq 0 ] || printf '\n'
      warn "Загрузка модели не двигается уже 10 минут. Проверьте интернет. Если Hugging Face у вас недоступен, задайте зеркало (HF_ENDPOINT в файле .env) и выполните: docker compose up -d. Подробности: docker compose logs --tail 30 tone"
    fi
    n=$(( n + 1 ))
    sleep 5
  done
  [ "$tty" -eq 0 ] || printf '\n'
  warn "Модель всё ещё загружается. Программа работает, модель догрузится сама. Прогресс: docker compose logs --tail 30 tone"
  trap - INT
}

# Путь в одинарных кавычках для вставки в терминал.
sh_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

final_summary() {
  say ""
  if [ "${MEDSCRIBE_UPDATE:-}" = "1" ]; then
    body="$(health_body)"
    word() { case "$body" in *"\"$1\":true"*) printf '%s' "$2" ;; *) printf '%s' "$3" ;; esac; }
    say "Обновление завершено ($new_version). Состояние:"
    say "  база данных:        $(word db 'работает' 'НЕ отвечает')"
    say "  распознавание речи: $(word tone 'готово' 'ещё загружается (первый раз до 20 минут) или не работает')"
    say "  языковая модель:    $(word llm 'подключена' 'не подключена: Профиль → Настройки ИИ')"
    say "Откройте $open_url"
    return 0
  fi
  say "Готово. Дальше:"
  if [ -n "$shortcut" ]; then
    say "  Открывать программу: $shortcut_short"
  fi
  if [ "$needs" = "yes" ]; then
    say "  1. Создайте аккаунт, затем подключите языковую модель: Профиль → Настройки ИИ."
  else
    say "  1. Подключите языковую модель: Профиль → Настройки ИИ (если ещё не подключена)."
  fi
  say "     Первая пробная запись: https://github.com/Allmostkill/medscribe/blob/main/docs/FIRST_PROTOCOL.md"
  say "     Если нужна помощь с ошибкой, в папке программы:"
  say "       cd $(sh_quote "$dir")"
  say "       sh scripts/diagnose.sh"
  if [ "$server" = "1" ] || ! is_docker_desktop; then
    say "  2. На сервере Docker стартует как служба и поднимет MedScribe после перезагрузки. Проверьте, что"
    say "     автозапуск включён: sudo systemctl enable docker (если он уже включён, ничего делать не нужно)."
  else
    say "  2. Чтобы MedScribe работал после перезагрузки компьютера, включите автозапуск Docker Desktop:"
    say "     Settings → General → Start Docker Desktop when you sign in."
  fi
  say "  3. Обновление до новой версии, в папке программы: sh scripts/update.sh"
  say "Программа лежит в папке $dir"
}

main "$@"
