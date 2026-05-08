$ErrorActionPreference = "Stop"

function Stop-PortProcess {
  param([int]$Port)

  $lines = netstat -ano | findstr ":$Port"
  if (-not $lines) {
    Write-Host "[dev] No process listening on port $Port."
    return
  }

  $procIds = @()
  foreach ($line in $lines) {
    $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
    if ($parts.Length -ge 5) {
      $procIds += $parts[-1]
    }
  }

  $procIds = $procIds | Sort-Object -Unique
  foreach ($procId in $procIds) {
    if ($procId -match '^\d+$' -and [int]$procId -gt 4) {
      Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
      Write-Host "[dev] Stopped PID $procId on port $Port."
    }
  }
}

Stop-PortProcess -Port 3001
Stop-PortProcess -Port 5174
Write-Host "[dev] Done."
