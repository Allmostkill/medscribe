# Устройство MedScribe

Документ для разработчика: как устроены процессы, путь данных, каталоги и серверный код. Пользовательская часть — в [README](../README.md) и [инструкции для врача](GUIDE.md).

## Оглавление

1. [Процессы и сети](#1-процессы-и-сети)
2. [Путь данных приёма](#2-путь-данных-приёма)
3. [Дерево каталогов](#3-дерево-каталогов)
4. [Маршруты](#4-маршруты)
5. [Порядок middleware](#5-порядок-middleware)
6. [Состояние в памяти процесса](#6-состояние-в-памяти-процесса)
7. [Шифрование и секреты](#7-шифрование-и-секреты)
8. [Как добавить маршрут](#8-как-добавить-маршрут)
9. [Как добавить миграцию](#9-как-добавить-миграцию)
10. [Проверки](#10-проверки)

---

## 1. Процессы и сети

Шесть сервисов из `docker-compose.yml`. Образы берутся из GHCR (`ghcr.io/allmostkill/medscribe-*`, тег `main` в репозитории; в пакете релиза тег заменяется на версию, см. `scripts/release/make-bundle.sh`).

| Сервис | Что делает | Сеть | Тома | Запуск |
|---|---|---|---|---|
| `init` | `scripts/init-secrets.mjs`: создаёт недостающие секреты, существующие не перезаписывает | нет (`network_mode: none`) | `secrets` (запись) | один раз, завершается |
| `postgres` | Postgres 16; при пустом томе выполняет `db/initdb/` (`10-roles.sh`, `20-schema.sql`) | `db` | `pgdata`, `secrets` (чтение) | постоянно, после `init` |
| `migrate` | `db/migrate.sh`: применяет миграции из `db/migrations` | `db` | `secrets` (чтение) | один раз при каждом `up`, после готовности `postgres` |
| `postgrest` | HTTP-доступ к базе; принимает только JWT, подписанный секретом PostgREST | `db` | `secrets` (чтение) | постоянно |
| `tone` | Python-сервис T-one (`tone-service/`): `/stream` (WebSocket), `/transcribe`, `/health`, `/engines` и команды GigaAM (`/engines/gigaam/prepare`, `/engines/gigaam/release`) | `default` | `tone-models` | постоянно; первый старт скачивает модель T-one; GigaAM скачивается только по команде из кабинета |
| `app` | Node 22: `server.ts` + собранный фронтенд (`dist/`) | `default` и `db` | `secrets` (чтение), `app-logs` | постоянно, после `init`, `migrate` (успешно), `postgrest`, `tone` |

Сети: `default` и `db`. `db` объявлена `internal: true` и выхода наружу не имеет. Базу и PostgREST видит только `app`. `tone` на хост не публикуется. На хост (`127.0.0.1:${APP_PORT:-3000}`) открыт только `app`.

Compose-файлов три:

- `docker-compose.yml` — основной набор, образы из GHCR;
- `docker-compose.build.yml` — сборка `init`, `app` и `tone` из исходников: `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`;
- `docker-compose.server.yml` — серверный режим: добавляет сервис `caddy` (образ `medscribe-caddy`). Он публикует 80 и 443 (TCP, и 443 UDP для HTTP/3), получает сертификат для `MEDSCRIBE_DOMAIN` и проксирует на `app:3000` по `Caddyfile`. Режим включается строкой `COMPOSE_FILE="docker-compose.yml:docker-compose.server.yml"` в `.env` (её пишет установщик, он же ставит `TRUST_PROXY=true` и `PUBLIC_URL=https://<домен>`).

Пока задан `COMPOSE_FILE`, Compose не подхватывает `docker-compose.override.yml` сам: его нужно добавить в список вручную.

```
браузер врача ──http/ws──> app ──(db)──> postgrest ──> postgres <──(db)── migrate
                            │
                            └──(default)──> tone
                            └──https/http──> модель: адрес из кабинета или LLM_BASE_URL из .env
```

`app` ходит в PostgREST токеном `service_role` (HS256, живёт 1 час, перевыпускается автоматически: `src/server/db.ts`). Защита уровня строк и закрытые роли `anon`/`authenticated` описаны в `db/initdb/20-schema.sql`.

Настройки языковой модели, которые врач задаёт в кабинете (Профиль → Настройки ИИ), лежат в таблице `llm_settings` (одна строка, см. раздел 9). Приоритет: кабинет → `.env` → модель не подключена.

## 2. Путь данных приёма

1. **Звук (браузер).** `src/services/sttStream.ts` захватывает микрофон врача. В режиме «Онлайн-приём» это звук вкладки (`getDisplayMedia`) и микрофон, смешанные в один поток через `AudioContext`. Поток переводится в PCM int16 8 кГц.
2. **Живая расшифровка.** PCM идёт по WebSocket `/ws/stt/tone`. Токен передаётся подпротоколом `bearer, <jwt>`. Сервер (`src/server/ws/toneProxy.ts`) проверяет токен и сессию, затем проксирует кадры в `tone` (`/stream`) и возвращает фразы браузеру.
3. **Полная запись.** Параллельно `src/services/bufferedRecorder.ts` пишет тот же поток сегментами в IndexedDB (`audioBuffer.ts`). После остановки сегменты уходят в `POST /api/stt/full` (`src/services/sttFull.ts`), сервер пересылает их в `tone` (`/transcribe`). Результат подменяет живую стенограмму. Режим стенографа (только очный приём) работает только по этой ветке. Движок этого вызова выбирает врач в кабинете (`GET`/`PUT /api/ai/stt-engine`): T-one по умолчанию или GigaAM v3 (`/transcribe?engine=gigaam`, `tone-service/gigaam.py`), если модель готова; иначе T-one. Живая стенограмма (`/ws/stt/tone`) всегда от T-one.
   Разметка по голосу идёт в том же вызове `/transcribe`: `tone` делит фразы по голосам (sherpa-onnx, `tone-service/diarize.py`) и отдаёт каждую фразу с номером `speaker` и статусом `diarization` (`ok`, `single`, `skipped`, `off`, `failed`). `src/utils/speakers.ts` превращает номер в `speaker_N` только при статусе `ok`; `/api/stt/full` отдаёт сегменты уже с полем `speaker`. В `sttFull.ts` номера сдвигаются сквозь 20-минутные сегменты записи, чтобы не повторялись (`mergeSessionSegments`, `src/utils/speakers.ts`). Сегмент, где звучал один голос (`single`), при наличии разделённых голосов в другом сегменте получает свой номер, чтобы не прилипнуть к чужому голосу; сегмент со статусом `failed` или `skipped` остаётся без меток (`unknown`) и приклеивается к предыдущей реплике: это известный пробел. Один и тот же голос в разных сегментах при этом не сопоставляется: он получает новый номер, а одинаковую роль для таких меток ставит ИИ (см. п. 4). Живая стенограмма (`/ws/stt/tone`) голосов не размечает.
4. **ИИ-запросы.** Браузер шлёт текст в `/api/ai/*` (`src/services/ai.ts`). Для каждого запроса `createApp` заводит свой деидентификатор (`deidContext`, `AsyncLocalStorage`):
   - обработчик оборачивает пользовательский текст через `wrapUserContent` (`src/server/ai/prompt.ts`): имена, телефоны, даты, номера документов заменяются метками;
   - `llmGenerate` (`src/server/ai/llmGateway.ts`) вызывает `callLlm` (`src/server/llm.ts`, OpenAI-совместимый `/chat/completions`) и возвращает метки на место;
   - обработчик разбирает JSON; сбой модели превращается в понятный текст и код `llm_*` (`sendAiError`, `llmErrorMessage`).
   - **Режим «по голосу».** Если в стенограмме две и больше меток `[speaker_N]` (или клиент прислал `voiceLabelled: true` для уже размеченной записи, где остались только `[doctor]` и `[patient]`; решает `shouldUseVoiceMode`; любая другая строка в скобках в начале строки отключает режим), `/api/ai/analyze` просит модель вернуть только `speakerRoles`: роль `doctor`, `patient` или `other` для каждой метки. Строки стенограммы на экран собирает сервер (`buildVoiceDiarizedTranscript`, `src/server/ai/validate.ts`) из текста самого запроса, модель его не переписывает. Строки `[doctor]` и `[patient]` (ручная реплика врача, уже решённые роли) остаются отдельными репликами с этой ролью. Строки без метки и `[unknown]` приписываются к предыдущей реплике, соседние реплики одного участника склеиваются. Ответ получает `diarizationSource: 'voice'`.
   - **Запасные пути.** Меток меньше двух (разметка не сработала): старый путь, модель делит реплики по смыслу, `diarizationSource: 'llm'`. Роли негодные (нет врача или нет второго участника): строки остаются с `speaker_N`, на экране «Спикер N», ответ по-прежнему `diarizationSource: 'voice'`. Модель не подключена: тоже «Спикер N».
5. **Валидация цитат.** `/api/ai/note-check` и `/api/ai/communication` сверяют каждую цитату модели со стенограммой (`src/server/ai/validate.ts`) и отбрасывают пункты без дословного подтверждения. Протокол (`/api/ai/analyze`) и сверка — отдельные запросы: сверку браузер запускает после сборки протокола.
6. **Сохранение.** `POST /api/drafts` шифрует содержимое (AES-256-GCM, `src/server/crypto.ts`) и пишет в `ehr_drafts` через PostgREST. Правки протокола браузер отправляет `PATCH /api/drafts/:id` с задержкой около 1,5 секунды после последней правки.

Аудио на сервере не сохраняется: `app` только пересылает его в `tone`. Подробнее о хранении — в [README](../README.md#где-хранится-аудио).

## 3. Дерево каталогов

| Путь | Назначение |
|---|---|
| `server.ts` | Точка входа: создаёт приложение (`createApp`), HTTP-сервер, подключает WebSocket-прокси, печатает код первого запуска, ловит необработанные ошибки |
| `src/server/` | Весь бэкенд (см. ниже) |
| `src/services/` | Браузерные клиенты API и записи: `auth.ts`, `ai.ts`, `health.ts`, `sttStream.ts`, `sttFull.ts`, `bufferedRecorder.ts`, `audioBuffer.ts`, `mediaErrors.ts` |
| `src/components/` | React-компоненты: `ServiceStatusBanner`, `MicCheck`, `ChecklistPanel`, `CommunicationNotes` и др.; `blocks/` — блоки рабочего поля |
| `src/config/` | Справочники и константы, общие для фронтенда и сервера (специальности, чек-листы, фарма, МКБ-10, раскладка рабочего поля) |
| `src/generated/` | Импортированные калькуляторы (генерируются скриптом `scripts/import-calculators.mjs`, руками не правятся) |
| `src/utils/` | Чистые функции: `ehrText.ts` (текст для МИС), `doseCheck.ts`, `patientMemo.ts`, `guidelineCriteria.ts` (используется и сервером), `calculatorRegistry.ts`, `format.ts` |
| `src/*.tsx` | Экраны: `App`, `Login`, `Setup`, `Dashboard`, `PersonalAccount` |
| `tone-service/` | Python-сервис распознавания речи, свой Dockerfile |
| `db/` | `initdb/` (роли и базовая схема), `migrations/` (изменения схемы), `migrate.sh` |
| `scripts/` | `init-secrets.mjs`, `reset-password.ts`, `fetch-guidelines.mjs`, `import-calculators.mjs`, `backup.sh`, `restore.sh`, `update.sh`, `check-*` |

`src/server/`:

| Путь | Назначение |
|---|---|
| `app.ts` | `createApp()`: порядок middleware и подключения маршрутов |
| `config.ts` | Переменные окружения и секреты (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `TRUST_PROXY`, `ENABLE_2FA`, `PORT`, `HOST`); при отсутствии секретов процесс завершается |
| `context.ts` | Клиент базы `db` (`service_role` через PostgREST) |
| `db.ts`, `secrets.ts` | Фабрика клиента базы; чтение секрета: переменная окружения важнее файла из тома `secrets` |
| `crypto.ts` | AES-256-GCM для черновиков и капчи |
| `deidentify.ts` | Деидентификация и возврат меток; `deidContext` |
| `llm.ts` | Клиент провайдера (конфигурация, запрос, ошибки `LlmError`, `llmErrorMessage`). Не путать с двумя другими: `ai/llmGateway.ts` — обёртка для маршрутов (единая точка вызова, возвращает метки деидентификации на место), `routes/ai/llm.ts` — маршруты `llm-status`, `llm-settings`, `llm-test` и `ollama/discover` |
| `auth/` | `tokens.ts` (JWT, refresh-токены, проверка сессии), `captcha.ts`, `totp.ts`, `doctor.ts` |
| `middleware/` | `security.ts` (заголовки, отсев запросов с чужого сайта), `auth.ts` (`requireAuth`, `requireFullAuth`, `requireSttAuth`, `requireTwoFaEnabled`), `rateLimit.ts` |
| `routes/` | Маршруты по темам; `routes/ai/` — ИИ-маршруты |
| `ai/` | Промпты (`prompt.ts`), специальность (`specialty.ts`), вызов модели (`llmGateway.ts`), отбор ответов (`validate.ts`), настройки модели из кабинета: `llmSettings.ts` (хранение, шифрование ключа, кеш), `llmSettingsRules.ts` (разбор тела запроса, проверка адреса, маска ключа) |
| `errors/` | `errorCodes.ts` (коды и тексты), `logger.ts` (файлы в `logs/`) |
| `ws/toneProxy.ts` | WebSocket `/ws/stt/tone` |
| `setup.ts` | Код первого запуска (в памяти) |
| `clientIp.ts`, `logSafe.ts`, `workspaceLayout.ts` | IP клиента, безопасные для логов тексты ошибок, проверка раскладки рабочего поля |

## 4. Маршруты

«Полная» авторизация означает `requireFullAuth`: не временный токен 2FA, а полный, и сессия, действующая по `sessions_valid_after`. Лимит указан как запросов / окно на IP.

| Маршрут | Файл | Доступ и лимит |
|---|---|---|
| `GET /api/health` | `routes/system.ts` | открыт |
| `GET /api/auth/config` | `routes/system.ts` | открыт |
| `GET /api/setup/status` | `routes/setup.ts` | открыт, 60 / 15 мин |
| `POST /api/setup` | `routes/setup.ts` | код первого запуска, 10 / 15 мин |
| `GET /api/auth/captcha` | `routes/auth.ts` | открыт, 30 / 1 мин (лимит на капче оставлен осознанно: генерация дорогая и открыта без входа) |
| `POST /api/auth/login` | `routes/auth.ts` | открыт, 10 / 15 мин |
| `POST /api/auth/refresh` | `routes/auth.ts` | refresh-токен в теле, 30 / 15 мин |
| `POST /api/auth/logout` | `routes/auth.ts` | refresh-токен в теле |
| `GET`, `PUT /api/auth/profile` | `routes/profile.ts` | полная |
| `POST /api/auth/change-password` | `routes/profile.ts` | полная, 5 / 15 мин |
| `POST /api/auth/2fa/generate` | `routes/twoFactor.ts` | полная, только при `ENABLE_2FA=true` |
| `POST /api/auth/2fa/enable` | `routes/twoFactor.ts` | полная, только при `ENABLE_2FA=true`, 5 / 15 мин |
| `POST /api/auth/2fa/disable` | `routes/twoFactor.ts` | полная, 5 / 15 мин |
| `POST /api/auth/2fa/verify-login` | `routes/twoFactor.ts` | временный токен в теле, 10 / 15 мин |
| `POST`, `GET /api/drafts`, `PATCH`, `DELETE /api/drafts/:id` | `routes/drafts.ts` | полная |
| `GET /api/guidelines`, `/doc/:docId`, `/doc/:docId/section/:sectionId` | `routes/guidelines.ts` | полная, 30 / 1 мин |
| `GET`, `PUT /api/workspace-layout` | `routes/workspace.ts` | полная |
| `GET /api/ai/llm-status` | `routes/ai/llm.ts` | полная, без своего лимита. Ответ без ключа: только `hasKey`, маска `keyMask`, `host` (без пути) и `transferAckAt`. Если базу прочитать не удалось и прежнего значения нет, `configured: false`, `unavailable: true` (модель из `.env` не показывается) |
| `PUT /api/ai/llm-settings` | `routes/ai/llm.ts` | полная, 10 / 15 мин. В теле пароль врача (иначе 403 `bad_password`). `acknowledgeTransfer: true` обязателен для облачной модели и для любого нелокального адреса (иначе `ack_required`); в серверном режиме локальны только loopback и шлюз Docker на 11434, остальные частные сети требуют подтверждения. Время пишется в `transfer_ack_at`. Порядок: форма → пароль → адрес → ключ → запись |
| `DELETE /api/ai/llm-settings` | `routes/ai/llm.ts` | полная, 10 / 15 мин. Требует пароль врача в теле (иначе 403 `bad_password`). После удаления действует `.env`, если он задан |
| `POST /api/ai/llm-test` | `routes/ai/llm.ts` | полная, 10 / 15 мин. Без тела — проверка действующей настройки (состояние «не знаем» — код `settings_unavailable`); с телом — черновик формы (пароль и подтверждение передачи не нужны) |
| `GET /api/ai/ollama/discover` | `routes/ai/llm.ts` | полная, 30 / 15 мин. Адреса Ollama заданы списком в коде, из запроса в адрес ничего не попадает |
| `POST /api/ai/hints` | `routes/ai/hints.ts` | полная, 45 / 1 мин |
| `POST /api/ai/communication` | `routes/ai/communication.ts` | полная, 45 / 1 мин |
| `POST /api/ai/note-check` | `routes/ai/noteCheck.ts` | полная, 45 / 1 мин |
| `POST /api/ai/pharma` | `routes/ai/pharma.ts` | полная, 45 / 1 мин |
| `POST /api/ai/suggest-diagnosis` | `routes/ai/diagnosis.ts` | полная, 45 / 1 мин |
| `POST /api/ai/patient-summary` | `routes/ai/patientSummary.ts` | полная, 45 / 1 мин |
| `POST /api/ai/analyze` | `routes/ai/analyze.ts` | полная, 45 / 1 мин |
| `GET /api/ai/stt-engine` | `routes/ai/sttEngine.ts` | полная, без своего лимита. Ответ: выбранный движок, какой действует сейчас, состояние GigaAM; сырой ответ `tone` не отдаётся |
| `PUT /api/ai/stt-engine` | `routes/ai/sttEngine.ts` | полная, 10 / 15 мин. Тело `{ "engine": "tone" \| "gigaam" }`; пароль не нужен. Для `gigaam` сервис `tone` получает команду подготовить модель |
| `POST /api/ai/stt-engine/download` | `routes/ai/sttEngine.ts` | полная, 10 / 15 мин. Повтор загрузки GigaAM после сбоя |
| `POST /api/stt/full` | `routes/stt.ts` | `requireSttAuth` до чтения тела (до 30 МБ), 60 / 15 мин |
| WebSocket `/ws/stt/tone` | `ws/toneProxy.ts` | токен в подпротоколе `bearer`; сессия перепроверяется раз в минуту |
| прочие `/api/*` | `app.ts` | 404 в JSON |

Лимит 45 / 1 мин (`aiRateLimit` в `routes/ai/shared.ts`) общий для ИИ-маршрутов, которые его используют; маршруты настроек модели (`routes/ai/llm.ts`) этот лимит не используют и задают свой. Все остальные пути отдают фронтенд (в разработке — Vite в режиме middleware, в продакшене — `dist/`).

## 5. Порядок middleware

Порядок в `createApp()` (`src/server/app.ts`):

| № | Что | Зачем именно здесь |
|---|---|---|
| 1 | `securityHeaders` | Заголовки на каждый ответ, в том числе на ошибки |
| 2 | `rejectCrossSite` на `/api` | Отсекает записывающие запросы с чужого сайта (`Sec-Fetch-Site: cross-site`) раньше, чем они дойдут до лимитов и обработчиков |
| 3 | `express.json({ limit: '2mb' })` | Превышение лимита даёт 413 в общем обработчике ошибок |
| 4 | `deidContext.run(createDeidentifier())` | Свой деидентификатор на запрос: обработчик не может его «забыть» |
| 5 | Открытые маршруты: `system`, `setup`, `auth`, `profile`, `twoFactor` | Эти файлы сами навешивают нужные `requireFullAuth` и лимиты на отдельные маршруты |
| 6 | `app.use('/api/drafts' \| '/api/ai' \| '/api/workspace-layout' \| '/api/guidelines', requireFullAuth)` | Защита целых префиксов |
| 7 | Защищённые маршруты: `drafts`, `guidelines`, `workspace`, `ai` | Регистрируются **после** п. 6 |
| 8 | `stt` | Защита навешена на сам маршрут (`requireSttAuth` до `express.raw`) |
| 9 | 404 для `/api/*` | До фронтенда: иначе неизвестный путь вернул бы `index.html`, а клиент увидел бы ошибку разбора JSON |
| 10 | Vite (разработка) или `dist/` и запасной `index.html` (продакшен) | |
| 11 | Общий обработчик ошибок | Не отдаёт стек клиенту; 413 для слишком большого JSON, остальное — 500 |

**Почему п. 6 обязан стоять до п. 7.** Express выполняет `app.use` и маршруты в порядке регистрации. Если защитный `app.use` окажется после регистрации маршрута, этот маршрут станет открытым, а сборка и типы этого не заметят. Поэтому при добавлении нового защищённого префикса сначала добавляйте `requireFullAuth`, потом регистрируйте маршруты. `scripts/check-routes.mjs` ловит такую ошибку (раздел 10).

Отдельный путь: WebSocket-апгрейд обрабатывает `httpServer.on('upgrade')` в `ws/toneProxy.ts`, минуя Express-цепочку. Токен и сессия проверяются там же; любой другой путь апгрейда закрывается.

## 6. Состояние в памяти процесса

Всё ниже живёт в памяти одного процесса `app` и теряется при перезапуске. **Процесс один**, общего хранилища (Redis и т. п.) нет, горизонтальное масштабирование не предусмотрено: при нескольких копиях лимиты и защиты считались бы у каждой отдельно.

| Что | Где | Эффект перезапуска |
|---|---|---|
| Счётчики лимитов запросов | `middleware/rateLimit.ts` | Сбрасываются |
| Неудачные входы по IP (когда требовать капчу) и использованные капчи | `auth/captcha.ts` | Сбрасываются |
| Последний принятый шаг TOTP и счётчик неверных кодов по врачу | `auth/totp.ts` | Сбрасываются (код по-прежнему действует 30 с) |
| Код первого запуска | `setup.ts` | При каждом старте до создания аккаунта печатается новый |
| Кэш проверки сессии (45 с) | `auth/tokens.ts` | Заполняется заново |
| Кэши клинических рекомендаций (сутки) и зеркало списка документов (час) | `routes/guidelines.ts` | Заполняются заново |
| Токен доступа к PostgREST | `db.ts` | Перевыпускается |
| Действующая настройка модели (кеш 30 с) | `ai/llmSettings.ts` | Заполняется заново. При сбое базы отдаётся прежнее значение, новая попытка — не раньше чем через 5 с. Если прежнего значения нет, состояние «не знаем»: модель из `.env` не используется, вызов модели завершается кодом `settings_unavailable`, `/api/health` показывает `llm: false`. Если настройки сохранены без подтверждения передачи, а адрес стал внешним, вызов завершается кодом `transfer_unconfirmed`. Сохранение и удаление кеш сбрасывают |

## 7. Шифрование и секреты

- **Черновики.** Содержимое (поля протокола и стенограмма) шифруется перед записью в `ehr_drafts`: AES-256-GCM, ключ — SHA-256 от `DATA_ENCRYPTION_KEY`, формат `v2:<iv>:<tag>:<данные>` (hex). Другие форматы не читаются. Прежние значения ключа для ротации перечисляются в `DATA_ENCRYPTION_KEY_OLD`. Тем же механизмом шифруется идентификатор капчи.
- **Ключ языковой модели из кабинета** шифруется тем же `encryptData` (столбец `llm_settings.api_key_enc`, префикс `v2:`). В ответах API ключа нет: только `hasKey` и `keyMask` (последние 4 символа; для ключа короче 12 символов видны одни точки). Журнал ключ не пишет. При смене адреса на другой origin прежний ключ не переносится (`keyAfterUpdate`).
- **Пароль врача** хранится как bcrypt-хеш. Refresh-токены — как SHA-256-хеши, при каждом обмене ротируются.
- **Секреты** создаёт `init` в томе `secrets` (файлы `jwt_secret`, `data_encryption_key`, `postgrest_jwt_secret`, `postgres_password`, `postgrest_db_uri`), существующие не перезаписывает. `app` читает их через `readSecret`: переменная окружения важнее файла. `JWT_SECRET`, `DATA_ENCRYPTION_KEY` и `POSTGREST_JWT_SECRET` должны различаться, иначе процесс не стартует. В журналы секреты не пишутся.
- **Потеря тома `secrets`** делает черновики нечитаемыми: см. резервную копию в [README](../README.md#резервная-копия).

## 8. Как добавить маршрут

1. Создайте обработчик в `src/server/routes/` (ИИ-маршрут — в `routes/ai/`) в виде функции `registerXxxRoutes(app)` по образцу соседних файлов.
2. Подключите её в `app.ts`:
   - защищённый маршрут: если его префикс уже под `requireFullAuth` (`/api/drafts`, `/api/ai`, `/api/workspace-layout`, `/api/guidelines`), достаточно регистрации **после** строк с `app.use(..., requireFullAuth)`; для нового префикса сначала добавьте `app.use('/api/новый', requireFullAuth)`, затем регистрацию;
   - ИИ-маршрут: добавьте вызов в `routes/ai/index.ts`, навесьте `aiRateLimit`, ошибки модели отдавайте через `sendAiError`, пользовательский текст оборачивайте `wrapUserContent`, модель вызывайте через `llmGenerate`;
   - открытый маршрут навешивает нужные `requireFullAuth` и `rateLimit` сам, на своём маршруте.
3. Добавьте маршрут в список `protectedRoutes` (или отдельный случай) в `scripts/check-routes.mjs` и запустите `npm run check`.
4. Если фронтенду нужен вызов, добавьте функцию в `src/services/`.
5. Новые коды ошибок для журнала — в `src/server/errors/errorCodes.ts`. Не пишите в логи тела запросов, стенограммы и тексты ошибок баз/моделей: используйте `safeErr`.

## 9. Как добавить миграцию

Базовую схему `db/initdb/20-schema.sql` не меняйте: она выполняется только на пустом томе. Изменения схемы оформляются файлом `db/migrations/NNNN_описание.sql`, который сервис `migrate` применяет при каждом `docker compose up` до старта `app`. Правила (транзакция, защита таблиц, права `service_role`, запрет редактировать применённые миграции) — в [db/migrations/README.md](../db/migrations/README.md).

Применённые миграции записываются в `public.schema_migrations`. Ошибка в миграции откатывает её целиком и не даёт запуститься `app`.

Пример — `db/migrations/0001_llm_settings.sql`: таблица `llm_settings` для настроек модели из кабинета. Одна строка (`id = 1`), колонка `transfer_ack_at` (время подтверждения передачи текста провайдеру), RLS включён и закрыт для всех ролей, кроме `service_role`. Ключ хранится только в `api_key_enc` с проверкой префикса `v2:`. Явный `grant ... to service_role` в файле нужен для Supabase Cloud, где новым таблицам права Data API не выдаются автоматически.

## 10. Проверки

`npm run check` запускает набор из `scripts/` (состав смотрите в `package.json`); `npm run lint` — проверка типов (`tsc --noEmit`), `npm run build` — сборка фронтенда. Все три выполняются в CI (`.github/workflows/ci.yml`; Node по `.nvmrc`), плюс компиляция `tone-service/app.py`.

| Проверка | Что ловит |
|---|---|
| `check-routes.mjs` (`npm run check:routes`) | Поднимает настоящий сервер без базы и без модели и сверяет ответы маршрутов (см. ниже) |
| `check-llm.ts` | Клиент модели на локальном http-моке: конфигурация, заголовок `Authorization`, `LLM_JSON_MODE`, таймаут, срезание ` ```json `, ошибки и их коды |
| `check-communication.ts` | Отбор пунктов разбора общения: пункты без дословной цитаты отбрасываются |
| `check-note-check.ts` | Отбор результата сверки протокола: цитаты, пропуски, пометка осмотра при дистанционном приёме |
| `check-layout-contract.ts` | Типы блоков рабочего поля на клиенте (`src/config/workspace.ts`) и список-разрешение на сервере (`src/server/workspaceLayout.ts`) не разошлись |
| `check-deidentify.ts` | Имена, телефоны, даты, номера не доходят до промпта; после ответа метки возвращаются буква в букву; проводка в `src/server` на месте |
| `check-db-client.ts` | Клиент базы: адрес, JWT `service_role`, срок токена; `readSecret` |
| `check-calculators.ts` (запускается через `vite-node`) | Реестр полей импортированных калькуляторов сходится с их функциями |

**Что ловит `check-routes.mjs`.** Скрипт запускает `server.ts` на свободном порту с `POSTGREST_URL`, указывающим в пустоту, и без настроек модели, затем проверяет:

- `GET /api/health` и заголовки безопасности (нет `x-powered-by`);
- для каждого защищённого маршрута (`/api/drafts`, `/api/guidelines`, `/api/workspace-layout`, `/api/ai/*`, `/api/stt/full`): без токена — 401; с полным токеном при недоступной базе — 503 (сессия не проверяется, отказ закрытый); с временным токеном 2FA — 403 (для `/api/drafts` и `/api/auth/profile`);
- 2FA-маршруты при выключенном `ENABLE_2FA`, отказ запроса с чужого сайта (403), неизвестный `/api/*` (404), слишком большой JSON (413);
- WebSocket: чужой путь рвётся без апгрейда, `/ws/stt/tone` без токена закрывается кодом 1008, с токеном при недоступной базе — 1011;
- лимит входа (11-й запрос подряд — 429).

Главное, что она страхует, — порядок подключения (раздел 5): маршрут, оказавшийся раньше защиты, ответил бы не 401, и проверка упала бы. Она не проверяет бизнес-логику, ответы с настоящей базой и качество ответов модели.
