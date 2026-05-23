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

### Режимы деплоя

| Режим | Когда | Что происходит |
|-------|--------|----------------|
| **`single`** (по умолчанию) | Merge в `test`/`main` в **микросервисе** | Сборка/push **только этого** сервиса; на VPS перезапуск **одного** контейнера. Остальные теги — из `image-tags.env`. |
| **`all`** | Push/merge в **`platform`** (deploy paths) или **Actions → Deploy to VPS** с `deploy_scope=all` | Полный bake всех 9 BC + postgres, общий тег, полный `up.sh`. |

В payload dispatch из BC передаётся `scope: 'single'` и `repository: couragegang/<service>`.

## Одноразовая настройка GitHub

### 1. PAT для dispatch

Создайте fine-grained или classic PAT с доступом к репозиторию **`couragegang/platform`**:

- **Actions:** Read and write (для `repository_dispatch`)
- **Contents:** Read (опционально)

Сохраните как секрет **`PLATFORM_DEPLOY_TOKEN`** в **каждом** микросервисе (и при желании на уровне org).

### 2. Workflow в сервисах

Файл **`.github/workflows/trigger-deploy.yml`** (шаблон: [`templates/service-trigger-deploy.yml`](../templates/service-trigger-deploy.yml)).

### 3. Protected branches

В **platform** (и по той же схеме в каждом BC): правила для **`test`** и **`main`**.

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

Повторно применить для **platform** (нужен `gh` и права admin):

```powershell
gh api --method PUT repos/couragegang/platform/branches/main/protection `
  --input .github/branch-protection.json
gh api --method PUT repos/couragegang/platform/branches/test/protection `
  --input .github/branch-protection.json
```

Шаблон JSON: [`.github/branch-protection.json`](../.github/branch-protection.json).

### 4. Environments `test` / `prod` в **platform**

Секреты VPS и платформы — только в репозитории **platform** (см. [`github-environments.md`](github-environments.md)).

## Теги образов

- Merge в `test` → `ghcr.io/.../iam-service:<sha>-test` и `test-latest`
- Merge в `main` → `<sha>-prod` и `prod-latest`

`<sha>` — коммит **триггерившего** репозитория (или `platform` при push в platform).
