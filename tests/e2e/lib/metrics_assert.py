"""Проверка Prometheus scrape на 4 золотых сигнала (Google SRE).

- Traffic + Latency: http.server / http_server_requests (счётчики, histogram, percentiles)
- Errors: status/outcome на server и integration.http
- Saturation: JVM, process CPU, HikariCP (если есть БД)
"""

from __future__ import annotations

import re

from lib.config import SERVICES_METRICS

# Минимум один паттерн из группы должен встретиться в exposition text.
GOLDEN_SIGNAL_GROUPS: dict[str, list[str]] = {
    "traffic_latency": [
        "http_server_requests",
        "http.server.requests",
        "http_server_request",
    ],
    "errors": [
        "http_server_requests",
        "http.server.requests",
        "status=",
        "outcome=",
    ],
    "saturation": [
        "jvm_",
        "process_",
        "hikaricp_",
        "system_cpu",
        "executor_",
    ],
}

INTEGRATION_METRIC_HINTS = [
    "integration.http",
    "integration_http",
]


def metrics_url(service_id: str) -> str:
    try:
        return SERVICES_METRICS[service_id]
    except KeyError as e:
        raise ValueError(f"Unknown service_id={service_id}") from e


def assert_prometheus_golden_signals(body: str, service_id: str) -> None:
    """Проверяет текст /metrics (Prometheus exposition format)."""
    text = body if isinstance(body, str) else body.decode("utf-8", errors="replace")
    assert text.strip(), f"{service_id}: empty metrics body"
    assert "# TYPE" in text or "# HELP" in text, f"{service_id}: not Prometheus text format"

    lower = text.lower()
    missing: list[str] = []
    for group, patterns in GOLDEN_SIGNAL_GROUPS.items():
        if not any(p.lower() in lower for p in patterns):
            missing.append(group)
    assert not missing, (
        f"{service_id}: metrics missing golden signal groups {missing}; "
        f"snippet={text[:500]!r}"
    )

    # Histogram / percentiles → latency
    has_latency_detail = (
        "_bucket" in lower
        or "_seconds" in lower
        or "percentile" in lower
        or "histogram" in lower
    )
    assert has_latency_detail, f"{service_id}: no histogram/latency series in metrics"


def assert_integration_metrics_optional(body: str, service_id: str) -> None:
    """Для BC с исходящими вызовами — наличие series integration.http (может быть 0 samples)."""
    if service_id not in {"iam", "bff", "mcp", "ai"}:
        return
    lower = body.lower()
    assert any(h in lower for h in INTEGRATION_METRIC_HINTS), (
        f"{service_id}: expected integration HTTP metric "
        f"({INTEGRATION_METRIC_HINTS}) after outbound calls"
    )
