# Start Next.js dev server and tee all output to a daily log file.
# Usage: .\start-dev.ps1
# Log location: Frontend\logs\frontend-YYYY-MM-DD.log

Set-Location $PSScriptRoot

$logDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$date    = Get-Date -Format "yyyy-MM-dd"
$logFile = Join-Path $logDir "frontend-$date.log"

# Session separator so multiple restarts are distinguishable
$sep = "=" * 72
"", $sep, "[session start] $(Get-Date -Format 'o')", $sep | Add-Content -Path $logFile

Write-Host "Frontend log: $logFile" -ForegroundColor Cyan

# bun dev output has ANSI codes — Tee-Object keeps them on-screen, strips on write
# because PowerShell converts them to plain text in the file automatically.
bun dev 2>&1 | Tee-Object -FilePath $logFile -Append
