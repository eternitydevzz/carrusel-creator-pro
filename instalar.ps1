# Instala lo que hace falta para Carrusel Creator Pro en Windows 10/11. Se puede ejecutar varias veces.
# Uso (en PowerShell, dentro de la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File .\instalar.ps1
# "Continue": en PowerShell 5, con "Stop" cualquier aviso que un programa escriba en stderr (npm, pip) cortaría el script
$ErrorActionPreference = "Continue"
$AQUI = Split-Path -Parent $MyInvocation.MyCommand.Path
$CODEX_PROBADO = "0.158.0"
Write-Host "Carrusel Creator Pro · instalación (Windows)"

function Refrescar-Path {
  # winget instala en el PATH del sistema, pero esta ventana no lo ve hasta que se recarga
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  $npm = Join-Path $env:APPDATA "npm"
  if ((Test-Path $npm) -and ($env:Path -notlike "*$npm*")) { $env:Path += ";$npm" }
}
function Tiene($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Instalar-Winget($id, $nombre) {
  Write-Host "  -> instalando $nombre"
  winget install --id $id -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
  Refrescar-Path
}

if (-not (Tiene "winget")) {
  Write-Host "Falta winget (el instalador de aplicaciones de Windows). Instala 'Instalador de aplicación' desde Microsoft Store y vuelve a ejecutar este script."
  exit 1
}
Refrescar-Path

# Herramientas: comando que se comprueba, paquete de winget, nombre
$herramientas = @(
  @("node", "OpenJS.NodeJS.LTS", "Node.js"),
  @("ffmpeg", "Gyan.FFmpeg", "ffmpeg"),
  @("exiftool", "OliverBetz.ExifTool", "ExifTool"),
  @("python", "Python.Python.3.12", "Python 3"),
  @("git", "Git.Git", "Git for Windows (lo usa Claude Code)")
)
foreach ($h in $herramientas) {
  if (Tiene $h[0]) { Write-Host "  OK $($h[2])" } else { Instalar-Winget $h[1] $h[2] }
}
foreach ($h in $herramientas) {
  if (-not (Tiene $h[0])) {
    Write-Host "  ! No encuentro $($h[2]) después de instalarlo. Cierra esta ventana, abre una nueva y vuelve a ejecutar el script."
    exit 1
  }
}
# "python" puede ser el atajo de Microsoft Store que no hace nada: se comprueba que funcione de verdad
$v = (& python -c "import sys; print(sys.version_info[0])" 2>$null)
if ($v -ne "3") {
  Write-Host "  ! 'python' no responde: abre Configuración > Aplicaciones > Alias de ejecución de aplicaciones, desactiva los de python y vuelve a ejecutar el script."
  exit 1
}
$node = [int]((& node --version) -replace "^v(\d+).*", '$1')
if ($node -lt 20) { Write-Host "  ! Node $(& node --version) es antiguo: hace falta 20 o más (winget upgrade OpenJS.NodeJS.LTS)"; exit 1 }

Write-Host "  -> Pillow (el motor dibuja el pie con Pillow)"
& python -m pip install --user -q -r (Join-Path $AQUI "motor\requirements.txt")
& python -c "import PIL" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  ! No se pudo instalar Pillow: ejecuta  python -m pip install --user pillow  y mira el error."; exit 1 }
& python -m pip install --user -q pillow-heif 2>$null  # opcional: fotos HEIC del iPhone

if (Tiene "codex") {
  $cv = ((& codex --version) -split " ")[1]
  if ($cv -eq $CODEX_PROBADO) { Write-Host "  OK codex $cv" } else { Write-Host "  ! codex $cv : el motor está probado con $CODEX_PROBADO. Si falla al generar: npm install -g @openai/codex@$CODEX_PROBADO" }
} else { Write-Host "  -> instalando Codex CLI $CODEX_PROBADO"; & npm install -g "@openai/codex@$CODEX_PROBADO"; Refrescar-Path }
if (Tiene "claude") { Write-Host "  OK claude" } else { Write-Host "  -> instalando Claude Code"; & npm install -g "@anthropic-ai/claude-code"; Refrescar-Path }

Write-Host "  -> dependencias de la app"
Push-Location (Join-Path $AQUI "app")
& npm install --silent
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "  ! npm install falló: revisa el mensaje de arriba."; exit 1 }
Pop-Location

$D = Join-Path $AQUI "datos"
foreach ($sub in @("marca\fotos", "fichas", "virales", "salida")) { New-Item -ItemType Directory -Force -Path (Join-Path $D $sub) | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding($false)  # sin BOM: el motor lee estos archivos como UTF-8
$marca = Join-Path $D "marca\marca.txt"
if (-not (Test-Path $marca)) {
  $texto = @"
handle: @tucuenta
azul: #1A79FB
angulo:
ropa: traje azul marino y camisa blanca, sin corbata
idioma: español. Se dice "AI", nunca "IA"
fotos:
tipografia:
pie: a la izquierda el handle y el lema; a la derecha botón "DESLIZA →" y el adelanto del siguiente slide; en el último, "+ SEGUIR"
lema:
tope_imagenes_dia: 60
"@
  [IO.File]::WriteAllText($marca, ($texto -replace "`r`n", "`n") + "`n", $utf8)
}
$cuenta = Join-Path $D "CUENTA_ACTUAL.txt"
if (-not (Test-Path $cuenta)) { [IO.File]::WriteAllText($cuenta, "cuenta1`n", $utf8) }

# Acceso directo en el escritorio: abre la app (arrancar.cmd) con el logo de Código MaestrIA
try {
  $ico = Join-Path $AQUI "app\public\carrusel.ico"
  & python -c "import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])" (Join-Path $AQUI "app\public\icon-512.png") $ico
  $sh = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Carrusel Creator Pro.lnk"))
  $sh.TargetPath = Join-Path $AQUI "arrancar.cmd"
  $sh.WorkingDirectory = $AQUI
  $sh.IconLocation = $ico
  $sh.Save()
  Write-Host "  OK acceso directo 'Carrusel Creator Pro' en el escritorio"
} catch { Write-Host "  ! No se pudo crear el acceso directo (no pasa nada: arranca con arrancar.cmd)" }

Write-Host ""
$sesion = (& codex login status 2>&1) -join " "
if (($sesion -match "logged in") -and ($sesion -notmatch "not logged in")) { Write-Host "  OK Codex conectado" } else { Write-Host "  ! Codex sin sesión: ejecuta  codex login  (se abre el navegador)" }
Write-Host ""
Write-Host "Listo. Arranca con el acceso directo del escritorio o con arrancar.cmd (se abre en http://carrusel.localhost:3000)."
Write-Host "Primera vez: entra en Claude Code con  claude  , y en la app: Ajustes (clave de ScrapeCreators) y Branding (tus fotos y tu marca)."
