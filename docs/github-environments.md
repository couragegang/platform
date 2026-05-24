# GitHub Environments для сборки и деплоя

## 1. Branch protection (`test`, `main`)

В **platform** и BC: PR + 1 approval, bypass для maintainer, auto-approve workflow (если org разрешает Actions approve PR). Подробности — [`service-git-workflow.md`](service-git-workflow.md) § «Protected branches».

## 2. Создать environments

В репозитории **platform** (`couragegang/platform`):

**Settings → Environments → New environment**

| Environment | Назначение |
|-------------|------------|
| **`test`** | CI E2E, сборка `build-images`, **VPS staging** (`/opt/couragegang-test`) |
| **`prod`** | **VPS production** (`/opt/couragegang-prod`) |

## 3. Secrets (одинаковые имена в test и prod, разные значения)

Минимум для bake и VPS:

| Secret | Описание |
|--------|----------|
| `JWT_SECRET` | ≥ 32 байт hex для IAM JWT |
| `SECRETS_ENCRYPTION_KEY` | 32 байт hex для AES-GCM |
| `CONFIG_INTERNAL_API_KEY` | Internal API config-service |
| `POLICY_INTERNAL_API_KEY` | Internal API policy-service |
| `SECRETS_INTERNAL_API_KEY` | Internal API secrets-service |
| `AUDIT_INTERNAL_API_KEY` | Internal API audit-service |
| `DB_PASSWORD` | Пароль PostgreSQL (свой для test и prod) |
| `VPS_HOST` | IP/hostname VPS |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | Приватный SSH-ключ |
| `GRAFANA_ADMIN_PASSWORD` | Пароль admin Grafana (workflow **Deploy observability**) |
| `GHCR_PULL_TOKEN` | *(опционально)* PAT для ручного `docker pull` на VPS вне CI; в **deploy-vps** pull идёт через `GITHUB_TOKEN` + org `${{ github.repository_owner }}` |

Опционально:

| Secret | Описание |
|--------|----------|
| `DEEPSEEK_API_KEY` | LLM в ai-runtime |
| `NOTION_E2E_TOKEN` | Live Notion в E2E |
| `OIDC_*` | Google/GitHub OAuth |

Полный список: [`config/contours/secret-keys.txt`](../config/contours/secret-keys.txt).

## 4. Variables (не секреты)

Задайте **отдельно** в `test` и `prod`:

| Variable | test (пример) | prod (пример) |
|----------|---------------|---------------|
| `LLM_PROVIDER` | `stub` | `deepseek` |
| `VPS_PUBLIC_BASE_URL` | `https://test-api.example.com` | `https://api.example.com` |
| `IMAGE_OWNER` | `couragegang` | `couragegang` |
| `GRAFANA_ROOT_URL` | `http://<vps>:3000` | то же (одна Grafana на хост) |
| `GRAFANA_HOST_PORT` | `3000` | `3000` |

## 5. Как секреты попадают в runtime

### Local / E2E (без bake)

1. Workflow `environment: test` → secrets в `env` job.
2. `fetch-build-secrets.sh test` → `build/runtime.env`.
3. `docker compose up` — `env_file`, образы **`target: local`**.

### VPS (test и prod, bake)

1. Workflow `environment: test` или `prod`.
2. `prepare-baked-build.sh <contour>` → `services/*/docker/runtime-baked.env`.
3. `docker compose -f docker-compose.bake.yml build` — **`target: baked`**.
4. Push `ghcr.io/.../service:<sha>-<contour>` и `<contour>-latest`.
5. VPS: `/opt/couragegang-<contour>`, `./up.sh`.

## 6. Workflows

| Workflow | Environment | Деплой VPS |
|----------|-------------|------------|
| `e2e.yml` | `test` | нет (только CI compose) |
| `build-images.yml` | `test` или `prod` (dispatch) | нет |
| `deploy-vps.yml` | `test` / `prod` по ветке или dispatch | да (Docker BC) |
| `deploy-web-ui.yml` | `test` / `prod` (`workflow_dispatch` из **ui**, dispatch) | rsync `apps/web/dist`; VPS_* в platform Environment |
| `ui` → `trigger-deploy.yml` | push + path filter | `workflow_dispatch` → `deploy-web-ui.yml` @ `test`/`main` |
| `deploy-observability.yml` | `test` (SSH на тот же VPS) | `/opt/couragegang-observability` |
| `trigger-deploy.yml` (в каждом BC) | push `test`/`main` | `workflow_dispatch` → `deploy-vps.yml` @ `test`/`main` |

**Кросс-репо деплой:** Environment secrets platform **не** передаются через `workflow_call`. В каждом BC и в **ui** — Repository secret **`PLATFORM_DISPATCH_TOKEN`** (PAT с правом запускать Actions в `couragegang/platform`). Скрипт: [`scripts/set-platform-dispatch-token.ps1`](../scripts/set-platform-dispatch-token.ps1). VPS_* остаются только в Environment platform.

### Доступ BC → platform

В **`deploy-vps.yml`** / **`deploy-web-ui.yml`** checkout **`platform`** по `ref: test` или `main` из dispatch. Устаревшие пути: `workflow_call`, `PLATFORM_DEPLOY_TOKEN`, `repository_dispatch`.

Подробнее о ветках и триггерах: [`service-git-workflow.md`](service-git-workflow.md).

## 7. GHCR push: `unauthorized` при push

Нужны **оба** условия:

1. Org/repo: **Settings → Actions → Workflow permissions → Read and write** (иначе `GITHUB_TOKEN` не пишет в packages, даже при `packages: write` в YAML).
2. В `deploy-vps.yml`: `permissions.packages: write` и login как `${{ github.repository_owner }}` + `GITHUB_TOKEN`.

Если org запрещает write для workflow-токена — альтернатива: секрет `GHCR_PUSH_TOKEN` (PAT `write:packages`) вместо `GITHUB_TOKEN` в шаге login.

## 8. GHCR pull на VPS: `403 Forbidden`

В **deploy-vps** на VPS: `docker login -u couragegang` + **`GITHUB_TOKEN`** job (org/workflow, не личный аккаунт). Нужны `permissions.packages: read` и org **Read and write** для workflow-токена.

Если **403** остаётся:

1. Пакеты привязаны к репо **platform** — workflow должен пушить из `couragegang/platform`.
2. Package settings → **Inherit access** от репозитория или явный read для Actions.
3. Ручной pull на VPS (без CI): отдельный **machine user** в org + `GHCR_PULL_TOKEN` (`read:packages`), login под **именем бота**, не под личным аккаунтом.

## 9. Локально

GitHub не нужен — `platform/.env` и контур `local`:

```powershell
.\scripts\fetch-build-secrets.ps1 -Contour local
docker compose up --build
```
