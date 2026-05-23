# Pytest smoke (стек: docker compose up в platform/)
$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "run-e2e.ps1") -m smoke @args
