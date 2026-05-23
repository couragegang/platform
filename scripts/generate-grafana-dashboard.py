#!/usr/bin/env python3
"""Generate per-BC Grafana dashboard JSON (golden signals + optional integration.http)."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

SERVICES: list[dict[str, Any]] = [
    {
        "repo": "iam-service",
        "job": "iam",
        "metric": "iam",
        "title": "IAM Service",
        "uid": "iam-service-dashboard",
        "file": "iam-service-dashboard.json",
        "integration": True,
        "jdbc": True,
    },
    {
        "repo": "config-service",
        "job": "config",
        "metric": "config",
        "title": "Config Service",
        "uid": "config-service-dashboard",
        "file": "config-service-dashboard.json",
        "integration": False,
        "jdbc": True,
    },
    {
        "repo": "mcp-gateway",
        "job": "mcp",
        "metric": "mcp",
        "title": "MCP Gateway",
        "uid": "mcp-gateway-dashboard",
        "file": "mcp-gateway-dashboard.json",
        "integration": True,
        "jdbc": True,
    },
    {
        "repo": "bff-gateway",
        "job": "bff",
        "metric": "bff",
        "title": "BFF Gateway",
        "uid": "bff-gateway-dashboard",
        "file": "bff-gateway-dashboard.json",
        "integration": True,
        "jdbc": False,
    },
    {
        "repo": "ai-runtime",
        "job": "ai",
        "metric": "ai",
        "title": "AI Runtime",
        "uid": "ai-runtime-dashboard",
        "file": "ai-runtime-dashboard.json",
        "integration": True,
        "jdbc": False,
    },
    {
        "repo": "policy-service",
        "job": "policy",
        "metric": "policy",
        "title": "Policy Service",
        "uid": "policy-service-dashboard",
        "file": "policy-service-dashboard.json",
        "integration": False,
        "jdbc": True,
    },
    {
        "repo": "secrets-service",
        "job": "secrets",
        "metric": "secrets",
        "title": "Secrets Service",
        "uid": "secrets-service-dashboard",
        "file": "secrets-service-dashboard.json",
        "integration": False,
        "jdbc": True,
    },
    {
        "repo": "audit-service",
        "job": "audit",
        "metric": "audit",
        "title": "Audit Service",
        "uid": "audit-service-dashboard",
        "file": "audit-service-dashboard.json",
        "integration": False,
        "jdbc": True,
    },
    {
        "repo": "knowledge-service",
        "job": "knowledge",
        "metric": "knowledge",
        "title": "Knowledge Service",
        "uid": "knowledge-service-dashboard",
        "file": "knowledge-service-dashboard.json",
        "integration": False,
        "jdbc": True,
    },
]


def _ts_panel(
    pid: int,
    title: str,
    expr: str,
    legend: str,
    x: int,
    y: int,
    w: int,
    h: int,
    unit: str = "short",
) -> dict[str, Any]:
    return {
        "datasource": {"type": "prometheus", "uid": "${datasource}"},
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "custom": {"drawStyle": "line", "fillOpacity": 15, "lineWidth": 2},
            },
            "overrides": [],
        },
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "id": pid,
        "options": {
            "legend": {"displayMode": "table", "placement": "bottom", "showLegend": True},
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "targets": [
            {
                "datasource": {"type": "prometheus", "uid": "${datasource}"},
                "editorMode": "code",
                "expr": expr,
                "legendFormat": legend,
                "range": True,
                "refId": "A",
            }
        ],
        "title": title,
        "type": "timeseries",
    }


def _row(pid: int, title: str, y: int) -> dict[str, Any]:
    return {
        "collapsed": False,
        "gridPos": {"h": 1, "w": 24, "x": 0, "y": y},
        "id": pid,
        "panels": [],
        "title": title,
        "type": "row",
    }


def build_dashboard(svc: dict[str, Any]) -> dict[str, Any]:
    job = svc["job"]
    metric = svc["metric"]
    job_filter = f'job="{job}"'
    integration = svc["integration"]
    jdbc = svc["jdbc"]

    panels: list[dict[str, Any]] = []
    y = 0
    pid = 1

    panels.append(_row(pid, "HTTP — Traffic & Latency", y))
    y += 1
    pid += 1
    panels.append(
        _ts_panel(
            pid,
            "RPS (входящий HTTP)",
            f"sum(rate(http_server_requests_seconds_count{{{job_filter}}}[$__rate_interval]))",
            "rps",
            0,
            y,
            8,
            8,
            "reqps",
        )
    )
    pid += 1
    panels.append(
        _ts_panel(
            pid,
            "Latency p95",
            f"histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket{{{job_filter}}}[$__rate_interval])))",
            "p95",
            8,
            y,
            8,
            8,
            "s",
        )
    )
    pid += 1
    panels.append(
        _ts_panel(
            pid,
            "Latency p99",
            f"histogram_quantile(0.99, sum by (le) (rate(http_server_requests_seconds_bucket{{{job_filter}}}[$__rate_interval])))",
            "p99",
            16,
            y,
            8,
            8,
            "s",
        )
    )
    y += 8
    pid += 1

    panels.append(_row(pid, "HTTP — Errors", y))
    y += 1
    pid += 1
    panels.append(
        _ts_panel(
            pid,
            "5xx rate",
            f"sum(rate(http_server_requests_seconds_count{{{job_filter},status=~\"5..\"}}[$__rate_interval]))",
            "5xx",
            0,
            y,
            12,
            7,
            "reqps",
        )
    )
    pid += 1
    panels.append(
        _ts_panel(
            pid,
            "4xx rate",
            f"sum(rate(http_server_requests_seconds_count{{{job_filter},status=~\"4..\"}}[$__rate_interval]))",
            "4xx",
            12,
            y,
            12,
            7,
            "reqps",
        )
    )
    y += 7
    pid += 1

    if integration:
        panels.append(_row(pid, f"Исходящие интеграции ({metric}.integration.http)", y))
        y += 1
        pid += 1
        int_filter = f'job="{job}"'
        panels.append(
            _ts_panel(
                pid,
                "Integration RPS",
                f"sum(rate({metric}_integration_http_seconds_count{{{job_filter}}}[$__rate_interval]))",
                "{{integration}}/{{operation}}",
                0,
                y,
                12,
                7,
                "reqps",
            )
        )
        pid += 1
        panels.append(
            _ts_panel(
                pid,
                "Integration failures",
                f'sum(rate({metric}_integration_http_seconds_count{{{job_filter},outcome="failure"}}[$__rate_interval]))',
                "failure",
                12,
                y,
                12,
                7,
                "reqps",
            )
        )
        y += 7
        pid += 1

    panels.append(_row(pid, "Saturation (JVM / DB)", y))
    y += 1
    pid += 1
    panels.append(
        _ts_panel(
            pid,
            "JVM heap used ratio",
            f'sum(jvm_memory_used_bytes{{{job_filter},area="heap"}}) / sum(jvm_memory_max_bytes{{{job_filter},area="heap"}})',
            "heap",
            0,
            y,
            12,
            7,
            "percentunit",
        )
    )
    pid += 1
    if jdbc:
        panels.append(
            _ts_panel(
                pid,
                "HikariCP pending",
                f"sum(hikaricp_connections_pending{{{job_filter}}})",
                "pending",
                12,
                y,
                12,
                7,
                "short",
            )
        )
    else:
        panels.append(
            _ts_panel(
                pid,
                "Process CPU",
                f'process_cpu_usage{{{job_filter}}}',
                "cpu",
                12,
                y,
                12,
                7,
                "percentunit",
            )
        )
    y += 7
    pid += 1

    panels.append(
        {
            "datasource": {"type": "prometheus", "uid": "${datasource}"},
            "fieldConfig": {
                "defaults": {
                    "unit": "short",
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {"color": "red", "value": None},
                            {"color": "green", "value": 1},
                        ],
                    },
                },
                "overrides": [],
            },
            "gridPos": {"h": 4, "w": 8, "x": 0, "y": y},
            "id": pid,
            "options": {
                "colorMode": "background",
                "graphMode": "none",
                "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            },
            "targets": [
                {
                    "datasource": {"type": "prometheus", "uid": "${datasource}"},
                    "expr": f"up{{{job_filter}}}",
                    "instant": True,
                    "refId": "A",
                }
            ],
            "title": "Scrape UP",
            "type": "stat",
        }
    )

    desc = (
        f"Мониторинг {svc['repo']} (Micronaut): 4 золотых сигнала — "
        f"traffic, latency, errors, saturation."
    )
    if integration:
        desc += f" Исходящий HTTP: {metric}.integration.http."

    return {
        "annotations": {"list": []},
        "description": desc,
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 1,
        "id": None,
        "links": [],
        "panels": panels,
        "refresh": "30s",
        "schemaVersion": 39,
        "tags": [svc["repo"], svc["job"], "micronaut", "golden-signals"],
        "templating": {
            "list": [
                {
                    "name": "datasource",
                    "label": "Contour (Prometheus)",
                    "type": "datasource",
                    "query": "prometheus",
                    "current": {"text": "Prometheus-Prod", "value": "prometheus-prod"},
                    "regex": "/Prometheus-(Test|Prod)/",
                },
                {
                    "name": "job",
                    "label": "job",
                    "type": "constant",
                    "query": job,
                    "current": {"text": job, "value": job},
                    "hide": 2,
                },
            ]
        },
        "time": {"from": "now-6h", "to": "now"},
        "timezone": "browser",
        "title": f"{svc['title']} — golden signals",
        "uid": svc["uid"],
        "version": 1,
    }


def main() -> int:
    platform_root = Path(__file__).resolve().parents[1]
    services_root = platform_root.parent / "services"
    only = sys.argv[1:] if len(sys.argv) > 1 else []

    for svc in SERVICES:
        if only and svc["repo"] not in only and svc["job"] not in only:
            continue
        out_dir = services_root / svc["repo"] / "grafana"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / svc["file"]
        if svc["repo"] == "iam-service" and out_path.exists() and "--force" not in sys.argv:
            print(f"skip {out_path} (exists, use --force to overwrite)")
            continue
        body = build_dashboard(svc)
        out_path.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
