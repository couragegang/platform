"""Secrets regress: health only (internal API not exposed on public smoke path)."""

import pytest
import requests

from lib.config import SECRETS_URL

pytestmark = pytest.mark.regress


def test_secrets_health_extended(require_compose):
    r = requests.get(f"{SECRETS_URL}/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "UP" or "UP" in str(r.json())
