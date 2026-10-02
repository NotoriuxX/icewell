# ICEWELL — vista previa pública temporal del sitio con Docker (Cloudflare Quick Tunnel).
#   powershell -File herramientas/tunel.ps1           sube el túnel (y el sitio si no estaba) e imprime la URL
#   powershell -File herramientas/tunel.ps1 -Apagar   baja solo el túnel; http://localhost:8080 sigue arriba
# Solo sale el sitio: /admin y /api quedan bloqueados (ver docker-compose.tunel.yml y docker/Caddyfile.tunel).
# La URL cambia cada vez y muere al apagar el túnel o la PC.
param([switch]$Apagar)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot

# docker.exe: Docker Desktop instalado por usuario no siempre queda en el PATH (ni su docker-credential-desktop)
$bin = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $bin)) { $env:PATH = "$bin;$env:PATH" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Write-Error 'No encuentro docker. Abre Docker Desktop y reintenta.'; exit 1 }

$archivos = @('--progress', 'quiet', '-f', "$raiz\docker-compose.yml", '-f', "$raiz\docker-compose.dev.yml", '-f', "$raiz\docker-compose.tunel.yml")

if ($Apagar) {
  docker compose @archivos rm -sf tunel tunel-proxy | Out-Null
  Write-Host 'Túnel apagado. El sitio local sigue en http://localhost:8080'
  exit 0
}

Write-Host 'Levantando el túnel (la primera vez descarga las imágenes de Caddy y cloudflared)...'
docker compose @archivos up -d | Out-Null
# recrear el contenedor del túnel para que salga una URL nueva y su log venga limpio
docker compose @archivos up -d --force-recreate tunel | Out-Null

$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  $log = (docker compose @archivos logs --no-color tunel 2>&1) -join "`n"
  if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $url = $Matches[0] }
}
if (-not $url) { Write-Error 'El túnel no entregó URL en 60 s. Revisa: docker compose ... logs tunel'; exit 1 }

Write-Host ''
Write-Host "  Sitio:         $url"
Write-Host "  Currículum:    $url/curriculum"
Write-Host "  Presentación:  $url/presentacion"
Write-Host ''
Write-Host 'El panel (/admin) NO sale por el túnel. Puede tardar unos segundos en responder la primera vez.'
Write-Host 'Para apagarlo: powershell -File herramientas/tunel.ps1 -Apagar'
