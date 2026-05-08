$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendWd = Join-Path $root "apps\backend\node-api"
$frontendWd = Join-Path $root "apps\frontend\react-chat-ui"
$logsDir = Join-Path $root "logs"

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

Write-Host "[dev] Starting backend on http://127.0.0.1:3001 ..."
$backendCmd = "Set-Location '$backendWd'; node src/index.js"
Start-Process -FilePath powershell `
  -ArgumentList '-NoProfile','-Command',$backendCmd `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logsDir "node-api.out.log") `
  -RedirectStandardError (Join-Path $logsDir "node-api.err.log")

Start-Sleep -Seconds 2

Write-Host "[dev] Starting frontend on http://127.0.0.1:5174 ..."
$frontendCmd = "Set-Location '$frontendWd'; npm run dev -- --host 127.0.0.1 --port 5174"
Start-Process -FilePath powershell `
  -ArgumentList '-NoProfile','-Command',$frontendCmd `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logsDir "frontend.out.log") `
  -RedirectStandardError (Join-Path $logsDir "frontend.err.log")

Write-Host "[dev] Services started. Run 'npm run dev:health' to verify status."
