# platform — локальный контур MVP

Единый **Docker Compose** для всех backend-сервисов (фаза 1).

## Сервисы

| Сервис | URL | БД |
|--------|-----|-----|
| postgres | localhost:5432 | `iam`, `config`, `mcp`, `policy` |
| iam-service | http://localhost:8080/v1/iam | `iam` |
| config-service | http://localhost:8084/v1/config | `config` |
| mcp-gateway | http://localhost:8081/v1/mcp | `mcp` |
| policy-service | http://localhost:8085/v1/policy | `policy` |
| audit-service | http://localhost:8086/v1/audit | `audit` |
| secrets-service | http://localhost:8087/v1/secrets | `secrets` |
| bff-gateway | http://localhost:8082/v1/bff | — |
| ai-runtime | http://localhost:8083/v1/ai | — |

## Контуры и секреты (local / test / prod)

Секреты **не попадают в слои Docker-образа**. Перед сборкой генерируется `build/runtime.env` (см. [`config/contours/README.md`](config/contours/README.md)):

| Контур | Откуда секреты |
|--------|----------------|
| **local** | `platform/.env` + `config/contours/local.env` |
| **test** | GitHub Environment `test` (CI) или `test.env` |
| **prod** | GitHub Environment `prod` (обязательные secrets) |

```powershell
cd platform
copy .env.example .env
# NOTION_*, JWT_SECRET, DEEPSEEK_API_KEY — по необходимости

.\scripts\fetch-build-secrets.ps1 -Contour local
.\scripts\build-stack.ps1 -Contour local -Up -Detach
# или: docker compose up --build
```

В Dockerfile передаётся только метка `DEPLOY_CONTOUR` (build-arg).

## Запуск (кратко)

```powershell
cd platform
.\scripts\fetch-build-secrets.ps1 -Contour local
docker compose up --build
```

Первый старт: Flyway во всех сервисах + seed Notion в mcp.

## Smoke-тест

После `healthy` всех контейнеров:

```powershell
.\scripts\smoke-test.ps1
```

```bash
chmod +x scripts/smoke-test.sh && ./scripts/smoke-test.sh
```

Скрипт: health (9 сервисов) → register → BFF `/api/me` → catalog → (опционально) install Notion → chat → knowledge connectors.

Pytest-эквивалент: `cd tests/e2e && pytest -m smoke`.

## E2E интеграционные тесты (pytest)

Полное покрытие сценариев **P1**, **K1–K8**, **A1–A9** (где API уже есть) — [`tests/e2e/README.md`](tests/e2e/README.md).

```powershell
docker compose up --build
.\scripts\run-e2e.ps1
```

С реальным Notion — достаточно заполнить `NOTION_E2E_TOKEN` в `.env`:

```powershell
.\scripts\run-e2e.ps1 -m notion
```

## Переменные (`.env` / `build/runtime.env`)

См. [`.env.example`](.env.example) и [`config/contours/secret-keys.txt`](config/contours/secret-keys.txt).

**GitHub:** создайте Environments `test` и `prod`, добавьте secrets с теми же именами — workflows `e2e.yml` и `build-images.yml` подставят их при сборке.

## Деплой на VPS

Конфиг **внутри образов** (без `.env` на сервере). Workflow **[`deploy-vps.yml`](.github/workflows/deploy-vps.yml)**:

1. Секреты из GitHub Environment `prod` → bake → push **GHCR**
2. SSH на VPS: `docker compose pull` + `up -d`

Инструкция: [`deploy/vps/README.md`](deploy/vps/README.md).

## Отдельные compose

Каждый сервис можно поднять изолированно: `services/*/docker-compose.yml` (свой postgres на 5433–5435).
