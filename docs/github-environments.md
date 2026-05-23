# GitHub Environments для сборки образов

## 1. Создать environments

В репозитории **platform** (`couragegang/platform`):

**Settings → Environments → New environment**

- `test` — CI (E2E, сборка на `main` / PR)
- `prod` — продакшен-сборка (`workflow_dispatch` → contour `prod`)

## 2. Secrets (одинаковые имена в test и prod)

Минимум для **prod** (обязательны скриптом `fetch-build-secrets`):

| Secret | Описание |
|--------|----------|
| `JWT_SECRET` | ≥ 32 байт hex для IAM JWT |
| `SECRETS_ENCRYPTION_KEY` | 32 байт hex для AES-GCM |
| `CONFIG_INTERNAL_API_KEY` | Internal API config-service |
| `POLICY_INTERNAL_API_KEY` | Internal API policy-service |
| `SECRETS_INTERNAL_API_KEY` | Internal API secrets-service |
| `AUDIT_INTERNAL_API_KEY` | Internal API audit-service |
| `DB_PASSWORD` | Пароль PostgreSQL |

Опционально:

| Secret | Описание |
|--------|----------|
| `DEEPSEEK_API_KEY` | LLM в ai-runtime |
| `NOTION_E2E_TOKEN` | Live Notion в E2E |
| `OIDC_*` | Google/GitHub OAuth |

Полный список: [`config/contours/secret-keys.txt`](../config/contours/secret-keys.txt).

## 3. Variables (не секреты)

**Environment `test`** → **Variables**:

| Variable | Пример |
|----------|--------|
| `LLM_PROVIDER` | `stub` |

## 4. Как это попадает в Docker

1. Workflow задаёт `environment: test` или `prod`.
2. Secrets мапятся в `env` job (см. `e2e.yml`, `build-images.yml`).
3. `scripts/fetch-build-secrets.sh` пишет `build/runtime.env`.
4. `docker compose build` получает `DEPLOY_CONTOUR` как build-arg (метка в образе).
5. `docker compose up` читает `build/runtime.env` в контейнеры (**runtime**, не в слои образа).

## 5. Локально

Секреты из GitHub **не нужны** — достаточно `platform/.env` и контура `local`:

```powershell
.\scripts\fetch-build-secrets.ps1 -Contour local
docker compose build
```

## 6. VPS (prod, конфиг в образе)

См. [`deploy/vps/README.md`](../deploy/vps/README.md) и workflow **`deploy-vps.yml`**: секреты вшиваются при `docker build --target baked`, на сервере нет `.env`.
