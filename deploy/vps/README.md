# Деплой на VPS (контуры test и prod)

Конфиг и секреты **вшиты в образы** на этапе CI (`docker build --target baked`). На VPS нет `.env` — только pull и `up.sh`.

## Два контура на VPS

| Контур | Назначение | Путь на VPS | Тег GHCR |
|--------|------------|-------------|----------|
| **test** | Staging / приёмочный стенд | `/opt/couragegang-test` | `<sha>-test`, `test-latest` |
| **prod** | Production | `/opt/couragegang-prod` | `<sha>-prod`, `prod-latest` |

**test** и **prod** на **одном** VPS: host-порты **только** в оверлеях — test **18080–18088** + n8n **15678** (`docker-compose.ports-test.yml`), prod **8080–8088** + n8n **5678** (`docker-compose.ports-prod.yml`). В базовом `docker-compose.yml` секции `ports` нет (иначе Compose **дописывает** порты из двух файлов, и test пытается занять 8080, уже занятый prod).

### n8n (оркестратор чата)

- **Workflow:** [`.github/workflows/deploy-n8n.yml`](../../.github/workflows/deploy-n8n.yml) — отдельно от **Deploy to VPS** (push `n8n/**`, `docker/n8n/**` или ручной dispatch).
- Образ **`ghcr.io/<owner>/n8n:<sha>-<contour>`** — baked в CI (`docker/n8n/Dockerfile`), workflow внутри образа (`n8n import:workflow` при первом старте).
- `ai-runtime` на VPS: `AI_ORCHESTRATOR=n8n` (фрагмент `config/bake/fragments/ai.env`) — пересборка через **Deploy to VPS** → `ai-runtime` или флаг **redeploy_ai** в deploy-n8n.
- Секрет **`AI_INTERNAL_API_KEY`** — в GitHub Environment **test** / **prod** (как остальные internal keys).
- UI n8n через nginx: **`https://ai-test.valoriel.ru/n8n/`** (test), **`https://ai.valoriel.ru/n8n/`** (prod). Subpath: bake по контуру + `docker-compose.ports-*.yml` (не `VPS_PUBLIC_BASE_URL`).
- **Push в `platform`:** workflow **Deploy to VPS** = полный стек (`deploy_scope=all`). Изменения только в `n8n/**` или этот README **не** запускают Deploy to VPS (см. `paths` / `paths-ignore` в `deploy-vps.yml`). Один сервис — push в BC-репо (`ai-runtime`, …) → `workflow_dispatch` с `deploy_scope=single`.
- **n8n workflows:** import только при смене sha256 bundle в образе (не каждый restart). Стабильные id `cgChatOrchestr01` / `cgChatToolStp01`. Дубликаты — sqlite delete лишних id. Полный сброс: `FORCE_WORKFLOW_REIMPORT=1` на контейнере n8n.
- **Нет executions в n8n:** `import:workflow` деактивирует workflow — entrypoint делает `n8n update:workflow --all --active=true` перед стартом. На уже развёрнутом volume без пересборки образа: `docker compose exec n8n n8n update:workflow --all --active=true` и `docker compose restart n8n`. У `ai`: `grep AI_ORCHESTRATOR /app/config/runtime-baked.env` → `n8n` и `AI_N8N_ENABLED=true`; в логах при старте: `useN8n=true`.

## Однократная настройка VPS

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo mkdir -p /opt/couragegang-test /opt/couragegang-prod /opt/couragegang-observability
sudo chown -R $USER:$USER /opt/couragegang-test /opt/couragegang-prod /opt/couragegang-observability
```

Файлы compose и `up.sh` копирует GitHub Actions в нужный каталог.

**Grafana + Prometheus (test/prod data sources):** отдельный каталог [`/opt/couragegang-observability`](../observability/README.md), workflow **Deploy observability** — не смешивается с `couragegang-test` / `couragegang-prod`.

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
| `GHCR_PULL_TOKEN` | *(опционально)* только для ручного pull на VPS; CI использует `GITHUB_TOKEN` + org `IMAGE_OWNER` |

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
| Push **`n8n/**`**, **`docker/n8n/**`** | **Deploy n8n to VPS** → test / prod |
| **Actions → Deploy to VPS** (ручной) | выбор BC-стека |
| **Actions → Deploy n8n to VPS** (ручной) | только n8n (+ опц. ai) |

Микросервисы: [`.github/workflows/trigger-deploy.yml`](../../templates/service-trigger-deploy.yml) → reusable `deploy-vps` в platform (секрет PAT не нужен).

Git-flow: [`docs/service-git-workflow.md`](../../docs/service-git-workflow.md).

## Ручной запуск на VPS

```bash
cd /opt/couragegang-test
unset COMPOSE_FILE
sed -i 's/\r$//' up.sh docker-compose.yml docker-compose.ports-test.yml docker-compose.ports-prod.yml
ls -la docker-compose.yml docker-compose.ports-*.yml up.sh
export DEPLOY_CONTOUR=test IMAGE_OWNER=couragegang
bash ./up.sh abc123def-test
```

Если ошибка `stat ... docker-compose.yml docker-compose.ports-test.yml` — на сервере **старый** `up.sh` или в shell задан `COMPOSE_FILE` с пробелом. Обновите `up.sh` из репозитория и выполните `unset COMPOSE_FILE`.

### `database "ai" does not exist` (старый Postgres volume)

`init-db` отрабатывает только при **первом** создании volume. На уже поднятом test/prod Postgres выполните один раз:

```bash
cd /opt/couragegang-test
export DEPLOY_CONTOUR=test
chmod +x ensure-databases.sh
./ensure-databases.sh
./up.sh test-latest ai
```

### `address already in use` на 8080 (test)

Симптом: deploy test падает на `iam`, в `docker ps` у test-сервисов видны **и** `808x`, **и** `1808x` (например `8081` и `18081` у mcp). Причина — старый compose с `ports` в базе + оверлей test.

**На VPS после обновления файлов из platform:**

```bash
cd /opt/couragegang-test
unset COMPOSE_FILE
export DEPLOY_CONTOUR=test IMAGE_OWNER=couragegang
bash ./up.sh <ваш-sha>-test
```

`up.sh` пересоздаёт контейнеры (`--force-recreate`) с портами только **18080–18088**. Проверка: `docker ps` — у `couragegang-test-*` не должно быть `8080`–`8088` на host.

## Образы GHCR

`ghcr.io/<owner>/iam-service:<sha>-test`  
`ghcr.io/<owner>/iam-service:test-latest`  

Аналогично для prod: `*-prod`, `prod-latest`.

## Домен ai.valoriel.ru (рядом с iceberg.valoriel.ru)

Один VPS, два проекта: iceberg слушает свой порт (например `8765`), AI stack — **8080–8088** (prod) или **18080–18088** (test). Конфликта портов нет.

### 1. DNS

| Запись | Значение |
|--------|----------|
| `A` `ai.valoriel.ru` | IP того же VPS, что у `iceberg.valoriel.ru` |
| (опционально) `A` `ai-test.valoriel.ru` | тот же IP — staging (порты 18080+) |

### 2. Nginx

Шаблон location-блоков: [`nginx-ai.valoriel.ru.example.conf`](nginx-ai.valoriel.ru.example.conf).

Публично достаточно **`/v1/bff/`** и **`/v1/iam/`** (OIDC callback). Остальные сервисы — только localhost или через BFF.

TLS для `ai.valoriel.ru` уже выпущен — **новый certbot не нужен**; только добавить `location` в существующий `server { }` и `nginx -t && reload`.

### 3. GitHub Environment **prod** (репозиторий `couragegang/platform`)

| Variable / Secret | Значение для prod |
|-------------------|-------------------|
| **`VPS_PUBLIC_BASE_URL`** (variable) | `https://ai.valoriel.ru` |
| `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` | те же, что для деплоя на VPS |
| `GHCR_PULL_TOKEN` | PAT `read:packages` |
| `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `*_INTERNAL_API_KEY`, `DB_PASSWORD` | **новые** prod-значения (не копировать с test) |
| `OIDC_*` (secrets) | в Google/GitHub OAuth redirect URI: `https://ai.valoriel.ru/v1/iam/auth/oidc/{google\|github}/callback` |

После merge в **`main`** любого BC → CI bake → GHCR → `/opt/couragegang-prod/up.sh`.

Ручной первый деплой: **Actions → Deploy to VPS → contour `prod`**.

### 4. Проверка

```bash
curl -sS https://ai.valoriel.ru/health
curl -sS https://ai.valoriel.ru/api/me   # 401 без Bearer — норма
curl -sS https://ai.valoriel.ru/         # SPA index.html
```

## Фронт (web-ui) + /api

| URL в браузере | Куда |
|----------------|------|
| `/` | Static SPA (`/var/www/ai.valoriel.ru`) |
| `/api/*` | BFF → `127.0.0.1:8082/v1/bff/api/*` (включая `/api/auth/*` → IAM внутри BFF) |
| `/v1/iam/*` | IAM напрямую (OIDC **callback** с Google/GitHub) |
| `/health` | BFF health |

**Деплой фронта (CI, как BC):**

```text
merge → test (web-ui)  ──►  platform: deploy-web-ui  ──►  rsync → /var/www/ai-test.valoriel.ru
merge → main (web-ui)  ──►  platform: deploy-web-ui  ──►  rsync → /var/www/ai.valoriel.ru
```

Репозиторий **`couragegang/web-ui`**: `.github/workflows/trigger-deploy.yml` → reusable **`platform/.github/workflows/deploy-web-ui.yml`**. Секреты VPS — те же GitHub Environments **`test`** / **`prod`**, что у `deploy-vps`.

Ручной fallback:

```bash
sudo mkdir -p /var/www/ai.valoriel.ru
# локально:
cd web-ui && npm ci && npm run build
rsync -avz --delete dist/ user@vps:/var/www/ai.valoriel.ru/
# или: platform/scripts/deploy-web-ui.sh prod user@vps
```

Actions → **Deploy web-ui to VPS** в `platform` (dispatch, contour test|prod).

Обновить nginx: [`nginx-ai.valoriel.ru.server.conf`](nginx-ai.valoriel.ru.server.conf) → `sites-available`, `nginx -t && reload`.

Staging: [`nginx-ai-test.valoriel.ru.server.conf`](nginx-ai-test.valoriel.ru.server.conf), static в `/var/www/ai-test.valoriel.ru`, GitHub `VPS_PUBLIC_BASE_URL=https://ai-test.valoriel.ru`. **Полный гайд:** [`AI-TEST.md`](AI-TEST.md).

## Безопасность

Секреты в **слоях образа** — отдельные образы для test и prod, разные registry-теги. Доступ к GHCR ограничить; для строгой изоляции позже — runtime secrets без bake.
