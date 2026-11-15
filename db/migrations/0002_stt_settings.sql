-- ════════════════════════════════════════════════════════════════════════════
--  MedScribe — выбор модели распознавания речи в личном кабинете
--
--  Одна строка (id = 1). Нет строки — работает T-one (по умолчанию). Доступ —
--  только через сервер приложения (роль service_role), публичные роли закрыты.
-- ════════════════════════════════════════════════════════════════════════════

-- engine — tone (T-one, по умолчанию) или gigaam (GigaAM v3 для итоговой расшифровки)
create table public.stt_settings (
  id         smallint primary key default 1 check (id = 1),
  engine     text not null default 'tone' check (engine in ('tone','gigaam')),
  updated_at timestamptz not null default now()
);
alter table public.stt_settings enable row level security;
alter table public.stt_settings force row level security;
revoke all on public.stt_settings from anon, authenticated;
create policy stt_settings_deny_public on public.stt_settings for all to public using (false) with check (false);
grant all on public.stt_settings to service_role;
