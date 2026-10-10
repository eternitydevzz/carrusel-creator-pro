# Arranca Carrusel Creator Pro en http://carrusel.localhost:3000 (Windows). Lo lanza arrancar.cmd.
# Deja esta ventana abierta mientras uses la app: al cerrarla se apaga el servidor.
$AQUI = Split-Path -Parent $MyInvocation.MyCommand.Path
$URL = "http://carrusel.localhost:3000"
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") + ";" + (Join-Path $env:APPDATA "npm")
Set-Location (Join-Path $AQUI "app")
if (-not (Test-Path "node_modules")) { Write-Host "Primero ejecuta instalar.ps1 (ver README)."; Read-Host "Pulsa Enter para cerrar"; exit 1 }

# Abre el navegador cuando el servidor responda (hasta 90 s), sin bloquear esta ventana
Start-Job -ScriptBlock {
  param($u)
  for ($i = 0; $i -lt 90; $i++) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:3000/" | Out-Null; break } catch { Start-Sleep -Seconds 1 }
  }
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($chrome) { Start-Process $chrome $u } else { Start-Process $u }
} -ArgumentList $URL | Out-Null

Write-Host "Carrusel Creator Pro -> $URL (deja esta ventana abierta mientras uses la app)"
& npm run dev
