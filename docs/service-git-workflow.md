# Git-ветки и автодеплой

## Модель веток (в каждом микросервисе и в `platform`)

| Ветка | Назначение | Protected | Merge → деплой |
|-------|------------|-----------|----------------|
| **`test`** | Интеграция, staging | да | VPS **test** (`/opt/couragegang-test`) |
| **`main`** | Production | да | VPS **prod** (`/opt/couragegang-prod`) |
| **`feature/*`** | Разработка | нет | деплой не запускается |

## Поток разработчика

1. Ветвление от **`test`**: `git checkout test && git pull && git checkout -b feature/ABC-123`.
2. Коммиты в feature-ветку, PR/MR **в `test`**.
3. После merge в **`test`** → GitHub Actions в сервисе → **`repository_dispatch`** → workflow **`platform` Deploy to VPS** → контур **test**.
4. Релиз: MR **`test` → `main`** (после проверки на staging).
5. После merge в **`main`** → тот же механизм → контур **prod**.

`api-contracts` деплой **не** триггерит (только OpenAPI); при изменении compose/деплоя — push в **`platform`**.

## Триггеры деплоя

```text
merge → test (любой BC)  ──►  platform: deploy-vps  ──►  VPS test
merge → main (любой BC)  ──►  platform: deploy-vps  ──►  VPS prod

merge → test/main (platform, paths deploy/config)  ──►  тот же workflow
```

Сборка всегда клонирует **все 9 сервисов** с ветки **`test`** или **`main`** (по контуру), не только изменённый репозиторий.

## Одноразовая настройка GitHub

### 1. PAT для dispatch

Создайте fine-grained или classic PAT с доступом к репозиторию **`couragegang/platform`**:

- **Actions:** Read and write (для `repository_dispatch`)
- **Contents:** Read (опционально)

Сохраните как секрет **`PLATFORM_DEPLOY_TOKEN`** в **каждом** микросервисе (и при желании на уровне org).

### 2. Workflow в сервисах

Файл **`.github/workflows/trigger-deploy.yml`** (шаблон: [`templates/service-trigger-deploy.yml`](../templates/service-trigger-deploy.yml)).

### 3. Protected branches

В каждом репозитории: **Settings → Branches** — правила для `test` и `main` (required reviews, no direct push).

### 4. Environments `test` / `prod` в **platform**

Секреты VPS и платформы — только в репозитории **platform** (см. [`github-environments.md`](github-environments.md)).

## Теги образов

- Merge в `test` → `ghcr.io/.../iam-service:<sha>-test` и `test-latest`
- Merge в `main` → `<sha>-prod` и `prod-latest`

`<sha>` — коммит **триггерившего** репозитория (или `platform` при push в platform).
