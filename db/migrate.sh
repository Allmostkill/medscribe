#!/bin/bash
# Применяет миграции схемы из /migrations, которых ещё нет в public.schema_migrations.
# Запускается сервисом migrate перед стартом приложения. Базовая схема - db/initdb/20-schema.sql.
set -euo pipefail

pw_file=/run/secrets/medscribe/postgres_password
[ -s "$pw_file" ] || { echo "migrate: нет пароля базы ($pw_file)" >&2; exit 1; }
# пароль берём из файла внутри скрипта: в environment compose его нет
PGPASSWORD="$(tr -d '\r\n' < "$pw_file")"
export PGPASSWORD
export PGHOST="${PGHOST:-postgres}" PGUSER="${PGUSER:-postgres}" PGDATABASE="${PGDATABASE:-medscribe}"

psql -v ON_ERROR_STOP=1 -q <<'SQL'
-- без NOTICE «already exists, skipping» при повторных запусках
set client_min_messages = warning;
create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);
-- как остальные таблицы схемы: ролям PostgREST недоступна
alter table public.schema_migrations enable row level security;
alter table public.schema_migrations force row level security;
revoke all on public.schema_migrations from anon, authenticated;
SQL

applied=0
shopt -s nullglob
for file in /migrations/*.sql; do
  name="$(basename "$file")"
  if ! [[ "$name" =~ ^[0-9]{4}_[A-Za-z0-9_.-]+\.sql$ ]]; then
    echo "migrate: пропускаю файл с неподходящим именем: $name (нужно NNNN_описание.sql)" >&2
    continue
  fi
  done_flag="$(psql -v ON_ERROR_STOP=1 -v f="$name" -tA <<'SQL'
select 1 from public.schema_migrations where filename = :'f';
SQL
)"
  [ -z "$done_flag" ] || continue

  echo "migrate: применяю $name"
  # сама миграция и запись о ней - в одной транзакции
  if ! psql -v ON_ERROR_STOP=1 -q --single-transaction -v f="$name" -f "$file" -f - <<'SQL'
insert into public.schema_migrations (filename) values (:'f');
SQL
  then
    echo "migrate: ОШИБКА в миграции $name. Изменения этой миграции отменены, приложение не запущено." >&2
    echo "migrate: исправьте файл или откатите обновление и повторите: docker compose up -d" >&2
    exit 1
  fi
  applied=$((applied + 1))
done

if [ "$applied" -gt 0 ]; then
  psql -v ON_ERROR_STOP=1 -q -c "NOTIFY pgrst, 'reload schema'"
  echo "migrate: применено миграций: $applied"
else
  echo "migrate: новых миграций нет"
fi
