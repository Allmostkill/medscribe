-- ════════════════════════════════════════════════════════════════════════════
--  MedScribe — настройки языковой модели, заданные врачом в личном кабинете
--
--  Одна строка (id = 1). Ключ API хранится зашифрованным (api_key_enc, префикс
--  «v2:»), в открытом виде в базе его нет. Доступ — только через сервер
--  приложения (роль service_role), публичные роли закрыты.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Языковая модель (настройки из кабинета) ─────────────────────────────────
-- provider    — ollama (локально) или cloud (облачный API)
-- base_url    — адрес API, как в документации провайдера (с /v1)
-- api_key_enc — ключ облачного провайдера, зашифрован; для ollama пусто
-- json_mode   — просить у модели ответ в JSON
-- timeout_ms  — сколько ждать ответа модели, мс
-- transfer_ack_at — когда врач подтвердил, что текст приёма уйдёт провайдеру (null — не подтверждал,
--               например модель на этом компьютере)
create table public.llm_settings (
  id          smallint primary key default 1 check (id = 1),
  provider    text not null check (provider in ('ollama','cloud')),
  base_url    text not null check (char_length(base_url) between 8 and 500),
  model       text not null check (char_length(model) between 1 and 200),
  api_key_enc text check (api_key_enc is null or api_key_enc like 'v2:%'),
  json_mode   boolean not null default true,
  timeout_ms  integer not null default 60000 check (timeout_ms between 5000 and 600000),
  transfer_ack_at timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.llm_settings enable row level security;
alter table public.llm_settings force row level security;
revoke all on public.llm_settings from anon, authenticated;
create policy llm_settings_deny_public on public.llm_settings for all to public using (false) with check (false);
grant all on public.llm_settings to service_role;
