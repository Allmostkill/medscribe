# Как помочь проекту

Спасибо за интерес к MedScribe. Ниже — что нужно знать перед тем, как открыть pull request.

## Перед PR

Запустите проверки и убедитесь, что они проходят (то же самое выполняет CI, `.github/workflows/ci.yml`):

```bash
npm run lint
npm run build
npm run check
```

`noUnusedLocals` в `tsconfig.json` не включён намеренно: ошибки только в сгенерированном `src/generated`; вручную проверить можно так: `npx tsc --noEmit --noUnusedLocals | grep -v src/generated`.

`npm run check` не требует Docker и базы. Что в него входит и что ловит проверка маршрутов — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#10-проверки). Если вы добавляете или меняете маршрут, обновите `scripts/check-routes.mjs` (порядок подключения защиты важен, см. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#5-порядок-middleware)). Версия Node — в `.nvmrc`, отступы и перевод строк — в `.editorconfig`.

## Локальная сборка

Собрать образы из исходников и запустить (без загрузки из GHCR):

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Если на этом компьютере стоит рабочая установка, задайте свой `COMPOSE_PROJECT_NAME` (см. раздел «Проверка установщика»). Иначе проект `medscribe` совпадёт с установкой, и `up` пересоздаст её контейнеры на тех же томах.

Образ `tone` при сборке скачивает с GitHub releases две небольшие модели разметки по голосу (около 35 МБ) и проверяет их sha256. Если сборка не смогла скачать модели или разметка не заводится, она падает. Если GitHub недоступен, соберите `tone` через зеркало, которое повторяет структуру путей GitHub releases:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build --build-arg DIAR_MODELS_BASE=https://адрес-зеркала tone
```

### Проверки разметки по голосу

- `python3 tone-service/test_diarize.py` проверяет чистую логику (разбор фраз по голосам и перенумерацию). Модели и sherpa-onnx для этого не нужны.
- `tone-service/tools/make_test_dialog.sh <папка> [2|3]` (на macOS, через `say` и ffmpeg) делает синтетический диалог: `dialog.wav` и эталон `dialog.truth.json`.
- `python3 tone-service/tools/eval_diarization.py <папка>/dialog.truth.json response.json` оценивает точность. `response.json` — ответ `/transcribe` на этом файле; как его получить, написано в шапке `eval_diarization.py`.

## Выпуск версии

1. Поднимите `version` в `package.json` и `package-lock.json`.
2. Поставьте тег `vX.Y.Z-rc.N` и отправьте его в GitHub.
3. Проверьте установку пререлиза в чистой папке:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/Allmostkill/medscribe/main/scripts/install.sh | MEDSCRIBE_VERSION=X.Y.Z-rc.N sh
   ```
4. Если проверка прошла, поставьте тег `vX.Y.Z`.
5. После первой публикации пакетов в GHCR откройте каждый пакет на GitHub и сделайте его **Public**. Иначе установка без входа в GHCR не скачает образы.

В пакете релиза образы закреплены по дайджесту (`образ:тег@sha256:…`): задача `release` берёт дайджесты у уже опубликованных образов и передаёт их в `scripts/release/make-bundle.sh`. К релизу также прикладываются `install.sh`, `install.ps1`, `install-server.sh` и их `.sha256`.

### Настройки GitHub (делает владелец репозитория, один раз)

- **Ветка `main`:** защита (Settings → Branches): слияние только через pull request, обязательные проверки CI, без force-push.
- **Теги `v*`:** правило защиты тегов (Settings → Tags или Rulesets): создавать, переписывать и удалять теги `v*` может только владелец.
- **Environment `release`** (Settings → Environments): включите Required reviewers и добавьте себя. Задача `release` ждёт одобрения, и без него релиз не публикуется.
- **Видимость пакетов GHCR:** `medscribe-app`, `medscribe-tone`, `medscribe-postgres`, `medscribe-postgrest`, `medscribe-caddy` — **Public**.

Подпись образов (cosign или `actions/attest-build-provenance`) пока не сделана: это следующий шаг. Сейчас целостность держится на дайджестах в пакете и на `.sha256` пакета.

### Обновление сторонних образов

Строки в `scripts/release/third-party-images.txt` закреплены по дайджесту. Новый дайджест: `docker buildx imagetools inspect mirror.gcr.io/library/<образ>:<тег> --format '{{.Manifest.Digest}}'` (для образов не из `library/` — `mirror.gcr.io/<владелец>/<образ>:<тег>`). Тег и дайджест меняйте вместе.

## Проверка установщика

Проверка на своём компьютере без опубликованных образов. Из корня репозитория:

```bash
scripts/release/local-images.sh 0.2.0-local
scripts/release/make-bundle.sh 0.2.0-local $HOME/medscribe-bundle-test
cat scripts/install.sh | COMPOSE_PROJECT_NAME=medscribe-test APP_PORT=3100 \
  MEDSCRIBE_DIR=$HOME/medscribe-test \
  MEDSCRIBE_BUNDLE_FILE=$HOME/medscribe-bundle-test/medscribe-bundle.tar.gz \
  MEDSCRIBE_NO_PULL=1 sh
```

Установщик проверит компьютер и запустит программу. Браузер откроется на `http://localhost:3100/setup#token=…`, а прогресс загрузки модели распознавания речи печатается по-русски.

Обновление этой же тестовой установки (`update.sh` ставит новую версию через установщик из файла):

```bash
cd $HOME/medscribe-test
MEDSCRIBE_INSTALLER_FILE=/путь/к/репозиторию/scripts/install.sh \
  MEDSCRIBE_BUNDLE_FILE=$HOME/medscribe-bundle-test/medscribe-bundle.tar.gz \
  MEDSCRIBE_NO_PULL=1 ./scripts/update.sh
```

Переменные для проверки:

- `MEDSCRIBE_BUNDLE_FILE` — взять пакет с диска вместо загрузки с GitHub (рядом должен лежать `.sha256`);
- `MEDSCRIBE_NO_PULL=1` — не загружать образы, брать уже собранные на компьютере;
- `MEDSCRIBE_INSTALLER_FILE` — для `update.sh`: установщик из файла вместо загрузки с GitHub.

**Осторожно с данными.** Всегда задавайте отдельный `COMPOSE_PROJECT_NAME` (например `medscribe-test`) и отдельную `MEDSCRIBE_DIR`. Без этого тестовая установка попадёт в проект `medscribe` и будет работать с рабочими томами. В папке с рабочей установкой не выполняйте `docker compose down -v`: команда удаляет тома с данными.

## Калькуляторы

Файлы в `src/generated` генерируются скриптом `scripts/import-calculators.mjs`
из отдельного репозитория калькуляторов (MedCalc). Не правьте их вручную: изменения
будут потеряны при следующей генерации, поэтому **правки в `src/generated` в PR не
принимаются**. Об ошибке в калькуляторе сообщите через issue: исправление делается в
исходном репозитории и переносится повторным запуском скрипта.

## Язык

Интерфейс, тексты промптов и комментарии в коде — на русском языке. Идентификаторы
(имена переменных, функций, файлов, полей) — на английском. Старые английские
комментарии допустимы; новые и изменённые пишите по-русски.

## Миграции схемы базы

Базовую схему `db/initdb/20-schema.sql` не меняйте: изменения оформляйте новой
миграцией в `db/migrations`. Правила — в [db/migrations/README.md](db/migrations/README.md).

## Данные пациентов

Никогда не прикладывайте к issue и PR данные пациентов: стенограммы, протоколы,
скриншоты и журналы с реальными данными, файлы `*.dump`, `.env`, ключи. Для примеров
используйте выдуманный текст.

## Лицензия вклада

Отправляя pull request, вы соглашаетесь, что ваш вклад распространяется под лицензией
AGPL-3.0-or-later (см. [LICENSE](LICENSE)).

## Медицинский контент

Дозировки, шкалы, критерии и любые клинические утверждения указывайте со ссылкой
на первоисточник (клинические рекомендации, инструкция к препарату, публикация).
Без источника такие изменения не принимаются.

## Безопасность

Уязвимости не обсуждаются в публичных issues. См. [SECURITY.md](SECURITY.md).
