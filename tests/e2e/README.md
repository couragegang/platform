# E2E интеграционные тесты (platform)

HTTP-сценарии по [`cursor-context/docs/ui-api-scenarios.md`](../../../cursor-context/docs/ui-api-scenarios.md): **P1** (фаза 1 backend), **K1–K8** (клиент), **A1–A9** (админ). В документе — статусы API (✅/🔶/📋), BFF-прокси и колонка E2E 🧪.

Карта ID → pytest: [`scenarios.yaml`](scenarios.yaml) (§13.3 в ui-api-scenarios).

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

Быстрый smoke (~1–2 мин, health + BFF path):

```powershell
pytest -m smoke
```

Или скрипт из корня `platform/`:

```powershell
.\scripts\smoke-test.ps1
# Linux/macOS:
./scripts/smoke-test.sh
```

Только фаза 1:

```powershell
pytest -m phase1
```

Клиент + админ (без live DeepSeek):

```powershell
pytest -m "phase1 or k or a"
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

Живой DeepSeek (в `platform/.env`: `LLM_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`, пересборка `ai`):

```powershell
pytest -m deepseek
```

## Переменные окружения

| Переменная | По умолчанию |
|------------|----------------|
| `E2E_IAM_URL` | `http://localhost:8080/v1/iam` |
| `E2E_BFF_URL` | `http://localhost:8082/v1/bff` |
| `E2E_AI_URL` | `http://localhost:8083/v1/ai` |
| `E2E_KNOWLEDGE_URL` | `http://localhost:8088/v1/knowledge` |
| `E2E_PASSWORD` | `E2eTest-Password-1` |
| `NOTION_E2E_TOKEN` | — (опционально, live Notion) |
| `E2E_LLM_PROVIDER` / `LLM_PROVIDER` | `stub` (ожидаемый статус чата в K3) |
| `DEEPSEEK_API_KEY` | — (для `-m deepseek`) |
| `E2E_DB_VERIFY` | `1` — пропуск DB-тестов при `0` |

## Покрытие сценариев

| ID | Статус | Файл |
|----|--------|------|
| SMOKE-01 … 03 | ✅ | `test_health.py`, `test_smoke.py` |
| P1-01 … P1-06 | ✅ | `test_health.py`, `test_phase1_flow.py` |
| K1–K8 | ✅ | `test_k_scenarios.py` (K2: BFF me; K4: approve + reject; K5: catalog notion) |
| K3 DeepSeek | ⏭ опционально | `-m deepseek` при ключе API |
| A1–A6, A9 | ✅ | `test_a_scenarios.py` (A5/A6/A9: direct + BFF proxy) |
| A7 | ✅ | SSO start → **501** (`TestA7SsoNotImplemented`) |
| A8 | ⏭ skip | billing post-MVP |
| Notion live | ✅* | `test_notion_live.py` (*с токеном) |

## CI

Workflow `.github/workflows/e2e.yml`: compose → **`pytest -m smoke`** → `pytest -m "phase1 or k or a"` (без `deepseek` и `notion`).
