# Runbook: запуск платформы во всех контурах

Единый гайд для **local** (разработка), **CI**, **VPS test** (staging) и **VPS prod** (production).

Связанные документы:

- [Контуры и секреты](../config/contours/README.md)
- [GitHub Environments](github-environments.md)
- [Git-flow и CI](service-git-workflow.md)
- [Деплой на VPS](../deploy/vps/README.md)
- [E2E pytest](../tests/e2e/README.md)

---

## 1. Карта контуров

| Контур | Где выполняется | Образы Docker | Секреты | Host-порты API |
|--------|-----------------|---------------|---------|----------------|
| **local** | Ваша машина | Сборка из исходников (`target: local`) | `platform/.env` → `build/runtime.env` | **8080–8088** |
| **CI (test env)** | GitHub Actions | Сборка из исходников в runner | GitHub Environment **`test`** | localhost в job |
| **VPS test** | Сервер staging | Pull из GHCR (`*-test`) | Вшиты при bake (Environment **test**) | **18080–18088** |
| **VPS prod** | Сервер production | Pull из GHCR (`*-prod`) | Вшиты при bake (Environment **prod**) | **8080–8088** |

Сервисы и порты (внутри контейнера всегда 808x; на host — см. таблицу):

| Сервис | Порт | Health (local / prod) | Health (VPS test) |
|--------|------|------------------------|-------------------|
| iam | 8080 | `http://localhost:8080/v1/iam/health` | `http://<host>:18080/v1/iam/health` |
| mcp | 8081 | `:8081` | `:18081` |
| bff | 8082 | `:8082` | `:18082` |
| ai | 8083 | `:8083` | `:18083` |
| config | 8084 | `:8084` | `:18084` |
| policy | 8085 | `:8085` | `:18085` |
| audit | 8086 | `:8086` | `:18086` |
| secrets | 8087 | `:8087` | `:18087` |
| knowledge | 8088 | `:8088` | `:18088` |
| postgres | 5432 | `localhost:5432` | не проброшен наружу на VPS |

---

## 2. Структура репозиториев (воркспейс)

Рекомендуемая раскладка на диске:

```text
ai-startup/
├── platform/              # docker-compose, CI, E2E, deploy/vps
├── cursor-context/        # handoff, ERD, UI-сценарии
└── services/
    ├── iam-service/
    ├── config-service/
    ├── mcp-gateway/
    ├── bff-gateway/
    ├── ai-runtime/
    ├── policy-service/
    ├── secrets-service/
    ├── audit-service/
    ├── knowledge-service/
    └── api-contracts/     # канон OpenAPI (деплой не триггерит)
```

Все сервисы — отдельные git-репозитории org **`couragegang`**. Ветки: **`test`** (staging), **`main`** (prod).

---

## 3. Локальный контур (local)

### 3.1. Требования

- **Docker Desktop** (или Docker Engine + Compose v2)
- **Python 3.10+** — для pytest E2E
- Клонированы `platform` и микросервисы в `services/` (как в таблице выше)
- JDK 21 — только если собираете Gradle **на хосте**; для compose достаточно Docker

### 3.2. Первичная настройка (один раз)

```powershell
cd platform
copy .env.example .env
# Отредактируйте .env: JWT_SECRET, SECRETS_ENCRYPTION_KEY, internal keys (см. .env.example)
```

Минимум для старта стека — значения из `.env.example` (dev-ключи). Для live Notion/DeepSeek — опциональные переменные в том же файле.

### 3.3. Запуск стека

**Вариант A (рекомендуется):**

```powershell
cd platform
.\scripts\build-stack.ps1 -Contour local -Up -Detach
```

**Вариант B (вручную):**

```powershell
cd platform
.\scripts\fetch-build-secrets.ps1 -Contour local
$env:DEPLOY_CONTOUR = "local"
docker compose up -d --build
```

**Linux/macOS:**

```bash
cd platform
./scripts/fetch-build-secrets.sh local
export DEPLOY_CONTOUR=local
docker compose up -d --build
```

Скрипт `fetch-build-secrets` читает `platform/.env` и `config/contours/local.env`, пишет **`platform/build/runtime.env`** (в git не коммитится). Compose подключает его через `env_file`.

### 3.4. Проверка, что всё поднялось

```powershell
# PowerShell
@(8080..8088) | ForEach-Object {
  $p = $_
  try {
    Invoke-WebRequest "http://localhost:$p/v1/$(switch ($p) {
      8080 {'iam'} 8081 {'mcp'} 8082 {'bff'} 8083 {'ai'} 8084 {'config'}
      8085 {'policy'} 8086 {'audit'} 8087 {'secrets'} 8088 {'knowledge'}
    })/health" -UseBasicParsing -TimeoutSec 3 | Out-Null
    Write-Host "OK :$p"
  } catch { Write-Host "FAIL :$p" }
}
```

Или скрипт smoke:

```powershell
cd platform
.\scripts\smoke-test.ps1
```

### 3.5. Остановка и очистка

```powershell
cd platform
docker compose down          # остановить
docker compose down -v       # + удалить volume postgres
```

### 3.6. Локальные тесты

#### Unit + JaCoCo (все Java-сервисы)

```powershell
cd platform
.\scripts\verify-service-coverage.ps1              # все 9 BC, по одному
.\scripts\verify-service-coverage.ps1 -Parallel 4  # все 9 BC, ~4–6 мин (рекомендуется)
.\scripts\verify-service-coverage.ps1 -Services iam-service
.\scripts\verify-service-coverage.ps1 -UseLocalGradle   # без Docker, нужен JDK 21 на PATH
```

Порог: branch coverage **≥ 80%** в каждом BC. По умолчанию Gradle в Docker (`gradle:8.10.2-jdk21`), кэш `~/.gradle` монтируется в контейнер. `push-if-green.ps1` вызывает скрипт с `-Parallel 4`.

#### E2E pytest (полный стек platform)

Стек должен быть запущен (§3.3).

```powershell
cd platform
.\scripts\run-smoke.ps1                    # быстрый smoke
.\scripts\run-e2e.ps1 -m "phase1 or k or a"   # полный набор
```

Или из каталога тестов:

```powershell
cd platform\tests\e2e
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\pytest -m smoke
.\.venv\Scripts\pytest -m regress
```

#### Functional-тесты одного микросервиса

В репозитории BC (например `iam-service`), при поднятом **полном** compose из `platform/`:

```powershell
cd services\iam-service
$env:PLATFORM_ROOT = "..\..\platform"
$env:SERVICES_ROOT = ".."   # каталог services/
$env:SERVICE_ID = "iam"
$env:SUITE = "smoke"        # или regress
..\..\platform\scripts\run-functional-tests.sh
```

На Linux задайте те же переменные и вызовите `platform/scripts/run-functional-tests.sh`.

#### Gate «всё зелёное» перед push

```powershell
cd platform
.\scripts\push-if-green.ps1              # coverage + E2E + push соседних репо
.\scripts\push-if-green.ps1 -SkipE2e    # только unit/coverage
```

---

## 4. CI (GitHub Actions)

### 4.1. Какой контур в CI

| Workflow | Репозиторий | Environment | Что делает |
|----------|-------------|-------------|------------|
| **E2E integration tests** | `platform` | `test` | compose + pytest smoke; regress — только для PR/push в **`main`** |
| **Unit tests** | каждый BC | — | `gradle test jacocoTestCoverageVerification` |
| **Functional tests** | каждый BC | `test` | compose + pytest smoke/regress по целевой ветке PR |
| **Deploy to VPS** | `platform` | `test` или `prod` | bake → GHCR → SSH `up.sh` |
| **API contracts quality** | `api-contracts` | — | зеркала OpenAPI + Redocly |

### 4.2. Smoke vs regress в CI

| Событие | Набор pytest |
|---------|----------------|
| PR / push в **`test`** | `-m smoke` |
| PR / push в **`main`** | `-m regress` (smoke + полный regress) |

Логика: [`scripts/resolve-functional-suite.sh`](../scripts/resolve-functional-suite.sh).

### 4.3. Merge gate (кнопка Merge)

Пока не зелёные required checks, merge заблокирован:

| Репо | Checks |
|------|--------|
| BC | `Unit tests / gradle`, `Functional tests / pytest` |
| platform | `E2E integration tests / e2e` |
| api-contracts | contract-freshness, redocly-lint |

Применить правила (admin, один раз после настройки workflows):

```powershell
cd platform
.\scripts\apply-branch-protection.ps1
.\scripts\apply-bc-branch-protection.ps1
.\scripts\apply-branch-protection.ps1 -Repo couragegang/api-contracts -Contracts
```

В **каждом BC** нужен GitHub Environment **`test`** с секретами (те же имена, что в [`secret-keys.txt`](../config/contours/secret-keys.txt)), иначе functional-tests упадут.

### 4.4. Деплой из CI (автоматически)

| Действие | Результат |
|----------|-----------|
| Merge в **`test`** (любой BC или platform) | VPS **test**, тег `<sha>-test` |
| Merge в **`main`** | VPS **prod**, тег `<sha>-prod` |
| Push в BC | `repository_dispatch` → platform **Deploy to VPS** (один сервис) |
| Push в platform (paths `deploy/`, `config/`) | полный деплой всех сервисов |

Секрет BC: **`PLATFORM_DEPLOY_TOKEN`** → PAT с правом dispatch в `couragegang/platform`.

---

## 5. VPS test (staging)

### 5.1. Однократная подготовка сервера

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# перелогиниться
sudo mkdir -p /opt/couragegang-test /opt/couragegang-prod
sudo chown -R $USER:$USER /opt/couragegang-test /opt/couragegang-prod
```

Файлы `docker-compose.yml`, `up.sh`, `docker-compose.ports-*.yml` копирует workflow **Deploy to VPS** в `/opt/couragegang-test`.

### 5.2. Автодеплой (штатный путь)

1. Merge PR в **`test`** (микросервис или platform).
2. GitHub Actions: **platform → Deploy to VPS** (environment **test**).
3. На VPS: pull образов `ghcr.io/couragegang/<service>:<sha>-test` и `docker compose up`.

Проверка на сервере:

```bash
docker ps --filter name=couragegang-test
curl -sf http://localhost:18080/v1/iam/health
curl -sf http://localhost:18082/v1/bff/health
```

У контейнеров **test** на host должны быть **только** порты **18080–18088**, без **8080–8088** (см. §7.1).

### 5.3. Ручной деплой / откат на VPS

```bash
cd /opt/couragegang-test
unset COMPOSE_FILE
export DEPLOY_CONTOUR=test
export IMAGE_OWNER=couragegang

# Логин в GHCR (для ручного pull; CI делает сам)
echo "$GITHUB_PAT" | docker login ghcr.io -u couragegang --password-stdin

# Полный стек с тегом коммита
bash ./up.sh abc123def456-test

# Только один сервис (остальные теги из image-tags.env)
bash ./up.sh abc123def456-test ai
```

Теги образов: `ghcr.io/couragegang/iam-service:<sha>-test`, алиас `test-latest`.

### 5.4. Проверка staging с вашей машины

Подставьте IP/домен VPS и порт **18082** для BFF:

```bash
curl -s "http://<VPS>:18080/v1/iam/health"
curl -s "http://<VPS>:18082/v1/bff/health"
```

Для OIDC redirect в GitHub Environment **test** задайте Variable **`VPS_PUBLIC_BASE_URL`** (публичный URL API).

---

## 6. VPS prod (production)

Аналогично **test**, но:

| | test | prod |
|--|------|------|
| Каталог | `/opt/couragegang-test` | `/opt/couragegang-prod` |
| `DEPLOY_CONTOUR` | `test` | `prod` |
| Тег образа | `<sha>-test` | `<sha>-prod` |
| Host-порты | 18080–18088 | 8080–8088 |
| Триггер CI | merge в **`test`** | merge в **`main`** |
| GitHub Environment | **test** | **prod** |

Ручной запуск:

```bash
cd /opt/couragegang-prod
unset COMPOSE_FILE
export DEPLOY_CONTOUR=prod IMAGE_OWNER=couragegang
bash ./up.sh <sha>-prod
```

**Важно:** секреты test и prod **разные** (отдельные значения в GitHub Environments). Образы разведены тегами — не подмешивайте `*-test` на prod-каталог.

---

## 7. Типовые проблемы

### 7.1. `address already in use` на 8080 при деплое test

**Причина:** на одном VPS крутятся test и prod; старый compose дублировал порты 808x и 1808x.

**Решение:** обновить `deploy/vps` из platform, перезапустить:

```bash
cd /opt/couragegang-test
unset COMPOSE_FILE
export DEPLOY_CONTOUR=test IMAGE_OWNER=couragegang
bash ./up.sh <sha>-test
```

Проверка: `docker ps` — у `couragegang-test-*` только **1808x**.

### 7.2. GHCR: `unauthorized` при push образов

Org **Settings → Actions → Workflow permissions → Read and write**. В workflow login: org + `GITHUB_TOKEN`. Подробнее: [github-environments.md](github-environments.md) §7.

### 7.3. GHCR: `403` при pull на VPS

CI deploy логинится через `GITHUB_TOKEN` job. Для ручного pull — PAT с `read:packages` или org machine user, не личный аккаунт как org.

### 7.4. Сервисы не healthy после `compose up`

```powershell
cd platform
docker compose ps
docker compose logs iam --tail=80
```

Часто: неверный `build/runtime.env` — перегенерируйте `fetch-build-secrets.ps1 -Contour local`.

### 7.5. E2E падает на DB-тестах

Нужен доступ к Docker из pytest (`docker compose exec`). Отключить проверку БД: `$env:E2E_DB_VERIFY = "0"`.

---

## 8. Шпаргалка команд

### Local — поднять / проверить / тесты

```powershell
cd platform
.\scripts\build-stack.ps1 -Contour local -Up -Detach
.\scripts\smoke-test.ps1
.\scripts\run-e2e.ps1 -m regress
.\scripts\verify-service-coverage.ps1
docker compose down
```

### Git — feature → test → main

```bash
git checkout test && git pull
git checkout -b feature/my-change
# ... коммиты ...
# PR → test  →  CI smoke  →  merge  →  деплой VPS test
# PR test → main  →  CI regress  →  merge  →  деплой VPS prod
```

### VPS — статус

```bash
docker ps --filter name=couragegang-test
docker ps --filter name=couragegang-prod
curl -sf http://localhost:18080/v1/iam/health   # test
curl -sf http://localhost:8080/v1/iam/health    # prod
```

### OpenAPI — синхронизация зеркала в BC

```powershell
cd services\api-contracts
.\scripts\sync-openapi-mirror.ps1 -Id iam
```

---

## 8. Grafana и Prometheus

| Компонент | Local | VPS |
|-----------|-------|-----|
| Grafana UI | http://localhost:3000 | http://`<VPS>`:3000 |
| Prometheus | **один** контейнер `:9090` → scrape **8080–8088** | **два**: test (1808x) + prod (808x) |
| Data source в Grafana | **Prometheus-Prod** | **Prometheus-Test** + **Prometheus-Prod** |

**Local:**

```powershell
cd platform
docker compose up -d --build
cd deploy\observability
copy .env.example .env
.\up-local.ps1
```

**VPS:** `/opt/couragegang-observability`, `OBSERVABILITY_PROFILE=vps ./up.sh`, workflow **Deploy observability**.

Подробнее: [`deploy/observability/README.md`](../deploy/observability/README.md).

---

## 9. Что куда смотреть дальше

| Задача | Документ |
|--------|----------|
| Список секретов | [`config/contours/secret-keys.txt`](../config/contours/secret-keys.txt) |
| UI / API сценарии | [`cursor-context/docs/ui-api-scenarios.md`](../../cursor-context/docs/ui-api-scenarios.md) |
| Handoff для агента | [`cursor-context/context.md`](../../cursor-context/context.md) |
| Grafana / Prometheus | [`deploy/observability/README.md`](../deploy/observability/README.md) |
| Контракты OpenAPI | [`services/api-contracts/README.md`](../../services/api-contracts/README.md) |

*Документ актуален для ветки `test` платформы (контуры local / CI test / VPS test+prod, порты 808x / 1808x).*
