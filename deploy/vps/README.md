# Деплой на VPS (контуры test и prod)

Конфиг и секреты **вшиты в образы** на этапе CI (`docker build --target baked`). На VPS нет `.env` — только pull и `up.sh`.

## Два контура на VPS

| Контур | Назначение | Путь на VPS | Тег GHCR |
|--------|------------|-------------|----------|
| **test** | Staging / приёмочный стенд | `/opt/couragegang-test` | `<sha>-test`, `test-latest` |
| **prod** | Production | `/opt/couragegang-prod` | `<sha>-prod`, `prod-latest` |

**test** и **prod** на **одном** VPS: у test host-порты **18080–18088** (оверлей `docker-compose.ports-test.yml`), у prod — **8080–8088**.

## Однократная настройка VPS

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo mkdir -p /opt/couragegang-test /opt/couragegang-prod
sudo chown -R $USER:$USER /opt/couragegang-test /opt/couragegang-prod
```

Файлы compose и `up.sh` копирует GitHub Actions в нужный каталог.

## GitHub Environments

Секреты задаются **отдельно** в Environment **`test`** и **`prod`** (одинаковые имена, разные значения).

### Обязательные secrets (в test и prod)

| Secret | Назначение |
|--------|------------|
| `JWT_SECRET` | IAM |
| `SECRETS_ENCRYPTION_KEY` | secrets-service |
| `CONFIG_INTERNAL_API_KEY` | internal API |
| `POLICY_INTERNAL_API_KEY` | internal API |
| `SECRETS_INTERNAL_API_KEY` | internal API |
| `AUDIT_INTERNAL_API_KEY` | internal API |
| `DB_PASSWORD` | Postgres в образе `platform-postgres` |
| `VPS_HOST` | IP/hostname (может совпадать для test/prod) |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | приватный SSH-ключ |
| `GHCR_PULL_TOKEN` | PAT `read:packages` для pull на VPS |
| `GHCR_PULL_USER` (variable) | Username владельца PAT (напр. `d3byte`), **не** org `couragegang` |

### Variables (разные для test и prod)

| Variable | Пример test | Пример prod |
|----------|-------------|-------------|
| `VPS_PUBLIC_BASE_URL` | `https://test-api.example.com` | `https://api.example.com` |
| `LLM_PROVIDER` | `stub` | `deepseek` |
| `IMAGE_OWNER` | `couragegang` | то же |

Опциональные secrets: `DEEPSEEK_API_KEY`, `OIDC_*`, `NOTION_*`.

## Workflow

[`.github/workflows/deploy-vps.yml`](../../.github/workflows/deploy-vps.yml):

1. `environment: test` или `prod` → secrets/vars из соответствующего Environment.
2. Клон всех BC с ветки **`test`** или **`main`** (по контуру).
3. `prepare-baked-build.sh <contour>` → bake → push GHCR.
4. SSH в `/opt/couragegang-<contour>` → `./up.sh <sha>-<contour>` (все) или `./up.sh <sha>-<contour> ai` (только ai-runtime).

Merge в микросервис → **single** (один образ). Push в **platform** (deploy paths) → **all**.

### Триггеры

| Событие | Контур |
|---------|--------|
| **Merge / push в `test`** в любом микросервисе | **test** |
| **Merge / push в `main`** в любом микросервисе | **prod** |
| Push в **`platform`** (`test` / `main`, paths deploy/config) | test / prod |
| **Actions → Deploy to VPS** (ручной) | выбор |

Микросервисы: [`.github/workflows/trigger-deploy.yml`](../../templates/service-trigger-deploy.yml) + секрет **`PLATFORM_DEPLOY_TOKEN`**.

Git-flow: [`docs/service-git-workflow.md`](../../docs/service-git-workflow.md).

## Ручной запуск на VPS

```bash
cd /opt/couragegang-test
unset COMPOSE_FILE
sed -i 's/\r$//' up.sh docker-compose.yml docker-compose.ports-test.yml
ls -la docker-compose.yml docker-compose.ports-test.yml up.sh
export DEPLOY_CONTOUR=test IMAGE_OWNER=couragegang
bash ./up.sh abc123def-test
```

Если ошибка `stat ... docker-compose.yml docker-compose.ports-test.yml` — на сервере **старый** `up.sh` или в shell задан `COMPOSE_FILE` с пробелом. Обновите `up.sh` из репозитория и выполните `unset COMPOSE_FILE`.

## Образы GHCR

`ghcr.io/<owner>/iam-service:<sha>-test`  
`ghcr.io/<owner>/iam-service:test-latest`  

Аналогично для prod: `*-prod`, `prod-latest`.

## Безопасность

Секреты в **слоях образа** — отдельные образы для test и prod, разные registry-теги. Доступ к GHCR ограничить; для строгой изоляции позже — runtime secrets без bake.
