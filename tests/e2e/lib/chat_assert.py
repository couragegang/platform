"""Assertions for BFF / AI chat responses."""

from __future__ import annotations

import os

import requests

CHAT_STATUSES = frozenset(
    {"stub", "completed", "generating", "awaiting_approval", "denied", "error"}
)


def parse_chat_response(response: requests.Response) -> dict:
    response.raise_for_status()
    body = response.json()
    assert isinstance(body, dict), body
    assert "reply" in body, body
    assert body.get("reply"), "expected non-empty reply"
    status = body.get("status")
    assert status in CHAT_STATUSES, f"unexpected status {status!r}: {body}"
    return body


def expected_chat_status() -> str:
    """Status for default compose (stub) vs optional live DeepSeek."""
    provider = os.getenv("E2E_LLM_PROVIDER") or os.getenv("LLM_PROVIDER", "stub")
    if provider.lower() == "deepseek" and (os.getenv("DEEPSEEK_API_KEY") or "").strip():
        return "completed"
    return "stub"
