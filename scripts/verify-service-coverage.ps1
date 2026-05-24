# JaCoCo branch >= 80% for each Java service (JDK 21 via Docker or local gradlew).
# By default runs only BC repos with local git changes under services/.
# Usage:
#   .\verify-service-coverage.ps1
#   .\verify-service-coverage.ps1 -All -Parallel 4
#   .\verify-service-coverage.ps1 -Services iam-service,policy-service
#   .\verify-service-coverage.ps1 -UseLocalGradle
param(
    [string[]]$Services = @(),
    [switch]$All,
    [int]$Parallel = 1,
    [switch]$UseLocalGradle,
    [switch]$NoGradleCache
)

$ErrorActionPreference = "Stop"

$AllServices = @(
    "iam-service",
    "policy-service",
    "audit-service",
    "secrets-service",
    "ai-runtime",
    "bff-gateway",
    "mcp-gateway",
    "mcp-notion",
    "config-service",
    "knowledge-service"
)

if ($Services.Count -eq 1 -and $Services[0] -match ',') {
    $Services = $Services[0] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

$servicesRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\services")
$gradleImage = if ($env:GRADLE_DOCKER_IMAGE) { $env:GRADLE_DOCKER_IMAGE } else { "gradle:8.10.2-jdk21" }
$gradleCacheHost = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $env:USERPROFILE ".gradle" }

function Get-ChangedServiceRepos {
    param(
        [string]$Root,
        [string[]]$Known
    )
    $changed = [System.Collections.Generic.List[string]]::new()
    foreach ($name in $Known) {
        $dir = Join-Path $Root $name
        if (-not (Test-Path $dir)) { continue }
        if (-not (Test-Path (Join-Path $dir ".git"))) { continue }
        $status = git -C $dir status --porcelain 2>$null
        if ($status) {
            $changed.Add($name)
        }
    }
    return @($changed)
}

if ($Parallel -lt 1) {
    Write-Error "-Parallel must be >= 1"
}

if ($Services.Count -gt 0 -and $All) {
    Write-Error "Use either -Services or -All, not both"
}

$toRun = @()
if ($Services.Count -gt 0) {
    $toRun = @($Services)
}
elseif ($All) {
    $toRun = $AllServices
}
else {
    $toRun = Get-ChangedServiceRepos -Root $servicesRoot -Known $AllServices
    if ($toRun.Count -eq 0) {
        Write-Host "No local changes in Java BC repos under $servicesRoot - coverage gate skipped." -ForegroundColor Yellow
        Write-Host "Use -All to run all services, or -Services name to force one BC." -ForegroundColor DarkGray
        exit 0
    }
    Write-Host "Changed BC repos: $($toRun -join ', ')" -ForegroundColor Cyan
}

foreach ($name in $toRun) {
    if ($name -notin $AllServices) {
        Write-Error "Unknown service '$name'. Allowed: $($AllServices -join ', ')"
    }
}

function Test-LocalJdk21 {
    try {
        $out = & java -version 2>&1 | Out-String
        return $out -match 'version "21\.'
    }
    catch {
        return $false
    }
}

if ($UseLocalGradle -and -not (Test-LocalJdk21)) {
    Write-Error "UseLocalGradle requires JDK 21 on PATH (found: $(java -version 2>&1 | Select-Object -First 1))"
}

$mountGradleCache = (-not $UseLocalGradle) -and (-not $NoGradleCache)
if ($mountGradleCache -and -not (Test-Path $gradleCacheHost)) {
    New-Item -ItemType Directory -Path $gradleCacheHost -Force | Out-Null
}

$runner = {
    param(
        [string]$Name,
        [string]$Dir,
        [string]$GradleImage,
        [bool]$UseLocal,
        [bool]$MountCache,
        [string]$GradleCacheHost
    )

    function Convert-DockerVolumePath {
        param([string]$Path)
        $resolved = (Resolve-Path $Path).Path
        if ($resolved -match '^[A-Za-z]:') {
            $drive = $resolved.Substring(0, 1).ToLower()
            $rest = $resolved.Substring(2) -replace '\\', '/'
            return "${drive}:$rest"
        }
        return ($resolved -replace '\\', '/')
    }

    $gradleArgs = @("test", "jacocoTestCoverageVerification", "--no-daemon", "-q")
    try {
        if ($UseLocal) {
            $gradlew = Join-Path $Dir "gradlew.bat"
            if (-not (Test-Path $gradlew)) {
                $gradlew = Join-Path $Dir "gradlew"
            }
            Push-Location $Dir
            try {
                & $gradlew @gradleArgs 2>&1 | Out-Null
            }
            finally {
                Pop-Location
            }
        }
        else {
            $appVol = "$(Convert-DockerVolumePath $Dir):/app"
            $dockerArgs = @("run", "--rm", "-v", $appVol, "-w", "/app")
            if ($MountCache) {
                $cacheVol = "$(Convert-DockerVolumePath $GradleCacheHost):/root/.gradle"
                $dockerArgs += @("-v", $cacheVol)
            }
            $dockerArgs += $GradleImage
            $dockerArgs += "gradle"
            $dockerArgs += $gradleArgs
            & docker @dockerArgs 2>&1 | Out-Null
        }
        return @{ Name = $Name; ExitCode = $LASTEXITCODE }
    }
    catch {
        return @{ Name = $Name; ExitCode = 1; Error = $_.Exception.Message }
    }
}

Write-Host "Coverage gate: $($toRun.Count) service(s), Parallel=$Parallel, Docker=$(-not $UseLocalGradle)" -ForegroundColor Cyan
if ($mountGradleCache) {
    Write-Host "Gradle cache: $gradleCacheHost" -ForegroundColor DarkGray
}

$failed = [System.Collections.Generic.List[string]]::new()
$queue = [System.Collections.Generic.Queue[string]]::new()
foreach ($n in $toRun) { $queue.Enqueue($n) }

$jobs = @()
while ($queue.Count -gt 0 -or $jobs.Count -gt 0) {
    while ($queue.Count -gt 0 -and (@($jobs | Where-Object { $_.State -eq 'Running' }).Count) -lt $Parallel) {
        $name = $queue.Dequeue()
        $dir = Join-Path $servicesRoot $name
        Write-Host "Starting $name ..." -ForegroundColor Cyan
        $jobs += Start-Job -ScriptBlock $runner -ArgumentList @(
            $name, $dir, $gradleImage, [bool]$UseLocalGradle, [bool]$mountGradleCache, $gradleCacheHost
        )
    }

    if ($jobs.Count -eq 0) { break }

    $done = Wait-Job -Job $jobs -Any
    $received = @(Receive-Job -Job $done -ErrorAction SilentlyContinue)
    Remove-Job -Job $done
    $jobs = @($jobs | Where-Object { $_.Id -ne $done.Id })

    $result = $received | Where-Object { $_ -is [hashtable] } | Select-Object -Last 1
    if (-not $result) {
        $result = @{ Name = "unknown"; ExitCode = 1; Error = "no result from job" }
    }
    $code = if ($null -ne $result.ExitCode) { [int]$result.ExitCode } else { 1 }
    if ($code -ne 0) {
        $failed.Add($result.Name)
        $err = if ($result.Error) { " ($($result.Error))" } else { "" }
        Write-Host "FAILED: $($result.Name)$err" -ForegroundColor Red
    }
    else {
        Write-Host "OK: $($result.Name)" -ForegroundColor Green
    }
}

if ($failed.Count -gt 0) {
    Write-Error "Coverage check failed: $($failed -join ', ')"
}

Write-Host "`nAll $($toRun.Count) service(s) passed branch coverage >= 80%" -ForegroundColor Green
exit 0
