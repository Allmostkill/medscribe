-- ════════════════════════════════════════════════════════════════════════════
--  MedScribe — схема БД (Postgres, одним файлом)
--
--  Выполняется один раз при создании пустого тома Postgres (после
--  10-roles.sh, который создаёт роли). Скрипт идемпотентен.
--
--  Доступ к данным — только через сервер приложения: PostgREST с ролью
--  service_role. Публичные роли anon/authenticated закрыты: RLS включён и
--  принудительный, политика deny-all, права отозваны.
--
--  Имена колонок "specialtyId", "experienceYears" в кавычках намеренно:
--  без кавычек Postgres приведёт их к нижнему регистру, и PostgREST не
--  найдёт колонки, которые запрашивает server.ts.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Врач ────────────────────────────────────────────────────────────────────
-- Врач в базе один: уникальный индекс doctors_single_owner не даёт вставить
-- вторую строку.
-- protocol_template — личный шаблон протокола врача (свободный текст). Сервер
--         подставляет его в промпт как данные, не как инструкции.
-- sessions_valid_after — токены, выданные раньше этой отметки, недействительны
--         (сдвигается при смене пароля и переключении 2FA).
create table if not exists doctors (
  id                    text primary key,
  email                 text unique,
  password              text,
  name                  text,
  "specialtyId"         text,
  "experienceYears"     integer,
  is_two_factor_enabled boolean default false,
  two_factor_secret     text,
  protocol_template     text,
  sessions_valid_after  timestamptz not null default now(),
  created_at            timestamptz default now()
);

create unique index if not exists doctors_single_owner on doctors ((true));

-- ── Черновики протоколов ────────────────────────────────────────────────────
-- content — зашифрованный (DATA_ENCRYPTION_KEY) JSON протокола вместе со стенограммой.
create table if not exists ehr_drafts (
  id         text primary key,
  doctor_id  text references doctors(id) on delete cascade,
  content    text,
  created_at timestamptz default timezone('utc'::text, now())
);

create index if not exists idx_ehr_drafts_doctor on ehr_drafts (doctor_id);

-- ── Refresh-токены («Запомнить меня») ───────────────────────────────────────
-- Хранится SHA-256 хеш токена, не сам токен. Ротация на каждое использование.
create table if not exists refresh_tokens (
  id             text primary key,            -- "rt_" + 16 hex
  doctor_id      text not null references doctors(id) on delete cascade,
  token_hash     text not null,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz,
  user_agent     text,
  ip             text
);

create index if not exists idx_refresh_tokens_doctor  on refresh_tokens (doctor_id);
create index if not exists idx_refresh_tokens_expires on refresh_tokens (expires_at);
create index if not exists idx_refresh_tokens_hash    on refresh_tokens (token_hash);

-- ── Раскладка рабочего экрана приёма ────────────────────────────────────────
-- Одна JSON-строка на врача: позиции/размеры/видимость блоков и свои виджеты.
create table if not exists doctor_workspace_layout (
  doctor_id  text primary key references doctors(id) on delete cascade,
  layout     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Зеркало клинических рекомендаций Минздрава ──────────────────────────────
-- Публичный нормативный текст, персональных данных нет; таблицы общие для всех
-- врачей. Заполняются скриптом scripts/fetch-guidelines.mjs.
-- code_version ('295_4') меняется при выходе новой редакции, code ('295') —
-- сквозной между редакциями.
create table if not exists guideline_documents (
  code_version   text primary key,
  code           text        not null,
  version        int         not null,
  name           text        not null,
  publish_date   timestamptz,
  -- 1 — взрослые, 2 — дети, 3 — и те и другие.
  age_category   smallint,
  age_label      text,
  adult          boolean     not null default false,
  child          boolean     not null default false,
  mkb_codes      text[]      not null default '{}',
  developers     text[]      not null default '{}',
  -- Одобрено научно-практическим советом Минздрава.
  npc_approved   boolean     not null default false,
  -- ver=1 — легаси-шаблон: id разделов там значат другое (например, doc_6),
  -- разбирать такие разделы по смыслу id нельзя.
  template_ver   smallint    not null default 2,
  source_url     text        not null,
  fetched_at     timestamptz not null default now()
);

create index if not exists guideline_documents_mkb_idx  on guideline_documents using gin (mkb_codes);
create index if not exists guideline_documents_code_idx on guideline_documents (code);

-- Раздел документа. Словарь section_id закрытый и общий для рекомендаций
-- нового шаблона (doc_1, doc_diag_2_1, doc_3, doc_criteria, …). Крупные разделы
-- загрузчик режет на куски, номер куска — в part.
create table if not exists guideline_sections (
  id           bigserial primary key,
  code_version text not null references guideline_documents(code_version) on delete cascade,
  section_id   text not null,
  part         int  not null default 0,
  ord          int  not null,
  title        text not null,
  -- HTML нужен как есть: в разделах живут таблицы. Картинки вырезаны загрузчиком.
  html         text not null,
  -- Плоский текст — для полнотекстового поиска и для подачи модели.
  plain        text not null,
  char_len     int  not null,
  -- Раздел опубликован сканом (только картинки) — показываем ссылку на оригинал.
  image_only   boolean not null default false,
  -- Уровень убедительности рекомендаций / достоверности доказательств, по
  -- порядку появления в тексте. Пустой список НЕ значит «грейдов нет».
  uur          text[] not null default '{}',
  udd          text[] not null default '{}',
  tsv tsvector generated always as (to_tsvector('russian'::regconfig, plain)) stored,
  unique (code_version, section_id, part)
);

create index if not exists guideline_sections_doc_idx on guideline_sections (code_version, section_id);
create index if not exists guideline_sections_tsv_idx on guideline_sections using gin (tsv);

-- ── Безопасность: deny-all для публичных ролей ──────────────────────────────
-- service_role обходит RLS и продолжает работать без ограничений.
do $$
declare
  t text;
  tbls text[] := array[
    'doctors', 'ehr_drafts', 'refresh_tokens',
    'doctor_workspace_layout', 'guideline_documents', 'guideline_sections'
  ];
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('revoke all on public.%I from anon, authenticated;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_deny_public', t);
    execute format(
      'create policy %I on public.%I for all to public using (false) with check (false);',
      t || '_deny_public', t
    );
  end loop;
end $$;

-- Публичные роли не должны получать права на новые объекты и на sequences.
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Серверной роли права даём явно (включая sequence guideline_sections).
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

