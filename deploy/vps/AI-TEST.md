# ai-test.valoriel.ru — тестовое окружение (staging)

**Prod:** `https://ai.valoriel.ru` → Docker `couragegang-prod`, порты **8080–8088**, static `/var/www/ai.valoriel.ru`.

**Test:** `https://ai-test.valoriel.ru` → Docker `couragegang-test`, порты **18080–18088**, static `/var/www/ai-test.valoriel.ru`.

Оба контура на **одном VPS**, изолированы: отдельные compose-проекты, БД, образы GHCR, секреты GitHub.

---

## Схема

```text
                    ai-test.valoriel.ru (nginx :443)
                              │
         ┌────────────────────┼────────────────────┐
         │ /                  │ /api/*  /api/auth/* │ /v1/iam/*
         ▼                    ▼                     ▼
  /var/www/ai-test      127.0.0.1:18082      127.0.0.1:18080
  (SPA dist/)           BFF                  IAM
                              │
                    couragegang-test
                    (docker compose)
                    postgres volume отдельный от prod
```

| Слой | Prod | Test |
|------|------|------|
| Домен | `ai.valoriel.ru` | `ai-test.valoriel.ru` |
| Static | `/var/www/ai.valoriel.ru` | `/var/www/ai-test.valoriel.ru` |
| Nginx config | `nginx-ai.valoriel.ru.server.conf` | `nginx-ai-test.valoriel.ru.server.conf` |
| Docker dir | `/opt/couragegang-prod` | `/opt/couragegang-test` |
| BFF | `:8082` | `:18082` |
| IAM | `:8080` | `:18080` |
| GHCR tag | `*-prod`, `prod-latest` | `*-test`, `test-latest` |
| Git branch → deploy | **`main`** | **`test`** |
| GitHub Environment | **`prod`** | **`test`** |

---

## 1. DNS

| Запись | Значение |
|--------|----------|
| `A` `ai-test` | IP VPS (тот же, что `ai.valoriel.ru`) |

---

## 2. TLS (ISPmanager)

Сертификат уже в:

```text
/var/www/httpd-cert/www-root/ai-test.valoriel.ru_le1.crtca
/var/www/httpd-cert/www-root/ai-test.valoriel.ru_le1.key
```

Nginx: [`nginx-ai-test.valoriel.ru.server.conf`](nginx-ai-test.valoriel.ru.server.conf)

```bash
sudo cp nginx-ai-test.valoriel.ru.server.conf /etc/nginx/sites-available/ai-test.valoriel.ru
sudo ln -sf /etc/nginx/sites-available/ai-test.valoriel.ru /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/ai-test.valoriel.ru
# USER = тот же login, что VPS_USER в GitHub Environment test (CI rsync)
sudo chown -R "$USER:www-data" /var/www/ai-test.valoriel.ru
sudo chmod -R u+rwX,g+rX /var/www/ai-test.valoriel.ru
sudo nginx -t && sudo systemctl reload nginx
```

---

## 3. Backend (Docker test stack)

```bash
sudo mkdir -p /opt/couragegang-test
sudo chown $USER:$USER /opt/couragegang-test
```

Файлы `docker-compose.yml`, `docker-compose.ports-test.yml`, `up.sh` кладёт **GitHub Actions** при деплое, или скопируйте из репо `platform/deploy/vps/`.

Первый запуск вручную (после образов в GHCR):

```bash
cd /opt/couragegang-test
export DEPLOY_CONTOUR=test
export IMAGE_OWNER=couragegang
echo "$GHCR_PAT" | docker login ghcr.io -u couragegang --password-stdin
./up.sh test-latest
# или конкретный тег: ./up.sh abc1234-test
```

`up.sh` для `DEPLOY_CONTOUR=test` автоматически подключает **ports-test** (18080+).

Если `ai-runtime` в цикле **Restarting** и в логах `database "ai" does not exist`:

```bash
cd /opt/couragegang-test
export DEPLOY_CONTOUR=test
./ensure-databases.sh
./up.sh test-latest ai
```

Проверка на VPS:

```bash
curl -s http://127.0.0.1:18082/v1/bff/health
curl -s http://127.0.0.1:18080/v1/iam/health
docker compose ps   # project couragegang-test
```

---

## 4. Frontend (test)

```bash
# локально (monorepo ui/)
cd ui && pnpm install && pnpm --filter @couragegang/web build
rsync -avz --delete --no-times --omit-dir-times apps/web/dist/ root@VPS:/var/www/ai-test.valoriel.ru/

# или
platform/scripts/deploy-web-ui.sh test root@VPS
```

Проверка снаружи:

```bash
curl -sI https://ai-test.valoriel.ru/
curl -s https://ai-test.valoriel.ru/health
curl -sI https://ai-test.valoriel.ru/api/me   # 401 без токена — ок
```

---

## 5. GitHub (репозиторий `couragegang/platform`)

### Environment **`test`**

| Variable | Значение |
|----------|----------|
| **`VPS_PUBLIC_BASE_URL`** | **`https://ai-test.valoriel.ru`** |
| `LLM_PROVIDER` | `stub` (или `deepseek` для проверки LLM) |
| `IMAGE_OWNER` | `couragegang` |

**Secrets** (отдельные от prod, можно слабее для staging):

- `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `DB_PASSWORD`
- `CONFIG_INTERNAL_API_KEY`, `POLICY_INTERNAL_API_KEY`, `SECRETS_INTERNAL_API_KEY`, `AUDIT_INTERNAL_API_KEY`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_PULL_TOKEN`
- опционально: `DEEPSEEK_API_KEY`, `OIDC_*`

### OIDC (если нужен на test)

В Google/GitHub OAuth redirect:

```text
https://ai-test.valoriel.ru/v1/iam/auth/oidc/google/callback
https://ai-test.valoriel.ru/v1/iam/auth/oidc/github/callback
```

Bake подставит их из `VPS_PUBLIC_BASE_URL` при сборке образов контура **test**.

### Деплой test автоматически

- **Merge / push в ветку `test`** любого микросервиса → `trigger-deploy.yml` → platform **Deploy to VPS** → contour **test**
- Или: **Actions → Deploy to VPS → contour: test**

В **`platform`**: Actions → Access для org. Ветки BC: **`test`** и **`main`**.

---

## 6. Git-flow (кратко)

```text
feature/*  →  PR в test  →  деплой ai-test.valoriel.ru
       проверка на staging
test  →  PR в main  →  деплой ai.valoriel.ru (prod)
```

---

## 7. API из фронта (одинаково на prod и test)

| Путь | Назначение |
|------|------------|
| `/api/*` | **BFF** (me, chat, mcp, auth/login, …) |
| `/v1/iam/auth/oidc/*/callback` | IAM (OIDC redirect URI из bake) |

Код фронта **не меняется** между контурами — другой только домен.

---

## 8. Отличия test от prod (осознанно)

- Отдельная БД Postgres (volume `couragegang-test_pgdata`)
- Другие JWT/encryption secrets → токены prod **не** работают на test
- Можно `LLM_PROVIDER=stub` на test, `deepseek` на prod
- Порты 18080+ не торчат наружу — только через nginx на `ai-test.valoriel.ru`

---

## 9. Troubleshooting

| Симптом | Причина |
|---------|---------|
| 502 на `/api/*` | Docker test не поднят или не `18082` |
| 404 на `/api/organizations/*` | Старый образ **bff-gateway** — передеплой `bff` (ветка `test`) |
| 500 workspaces «URI with undefined scheme» | В baked BFF нет `CONFIG_BASE_URL` — пересобрать **bff** после обновления `platform/config/bake/static.env` |
| 502 на `/` | Пустой `/var/www/ai-test.valoriel.ru` — задеплойте `dist/` |
| rsync **Permission denied** | `chown` static-каталога на **`VPS_USER`** (см. §2): `sudo chown -R VPS_USER:www-data /var/www/ai-test.valoriel.ru` |
| SSL error | Путь к `ai-test.valoriel.ru_le1.crtca` в nginx |
| OIDC redirect на prod URL | Пересобрать образы test с `VPS_PUBLIC_BASE_URL=https://ai-test.valoriel.ru` |
| Prod и test мешают порты | Test без `docker-compose.ports-test.yml` — проверьте `DEPLOY_CONTOUR=test` в `up.sh` |

```bash
# на VPS
ss -tlnp | grep -E '8080|8082|18080|18082'
docker ps --filter name=couragegang
```
