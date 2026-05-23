# Метрики и 4 золотых сигнала (все BC)

Стандарт для **каждого** микросервиса: Micrometer + Prometheus scrape на `GET /v1/<bc>/prometheus`.

| Сигнал | Что смотрим | Метрики (Prometheus) |
|--------|-------------|----------------------|
| **Traffic** | RPS, активность | `http_server_requests_*` (счётчики) |
| **Latency** | p50/p95/p99 | histogram `http_server_requests_seconds_*`, percentiles |
| **Errors** | 4xx/5xx, сбои интеграций | `status`, `outcome` на server; `<bc>.integration.http` с `outcome=failure` |
| **Saturation** | Память, CPU, пул БД | `jvm_*`, `process_*`, `hikaricp_*` (если есть JDBC) |

## Конфигурация (Micronaut)

В `application.yml` каждого BC:

- `micronaut.metrics.enabled: true`
- `micronaut.metrics.export.prometheus.enabled: true`
- binders: `web.server` (histogram + percentiles), `jvm`, `jdbc` (если Postgres), `processor`, `uptime`
- для BFF/ai без БД — без `jdbc`
- `endpoints.prometheus.enabled: true` (URL: `/v1/<bc>/prometheus`)

Эталон: [`iam-service` `application.yml`](../../services/iam-service/src/main/resources/application.yml).

## Исходящие HTTP (интеграции)

JDK `HttpClient` оборачивается в `<bc>.metrics.OutboundHttpMetrics`:

- Метрика: `<bc>.integration.http` (Timer + histogram)
- Теги: `integration`, `operation`, `status`, `outcome` (`success` / `client_error` / `server_error` / `failure`)

Используется в: **iam** (config, OIDC), **bff** (DownstreamClient), **mcp** (secrets/policy/audit), **ai** (policy, audit, deepseek).

## Проверки в CI

| Уровень | Где | Что |
|---------|-----|-----|
| Smoke (per BC) | `tests/functional/test_metrics.py` | GET `/metrics` + golden signals |
| Stack E2E | `platform/tests/e2e/test_health.py` | `test_service_metrics_golden_signals` на все 9 BC |
| Unit | `OutboundHttpMetrics` + `SimpleMeterRegistry` | iam, bff |

Библиотека assert: [`tests/e2e/lib/metrics_assert.py`](../tests/e2e/lib/metrics_assert.py).

## Prometheus / Grafana

Стек observability: **`platform/deploy/observability/`**.

**Дашборды BC:** JSON в **`services/<bc>/grafana/`** (источник правды). Синхронизация: **`scripts/sync-grafana-dashboards.ps1`** → Grafana file provisioning (reload **30 s**). Генератор: **`scripts/generate-grafana-dashboard.py`**.

Деплой на VPS: `/opt/couragegang-observability`, workflow **Deploy observability**.

## Алерты (рекомендация)

- **Latency:** p95 `http_server_requests_seconds` > порог по BC
- **Errors:** rate(`outcome="server_error"`) / rate(...) > 1%
- **Saturation:** `hikaricp_connections_pending` > 0 или `jvm_memory_used` / max > 0.9
- **Traffic:** drop to zero (сервис недоступен) — blackbox + health

См. также: [`runbook-all-contours.md`](runbook-all-contours.md).
