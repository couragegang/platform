import pytest
import requests

from lib.config import SERVICES_HEALTH

pytestmark = [pytest.mark.phase1, pytest.mark.smoke]


@pytest.mark.parametrize("name,url", list(SERVICES_HEALTH.items()))
def test_service_health(name: str, url: str, require_compose):
    r = requests.get(url, timeout=10)
    assert r.status_code == 200, f"{name} unhealthy: {r.text}"
    body = r.json()
    assert body.get("status") == "UP" or "UP" in str(body)
