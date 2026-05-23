# Собирает build/runtime.env для docker compose (local | test | prod).
# Секреты из GitHub попадают в job env (CI) или из platform/.env (local).

param(
    [ValidateSet("local", "test", "prod")]
    [string]$Contour = "local",
    [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputFile) {
    $OutputFile = Join-Path $PlatformRoot "build\runtime.env"
}

$KeysFile = Join-Path $PlatformRoot "config\contours\secret-keys.txt"
$ContourFile = Join-Path $PlatformRoot "config\contours\$Contour.env"
$DotEnv = Join-Path $PlatformRoot ".env"

function Read-EnvFile([string]$Path) {
    $map = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $map
    }
    Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }
        $name = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()
        if ($name.Length -gt 0) { $map[$name] = $value }
    }
    $map
}

function Merge-Maps([hashtable]$Base, [hashtable]$Overlay) {
    foreach ($k in $Overlay.Keys) {
        if ($Overlay[$k]) { $Base[$k] = $Overlay[$k] }
    }
    $Base
}

$keys = Get-Content -LiteralPath $KeysFile -Encoding UTF8 |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and -not $_.StartsWith("#") }

$values = Read-EnvFile $ContourFile
$values["DEPLOY_CONTOUR"] = $Contour

if ($Contour -eq "local") {
    $values = Merge-Maps $values (Read-EnvFile $DotEnv)
}

# test/prod: переменные процесса (GitHub Actions secrets → env) перекрывают файл
foreach ($key in $keys) {
    $fromProcess = [Environment]::GetEnvironmentVariable($key)
    if ($fromProcess) {
        $values[$key] = $fromProcess
    }
}

$required = @(
    "JWT_SECRET",
    "SECRETS_ENCRYPTION_KEY",
    "CONFIG_INTERNAL_API_KEY",
    "POLICY_INTERNAL_API_KEY",
    "SECRETS_INTERNAL_API_KEY",
    "AUDIT_INTERNAL_API_KEY"
)
if ($Contour -eq "prod") {
    $missing = $required | Where-Object { -not $values[$_] }
    if ($missing) {
        throw "Contour prod: missing secrets in env or prod.env: $($missing -join ', '). Configure GitHub Environment 'prod'."
    }
}

$outDir = Split-Path -Parent $OutputFile
if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("DEPLOY_CONTOUR=$Contour")
foreach ($key in $keys) {
    if ($values.ContainsKey($key) -and $values[$key]) {
        $escaped = $values[$key] -replace '"', '\"'
        $lines.Add("$key=`"$escaped`"")
    }
}
[System.IO.File]::WriteAllLines($OutputFile, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote runtime env for contour '$Contour' -> $OutputFile ($($lines.Count) keys)"
