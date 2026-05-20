# E2E интеграционные тесты (platform)

HTTP-сценарии по [`cursor-context/docs/ui-api-scenarios.md`](../../../cursor-context/docs/ui-api-scenarios.md): **P1** (фаза 1 backend), **K1–K8** (клиент), **A1–A9** (админ).

Карта сценариев: [`scenarios.yaml`](scenarios.yaml).

## Требования

- Запущен стек: из корня `platform/` → `docker compose up --build`
- Python 3.10+
- Для `@pytest.mark.db`: Docker CLI + контейнер `postgres` из compose

## Установка и запуск

```powershell
cd platform\tests\e2e
python -m pip install -r requirements.txt
pytest
```

Только фаза 1:

```powershell
pytest -m phase1
```

С проверкой БД (secrets/policy/audit):

```powershell
pytest -m "phase1 and db"
```

Живой Notion (нужен реальный integration token):

```powershell
$env:NOTION_E2E_TOKEN = "secret_..."
pytest -m notion
```

## Переменные окружения

| Переменная | По умолчанию |
|------------|----------------|
| `E2E_IAM_URL` | `http://localhost:8080/v1/iam` |
| `E2E_BFF_URL` | `http://localhost:8082/v1/bff` |
| `E2E_MCP_URL` | `http://localhost:8081/v1/mcp` |
| `E2E_CONFIG_URL` | `http://localhost:8084/v1/config` |
| `E2E_PASSWORD` | `E2eTest-Password-1` |
| `NOTION_E2E_TOKEN` | — (опционально, live Notion) |
| `E2E_DB_VERIFY` | `1` — пропуск DB-тестов при `0` |

## Покрытие сценариев

| ID | Статус | Файл |
|----|--------|------|
| P1-01 … P1-06 | ✅ | `test_health.py`, `test_phase1_flow.py` |
| K1, K2, K3, K5, K6, K8 | ✅ | `test_k_scenarios.py` |
| K4, K7 | ⏭ skip | HITL / knowledge не реализованы |
| A1–A4 | ✅ | `test_a_scenarios.py` |
| A5–A9 | ⏭ skip | policy read / audit read / billing / knowledge |
| Notion live | ✅* | `test_notion_live.py` (*с токеном) |

## CI

Workflow `.github/workflows/e2e.yml` поднимает compose и гоняет `pytest -m "phase1 or k or a"`.
