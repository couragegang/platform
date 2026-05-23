# Observability: Grafana + Prometheus (test / prod)

Один стек на VPS: **Grafana** + два **Prometheus** — отдельный scrape и **отдельный data source** для контуров **test** и **prod**.

| Компонент | Роль |
|-----------|------|
| **prometheus-test** | Scrape `18080–18088` (VPS test) |
| **prometheus-prod** | Scrape `8080–8088` (VPS prod / local) |
| **grafana** | UI; data sources **Prometheus-Test** и **Prometheus-Prod** |

Метрики приложений: `GET /v1/<bc>/prometheus` (не `/metrics`). Стандарт: [`docs/metrics-golden-signals.md`](../../docs/metrics-golden-signals.md).

## Local

```powershell
cd platform
docker compose up -d --build                        # BC на 8080–8088

cd deploy\observability
copy .env.example .env   # GRAFANA_ADMIN_PASSWORD
.\up-local.ps1
# или: docker compose -f docker-compose.local.yml up -d
```

| Компонент | URL |
|-----------|-----|
| Grafana | http://localhost:3000 |
| Prometheus | http://localhost:9090 (один инстанс, scrape 8080–8088) |

Data source один — **Prometheus** (без выбора контура в дашбордах).

На VPS — **два** data source и переменная **Contour (Prometheus)** в дашбордах: `OBSERVABILITY_PROFILE=vps ./up.sh`.

## VPS

Каталог: **`/opt/couragegang-observability`** (отдельно от `/opt/couragegang-test` и `/opt/couragegang-prod`).

```bash
sudo mkdir -p /opt/couragegang-observability
sudo chown -R $USER:$USER /opt/couragegang-observability
```

Деплой: workflow **Deploy observability** или push в `platform` с изменениями в `deploy/observability/**`.

На сервере:

```bash
cd /opt/couragegang-observability
cp .env.example .env   # GRAFANA_ADMIN_PASSWORD, GRAFANA_ROOT_URL
sed -i 's/\r$//' up.sh
chmod +x up.sh
./up.sh
```

Откройте Grafana: `http://<VPS>:3000` (закройте firewall / reverse-proxy + TLS в проде).

## Дашборды

**Источник правды:** `services/<bc>/grafana/*.json` в каждом микросервисе.

Синхронизация в Grafana (file provisioning, reload каждые **30 с**):

```powershell
cd platform
.\scripts\sync-grafana-dashboards.ps1
# или deploy/observability/up.sh (sync + docker up)
```

| Папка в Grafana | Источник |
|-----------------|----------|
| `Services / iam-service` | `services/iam-service/grafana/` |
| `Services / bff-gateway` | `services/bff-gateway/grafana/` |
| … | все 9 BC |
| `Services / platform` | `deploy/observability/grafana/dashboards/platform/` |

Генератор стандартного дашборда: `scripts/generate-grafana-dashboard.py` (IAM — детальный, без `--force` не перезаписывается).

| Контур | Grafana | Выбор data source |
|--------|---------|-------------------|
| **Local** | `dashboards-local/` + один DS `Prometheus` | нет (скрыто) |
| **VPS** | `dashboards/` + DS Test/Prod | **Contour (Prometheus)** вверху дашборда |

## GitHub Secrets (Environment `test` или общий VPS)

| Secret | Назначение |
|--------|------------|
| `GRAFANA_ADMIN_PASSWORD` | пароль admin Grafana |
| `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` | как для deploy-vps |

Опционально Variables: `GRAFANA_ROOT_URL`, `GRAFANA_HOST_PORT`.

## Архитектура scrape

```text
host (VPS)
  :8080-8088   couragegang-prod  ──► prometheus-prod ──┐
  :18080-18088 couragegang-test  ──► prometheus-test ─┼──► grafana
                                                       │     ├─ DS: Prometheus-Test
                                                       │     └─ DS: Prometheus-Prod
```

Prometheus в Docker достигает host-портов через `host.docker.internal:host-gateway`.
