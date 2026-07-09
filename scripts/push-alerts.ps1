# Push alert rules to Grafana Cloud Ruler API
# Usage: powershell -NoProfile -File scripts/push-alerts.ps1

$ErrorActionPreference = "Stop"

$repoRoot   = Split-Path $PSScriptRoot -Parent
$envFile    = Join-Path $repoRoot ".env"
$alertsFile = Join-Path $repoRoot "dashboard-metrics\alerts\mangadock-alerts.yaml"
$namespace  = "mangadock"

if (-not (Test-Path $envFile)) {
    throw "Missing $envFile"
}

$envVars = @{}
foreach ($line in (Get-Content $envFile)) {
    if ($line -match '^\s*([^#=\s]+)\s*=\s*(.+)\s*$') {
        $envVars[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
    }
}

$remoteWriteUrl = $envVars["GRAFANA_REMOTE_WRITE_URL"]
$cloudUser      = $envVars["GRAFANA_CLOUD_USER"]
$cloudApiKey    = $envVars["GRAFANA_CLOUD_API_KEY"]

if (-not $remoteWriteUrl) { throw "GRAFANA_REMOTE_WRITE_URL not set in .env" }
if (-not $cloudUser)      { throw "GRAFANA_CLOUD_USER not set in .env" }
if (-not $cloudApiKey)    { throw "GRAFANA_CLOUD_API_KEY not set in .env" }

$baseUrl  = $remoteWriteUrl -replace "/api/prom/push$", ""
$rulerUrl = $baseUrl + "/api/prom/rules/" + $namespace

$body = [System.IO.File]::ReadAllText($alertsFile, [System.Text.Encoding]::UTF8)

$token   = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($cloudUser + ":" + $cloudApiKey))
$headers = @{
    Authorization  = "Basic " + $token
    "Content-Type" = "application/yaml"
}

Write-Host "Pushing to: $rulerUrl"

$response = Invoke-WebRequest -Uri $rulerUrl -Method POST -Headers $headers -Body $body -UseBasicParsing
Write-Host "OK ($($response.StatusCode)) - alert rules pushed to namespace '$namespace'"
