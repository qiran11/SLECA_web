$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$condaPython = "D:\Anaconda3\envs\sleca_api\python.exe"
$python = "python"
if (Test-Path $condaPython) {
  $python = $condaPython
} elseif (Test-Path $venvPython) {
  $check = & $venvPython -c "import uvicorn, click" 2>$null
  if ($LASTEXITCODE -eq 0) {
    $python = $venvPython
  }
}
$apiPort = if ($env:SLECA_API_PORT) { [int]$env:SLECA_API_PORT } else { 8010 }
$webPort = if ($env:SLECA_WEB_PORT) { [int]$env:SLECA_WEB_PORT } else { 5175 }

$ipv4Lines = ipconfig | Select-String -Pattern "IPv4"
$lanIp = $null
foreach ($line in $ipv4Lines) {
  if ($line.Line -match "(\d{1,3}(\.\d{1,3}){3})") {
    $candidate = $matches[1]
    if ($candidate -notlike "127.*" -and $candidate -notlike "169.254.*") {
      $lanIp = $candidate
      break
    }
  }
}

if (-not $lanIp) {
  throw "Could not find a LAN IPv4 address. Please check your network connection."
}

foreach ($port in @($apiPort, $webPort)) {
  $listeners = netstat -ano | Select-String -Pattern ":$port\s+.*LISTENING"
  foreach ($listener in $listeners) {
    $parts = $listener.Line.Trim() -split "\s+"
    $processId = [int]$parts[-1]
    if ($processId -gt 0) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

Start-Sleep -Seconds 2

Start-Process -FilePath $python -ArgumentList @(
  "-m",
  "uvicorn",
  "backend.main:app",
  "--host",
  "0.0.0.0",
  "--port",
  "$apiPort"
) -WorkingDirectory $root -WindowStyle Hidden

Start-Sleep -Seconds 3

$webCommand = "`$env:VITE_API_BASE='http://$lanIp`:$apiPort'; npm.cmd run dev -- --host 0.0.0.0 --port $webPort"
Start-Process -FilePath powershell.exe -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  $webCommand
) -WorkingDirectory $root -WindowStyle Hidden

Write-Host "LAN frontend: http://$lanIp`:$webPort/"
Write-Host "LAN backend:  http://$lanIp`:$apiPort/api/health"
Write-Host "Local only:   http://127.0.0.1:$webPort/"
Write-Host ""
Write-Host "For a temporary domain test on one computer, map sleca-repository.com to $lanIp in that computer's hosts file."
Write-Host "For everyone on the internet, create A records for @ and www pointing to the server's public IP, then serve on ports 80/443."
