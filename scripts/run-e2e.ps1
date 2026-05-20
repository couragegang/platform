# Запуск E2E pytest (стек должен быть поднят: docker compose up --build)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$e2e = Join-Path $root "tests\e2e"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python not found. Install Python 3.10+"
}

Set-Location $e2e
python -m pip install -q -r requirements.txt
python -m pytest @args
