# Postman — отладка platform stack

## Импорт

1. Postman → **Import** → выберите оба файла:
   - `platform-debug.postman_collection.json`
   - `platform-local.postman_environment.json`
2. В правом верхнем углу выберите окружение **Platform — local (docker compose)**.

## Предусловия

```powershell
cd platform
docker compose up -d --build
```

Дождитесь health на портах 8080–8088 (как в E2E: `platform/tests/e2e`).

## Быстрый старт

1. Папка **00 Setup** → Run folder (или по порядку: Register → Me → Org → Workspaces).
2. **01 Health & metrics** — smoke всех сервисов.
3. Доменные папки **02–10** — по задаче.

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `accessToken`, `refreshToken` | JWT после Register/Login |
| `userId`, `orgId`, `workspaceId` | Контекст после Setup |
| `installationId`, `conversationId`, `secretRef` | Заполняются тестами запросов |
| `notionToken` | Реальный Notion token для Install Notion (опционально) |
| `*InternalKey` | `dev-internal-key` для local (из `platform/.env`) |

## Порты (local compose)

| Сервис | Порт | Base URL |
|--------|------|----------|
| IAM | 8080 | `http://localhost:8080/v1/iam` |
| MCP | 8081 | `http://localhost:8081/v1/mcp` |
| BFF | 8082 | `http://localhost:8082/v1/bff` |
| AI | 8083 | `http://localhost:8083/v1/ai` |
| Config | 8084 | `http://localhost:8084/v1/config` |
| Policy | 8085 | `http://localhost:8085/v1/policy` |
| Audit | 8086 | `http://localhost:8086/v1/audit` |
| Secrets | 8087 | `http://localhost:8087/v1/secrets` |
| Knowledge | 8088 | `http://localhost:8088/v1/knowledge` |

Контракты: `services/api-contracts/`.
