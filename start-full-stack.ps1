$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = "python"
$node = "npm"

Start-Process -FilePath powershell.exe -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "cd '$root'; $python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
) -WindowStyle Hidden

Start-Sleep -Seconds 3

Start-Process -FilePath powershell.exe -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "cd '$root'; $node run dev -- --host 127.0.0.1 --port 5175"
) -WindowStyle Hidden

Write-Host "Backend:  http://127.0.0.1:8000/api/health"
Write-Host "Frontend: http://127.0.0.1:5175/"
