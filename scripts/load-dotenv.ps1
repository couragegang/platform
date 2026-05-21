# Загружает platform/.env в переменные процесса (для smoke-test.ps1, run-e2e.ps1).
function Import-PlatformDotEnv {
    param(
        [string]$EnvFile = (Join-Path (Split-Path -Parent $PSScriptRoot) ".env")
    )
    if (-not (Test-Path -LiteralPath $EnvFile)) {
        return
    }
    Get-Content -LiteralPath $EnvFile -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith("#")) {
            return
        }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) {
            return
        }
        $name = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($name.Length -gt 0) {
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}
