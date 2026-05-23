"""Policy regress: org rules list."""

import pytest
import requests

from lib.config import POLICY_URL

pytestmark = pytest.mark.regress


def test_org_rules_list(api_session):
    r = requests.get(
        f"{POLICY_URL}/orgs/{api_session.org_id}/rules",
        headers=api_session.auth_headers(),
        timeout=30,
    )
    r.raise_for_status()
    assert isinstance(r.json(), (list, dict))
