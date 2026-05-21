# Запуск E2E pytest (стек должен быть поднят: docker compose up --build)
# Секреты: platform/.env (см. .env.example)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-dotenv.ps1")
Import-PlatformDotEnv
$root = Split-Path -Parent $PSScriptRoot
$e2e = Join-Path $root "tests\e2e"

$python = if (Get-Command py -ErrorAction SilentlyContinue) { "py -3" } elseif (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } else { "python" }
$venvPython = Join-Path $e2e ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Invoke-Expression "$python -m venv `"$(Join-Path $e2e '.venv')`""
}
if (-not (Test-Path $venvPython)) {
    Write-Error "Python 3.10+ required (py -3 or python3). Install Python and retry."
}

Set-Location $e2e
& $venvPython -m pip install -q -r requirements.txt
& $venvPython -m pytest @args
