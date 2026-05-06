$ErrorActionPreference = "Stop"

Write-Host "Starting Node API..."
Start-Process powershell -WorkingDirectory "$PSScriptRoot\apps\backend\node-api" -ArgumentList "-NoExit","-Command","npm run dev"

Write-Host "Starting Frontend..."
Start-Process powershell -WorkingDirectory "$PSScriptRoot\apps\frontend\react-chat-ui" -ArgumentList "-NoExit","-Command","npm run dev -- --host 0.0.0.0 --port 5173"

Write-Host "All services started in new windows (Node API + Frontend)."
