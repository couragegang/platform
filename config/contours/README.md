# Контуры развёртывания (local / test / prod)

**Полный runbook (запуск, тесты, VPS, troubleshooting):** [`docs/runbook-all-contours.md`](../docs/runbook-all-contours.md).

Три контура с единым списком ключей ([`secret-keys.txt`](secret-keys.txt)):

| Контур | Где крутится | Секреты | Docker target |
|--------|--------------|---------|---------------|
| **local** | Машина разработчика | `platform/.env` + `local.env` → `build/runtime.env` | `local` |
| **test** | GitHub E2E + **VPS staging** | GitHub Environment **`test`** → bake в образ | `baked` |
| **prod** | **VPS production** | GitHub Environment **`prod`** → bake в образ | `baked` |

## Local / CI без bake

Перед `docker compose build` (обычный `docker-compose.yml`):

```powershell
.\scripts\fetch-build-secrets.ps1 -Contour local
docker compose up --build
```

Секреты в **`build/runtime.env`**, в образ **не** попадают.

## VPS (test и prod)

Оба контура деплоятся **одинаково**: bake → GHCR → pull на VPS. Отличия — **секреты**, **тег образа**, **каталог на сервере**, **порты** (если test и prod на одном хосте).

| | **test** (staging) | **prod** |
|--|-------------------|----------|
| GitHub Environment | `test` | `prod` |
| Каталог на VPS | `/opt/couragegang-test` | `/opt/couragegang-prod` |
| Тег образа | `<sha>-test`, `test-latest` | `<sha>-prod`, `prod-latest` |
| Host-порты (если оба на одном VPS) | **18080–18088** | 8080–8088 |
| Публичный URL (OIDC) | Variable `VPS_PUBLIC_BASE_URL` в env **test** | Variable в env **prod** |

Workflow: [`.github/workflows/deploy-vps.yml`](../.github/workflows/deploy-vps.yml)

**Мониторинг (Grafana):** один стек на VPS — [`deploy/observability/README.md`](../deploy/observability/README.md), workflow **Deploy observability** (data source **Prometheus-Test** / **Prometheus-Prod**).

- **Merge в `test`** (любой BC или `platform`) → деплой VPS **test**.
- **Merge в `main`** → деплой VPS **prod**.
- Ручной запуск: **Actions → Deploy to VPS**.

См. [`docs/service-git-workflow.md`](../docs/service-git-workflow.md).

На сервере:

```bash
cd /opt/couragegang-test   # или couragegang-prod
DEPLOY_CONTOUR=test IMAGE_TAG=abc123-test ./up.sh
```

## GitHub Environments

Создать **`test`** и **`prod`** в репозитории **platform**.

В **обоих** — одинаковые **имена** secrets (значения разные), см. [`secret-keys.txt`](secret-keys.txt).

Для VPS в **test** и **prod** нужны как минимум:

- `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `*_INTERNAL_API_KEY`, `DB_PASSWORD`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_PULL_TOKEN`

Variables:

- `VPS_PUBLIC_BASE_URL` — базовый URL API для OIDC redirect (разный для test/prod)
- `LLM_PROVIDER` — `stub` или `deepseek`

Подробнее: [`docs/github-environments.md`](../docs/github-environments.md), [`deploy/vps/README.md`](../deploy/vps/README.md).

## Команды bake локально

```bash
export DEPLOY_CONTOUR=test
./scripts/prepare-baked-build.sh test
DEPLOY_CONTOUR=test docker compose -f docker-compose.bake.yml build
```
