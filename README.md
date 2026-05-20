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

## Переменные (внутри compose)

- Internal keys (`dev-internal-key`): `CONFIG_`, `POLICY_`, `SECRETS_`, `AUDIT_`
- `SECRETS_ENCRYPTION_KEY`: dev-only AES key (32 bytes)
- `JWT_SECRET`: dev-only (см. `docker-compose.yml`)

## Отдельные compose

Каждый сервис можно поднять изолированно: `services/*/docker-compose.yml` (свой postgres на 5433–5435).
