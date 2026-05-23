import time

import pytest
import requests

from lib.config import E2E_PASSWORD, NOTION_TOKEN, SERVICES_HEALTH
from lib.db_verify import db_available
from lib.http_client import ApiSession


def pytest_configure(config):
    config.addinivalue_line("markers", "smoke: Fast smoke (health + BFF path)")
    config.addinivalue_line("markers", "phase1: Phase 1 backend MVP")
    config.addinivalue_line("markers", "k: Client scenario K1-K8")
    config.addinivalue_line("markers", "a: Admin scenario A1-A9")
    config.addinivalue_line("markers", "notion: Real Notion token required")
    config.addinivalue_line("markers", "db: PostgreSQL verification via docker")
    config.addinivalue_line(
        "markers",
        "deepseek: Live DeepSeek LLM (LLM_PROVIDER=deepseek + DEEPSEEK_API_KEY)",
    )


@pytest.fixture(scope="session")
def require_compose():
    """Fail fast if platform stack is not up."""
    deadline = time.time() + 120
    last_errors: list[str] = []
    while time.time() < deadline:
        last_errors.clear()
        for name, url in SERVICES_HEALTH.items():
            try:
                r = requests.get(url, timeout=5)
                if r.status_code != 200:
                    last_errors.append(f"{name}: HTTP {r.status_code}")
            except requests.RequestException as e:
                last_errors.append(f"{name}: {e}")
        if not last_errors:
            return
        time.sleep(3)
    pytest.fail("Services not healthy:\n" + "\n".join(last_errors))


@pytest.fixture
def session(require_compose) -> ApiSession:
    s = ApiSession()
    s.register_with_org()
    s.resolve_org_and_workspace()
    return s


@pytest.fixture
def notion_token():
    return NOTION_TOKEN


@pytest.fixture
def db_verify_enabled():
    if not db_available():
        pytest.skip("docker compose postgres not available (set E2E_DB_VERIFY=0 to silence)")
    return True
