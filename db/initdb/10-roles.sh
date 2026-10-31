#!/bin/sh
# Роли для PostgREST. Выполняется один раз при создании пустого тома, до
# 20-schema.sql (init-скрипты идут по алфавиту). База POSTGRES_DB уже создана.
set -eu

pw_file=/run/secrets/medscribe/authenticator_password
[ -s "$pw_file" ] || { echo "10-roles.sh: пустой или отсутствует authenticator_password" >&2; exit 1; }

# Пароль читается внутри psql, а не передаётся через -v: иначе он виден
# в списке процессов (/proc). Файл без перевода строки, поэтому tr на всякий случай.
# log_min_error_statement = panic — текст create role с паролем не попадёт в журнал при ошибке.
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\set auth_pw `tr -d '\r\n' < /run/secrets/medscribe/authenticator_password`
set log_min_error_statement = panic;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password :'auth_pw';
grant anon, authenticated, service_role to authenticator;
SQL
