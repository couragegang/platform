# Деплой на VPS (без `.env` на сервере)

Конфиг и секреты **вшиты в образы** на этапе CI (`docker build --target baked`). На VPS только:

```bash
cd /opt/couragegang
IMAGE_TAG=<git-sha> ./up.sh
```

## Однократная настройка VPS

```bash
# на сервере
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo mkdir -p /opt/couragegang && sudo chown $USER:$USER /opt/couragegang
```

Файлы `docker-compose.yml` и `up.sh` копирует GitHub Actions (`deploy-vps.yml`) или вручную из `platform/deploy/vps/`.

## GitHub Environment `prod`

### Secrets (обязательные)

| Secret | Назначение |
|--------|------------|
| `JWT_SECRET` | IAM |
| `SECRETS_ENCRYPTION_KEY` | secrets-service |
| `CONFIG_INTERNAL_API_KEY` | internal API |
| `POLICY_INTERNAL_API_KEY` | internal API |
| `SECRETS_INTERNAL_API_KEY` | internal API |
| `AUDIT_INTERNAL_API_KEY` | internal API |
| `DB_PASSWORD` | Postgres (в образе `platform-postgres`) |
| `VPS_HOST` | IP/hostname VPS |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | приватный ключ SSH |
| `GHCR_PULL_TOKEN` | PAT `read:packages` для pull на VPS |

### Secrets (опционально)

`DEEPSEEK_API_KEY`, `OIDC_*`, `NOTION_*`

### Variables

| Variable | Пример |
|----------|--------|
| `VPS_PUBLIC_BASE_URL` | `https://api.example.com` (OIDC redirect в IAM) |
| `IMAGE_OWNER` | `couragegang` (если org не совпадает с `github.repository_owner`) |
| `LLM_PROVIDER` | `deepseek` или `stub` |

## Workflow

[`.github/workflows/deploy-vps.yml`](../../.github/workflows/deploy-vps.yml):

1. `prepare-baked-build.sh prod` — секреты из GitHub → `services/*/docker/runtime-baked.env`
2. `docker compose -f docker-compose.bake.yml build` + `push` → GHCR
3. SSH: `docker compose pull && up -d`

Ручной запуск: **Actions → Deploy to VPS → Run workflow**.

## Образы GHCR

`ghcr.io/<owner>/iam-service:<sha>`  
`ghcr.io/<owner>/platform-postgres:<sha>`  
… и тег `prod-latest` на ветке `main`.

## Безопасность

Секреты попадают в **слои образа** — любой с доступом к registry может их извлечь. Для строгой изоляции позже: runtime secrets (Vault) + образы без bake.

Пакеты GHCR для приватных образов: выдайте `GHCR_PULL_TOKEN` только на VPS read-only.
