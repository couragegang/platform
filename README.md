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

## Локальные секреты (`.env`)

```powershell
cd platform
copy .env.example .env
# Отредактируй .env: NOTION_SMOKE_TOKEN, NOTION_E2E_TOKEN (secret_... из Notion)
```

Файл `.env` в git не коммитится. Его читают `docker compose`, `smoke-test.ps1` и E2E pytest.

## Запуск

```powershell
cd platform
docker compose up --build
```

Первый старт: Flyway во всех сервисах + seed Notion в mcp.

## Smoke-тест

После `healthy` всех контейнеров:

```powershell
.\scripts\smoke-test.ps1
```

Скрипт: register → org → BFF `/api/me` → catalog → (опционально) install Notion → chat.

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

## Переменные (`.env` / compose)

См. [`.env.example`](.env.example): Notion-токены, `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, internal API keys.

## Отдельные compose

Каждый сервис можно поднять изолированно: `services/*/docker-compose.yml` (свой postgres на 5433–5435).
