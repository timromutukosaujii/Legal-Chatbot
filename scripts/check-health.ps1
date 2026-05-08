$ErrorActionPreference = "Stop"

function Probe {
  param([string]$Name, [string]$Url)
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 6
    Write-Host ("[ok] " + $Name + " -> " + $resp.StatusCode + " (" + $Url + ")")
  } catch {
    Write-Host ("[down] " + $Name + " -> " + $_.Exception.Message)
  }
}

Probe -Name "Backend health" -Url "http://127.0.0.1:3001/health"
Probe -Name "Frontend" -Url "http://127.0.0.1:5174"
