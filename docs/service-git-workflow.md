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
3. После merge в **`test`** → GitHub Actions в сервисе → **`workflow_call`** → reusable **`platform` Deploy to VPS** → контур **test**.
4. Релиз: MR **`test` → `main`** (после проверки на staging).
5. После merge в **`main`** → тот же механизм → контур **prod**.

`api-contracts` деплой **не** триггерит (только OpenAPI); при изменении compose/деплоя — push в **`platform`**.

## Триггеры деплоя

```text
merge → test (любой BC)  ──►  platform: deploy-vps  ──►  VPS test
merge → main (любой BC)  ──►  platform: deploy-vps  ──►  VPS prod

merge → test/main (platform, paths deploy/config)  ──►  тот же workflow
```

### Режимы деплоя

| Режим | Когда | Что происходит |
|-------|--------|----------------|
| **`single`** (по умолчанию) | Merge в `test`/`main` в **микросервисе** | Сборка/push **только этого** сервиса; на VPS перезапуск **одного** контейнера. Остальные теги — из `image-tags.env`. |
| **`all`** | Push/merge в **`platform`** (deploy paths) или **Actions → Deploy to VPS** с `deploy_scope=all` | Полный bake всех 9 BC + postgres, общий тег, полный `up.sh`. |

Из BC вызывается reusable workflow с `scope=single` (один сервис, один контейнер на VPS).

## Одноразовая настройка GitHub

### 1. Доступ к reusable workflow в `platform`

В репозитории **`couragegang/platform`**: **Settings → Actions → General → Access** → включить доступ для репозиториев организации **`couragegang`** (или явно перечислить BC).

Секрет **`PLATFORM_DEPLOY_TOKEN`** в микросервисах **не нужен** (legacy: `repository_dispatch` + `actions/github-script`).

### 2. Workflow в сервисах

Файл **`.github/workflows/trigger-deploy.yml`** (шаблон: [`templates/service-trigger-deploy.yml`](../templates/service-trigger-deploy.yml)).

### 3. Автотесты (pytest + unit) и merge gate

В каждом **микросервисе** (кроме `api-contracts`):

| Workflow | Check в PR | Когда |
|----------|------------|--------|
| [`unit-tests.yml`](../templates/service-unit-tests.yml) | **Unit tests / gradle** | PR и push в `test` / `main` |
| [`functional-tests.yml`](../templates/service-functional-tests.yml) | **Functional tests / pytest** | PR и push в `test` / `main` |

**Набор pytest** (в `tests/functional/` репозитория BC):

| Событие | Маркер | Содержание |
|---------|--------|------------|
| MR / merge в **`test`** | `smoke` | health + критичный путь BC |
| MR / merge в **`main`** | `regress` | расширенные сценарии BC |

Логика выбора: [`scripts/resolve-functional-suite.sh`](../scripts/resolve-functional-suite.sh).

**Platform** (полный стек): workflow [`e2e.yml`](../.github/workflows/e2e.yml) — smoke на PR/push в `test`, regress на PR/push в `main`. Check: **E2E integration tests / e2e**.

**api-contracts:** [`quality.yml`](../../services/api-contracts/.github/workflows/quality.yml) — зеркала + Redocly.

Установка в BC после изменения шаблонов:

```powershell
.\scripts\install-service-ci.ps1
```

Секреты для functional CI — Environment **`test`** в репозитории BC (те же имена, что в platform: `JWT_SECRET`, `DB_PASSWORD`, …).

### 4. Protected branches

В **platform** (и по той же схеме в каждом BC): правила для **`test`** и **`main`**. Merge **заблокирован**, пока не зелёные required checks.

| Репозиторий | Required checks |
|-------------|-----------------|
| BC (iam, bff, …) | `Unit tests / gradle`, `Functional tests / pytest` |
| **platform** | `E2E integration tests / e2e` |
| **api-contracts** | `canonical vs service mirrors / contract-freshness`, `OpenAPI lint (Redocly) / redocly-lint` |

| Правило | Значение |
|---------|----------|
| Require pull request before merging | да |
| Required approving reviews | **1** |
| Dismiss stale pull request approvals | да |
| Require conversation resolution | да |
| Enforce for administrators | да |
| Require approval from someone other than the last pusher | **нет** (`require_last_push_approval: false`) |
| Allow force pushes | нет |
| Allow deletions | нет |

**Самоаппрув:** GitHub **не позволяет** автору PR нажать Approve на своём PR. Для solo/малой команды:

1. Workflow [`.github/workflows/auto-approve-internal-prs.yml`](../.github/workflows/auto-approve-internal-prs.yml) — бот ставит approval на PR из того же репозитория (нужно **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**).
2. В [`branch-protection.json`](../.github/branch-protection.json) — `bypass_pull_request_allowances` для maintainer (можно мержить без review, если бот не сработал).

Шаблон для BC: [`templates/auto-approve-internal-prs.yml`](../templates/auto-approve-internal-prs.yml).

Повторно применить (нужен `gh` и права admin):

```powershell
cd platform
.\scripts\apply-branch-protection.ps1
.\scripts\apply-bc-branch-protection.ps1
.\scripts\apply-branch-protection.ps1 -Repo couragegang/api-contracts -Contracts
```

Шаблоны JSON: [`.github/branch-protection.json`](../.github/branch-protection.json) (platform), [`.github/branch-protection-bc.json`](../.github/branch-protection-bc.json) (BC).

### 5. Environments `test` / `prod` в **platform**

Секреты VPS и платформы — только в репозитории **platform** (см. [`github-environments.md`](github-environments.md)).

## Теги образов

- Merge в `test` → `ghcr.io/.../iam-service:<sha>-test` и `test-latest`
- Merge в `main` → `<sha>-prod` и `prod-latest`

`<sha>` — коммит **триггерившего** репозитория (или `platform` при push в platform).
