#!/usr/bin/env python3
"""Patch Grafana dashboard JSON for local: один datasource, без выбора контура."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def patch_for_local(data: dict[str, Any]) -> dict[str, Any]:
    templating = data.get("templating") or {}
    items = templating.get("list") or []
    for item in items:
        if item.get("name") != "datasource":
            continue
        item["hide"] = 2
        item["label"] = "Prometheus"
        item["regex"] = ""
        item["includeAll"] = False
        item["current"] = {
            "selected": True,
            "text": "Prometheus",
            "value": "prometheus",
        }
    return data


def patch_file(src: Path, dest: Path) -> None:
    data = json.loads(src.read_text(encoding="utf-8"))
    patched = patch_for_local(data)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(patched, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: patch-grafana-dashboard-local.py <src.json> <dest.json>", file=sys.stderr)
        return 1
    patch_file(Path(sys.argv[1]), Path(sys.argv[2]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
