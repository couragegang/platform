# Контуры развёртывания (local / test / prod)

Два режима:

| Режим | Контуры | Секреты |
|-------|---------|---------|
| **Локальная разработка** | local, test | `build/runtime.env` + Compose `env_file` (не в образе) |
| **VPS** | prod | Вшиты в образ (`target baked`), см. `deploy/vps/` |

Для local/test перед `docker compose build` скрипт собирает `platform/build/runtime.env`. В Dockerfile по умолчанию stage `local`.

## Контуры

| Контур | Источник секретов | Файл дефолтов |
|--------|-------------------|---------------|
| **local** | `platform/.env` → `config/contours/local.env` | `local.env` (в git) |
| **test** | GitHub Environment `test` → env job → `test.env` | `test.env` (CI fallback) |
| **prod** | GitHub Environment `prod` → env job | `prod.env.example` |

## GitHub

1. **Settings → Environments** — создать `test` и `prod`.
2. В каждом Environment добавить **Secrets** с именами из [`secret-keys.txt`](secret-keys.txt) (как минимум `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `*_INTERNAL_API_KEY`, `DB_PASSWORD`).
3. Workflow [`build-images.yml`](../../.github/workflows/build-images.yml) и `e2e.yml` используют `environment: test` и передают secrets в шаг «Prepare runtime secrets».

Локально симуляция test/prod:

```powershell
$env:JWT_SECRET = "..."
.\scripts\fetch-build-secrets.ps1 -Contour test
```

## Команды

```powershell
cd platform
.\scripts\fetch-build-secrets.ps1 -Contour local   # → build/runtime.env
.\scripts\build-stack.ps1 -Contour local -Up
```

```bash
./scripts/fetch-build-secrets.sh test
DEPLOY_CONTOUR=test docker compose -f docker-compose.yml build
```
