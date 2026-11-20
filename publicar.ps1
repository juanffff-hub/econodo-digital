# Publica EcoNodo en internet con Tailscale Funnel: una direccion HTTPS fija
# (https://<equipo>.<red>.ts.net) que no depende de la IP que el hotspot le de al PC.
# Se ejecuta UNA vez: Funnel queda activo en segundo plano, tambien tras reiniciar.
#   powershell -ExecutionPolicy Bypass -File .\publicar.ps1             (activar)
#   powershell -ExecutionPolicy Bypass -File .\publicar.ps1 -Desactivar (apagar)
param([switch]$Desactivar)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$tailscale = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $tailscale) {
    $default = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
    if (Test-Path -LiteralPath $default) { $tailscale = $default }
}
if (-not $tailscale) {
    Write-Host "Tailscale no esta instalado. Instalalo (gratis) con:"
    Write-Host "  winget install --id Tailscale.Tailscale"
    Write-Host "o desde https://tailscale.com/download/windows . Despues abre otra terminal y repite publicar.ps1."
    exit 1
}

# Puerto publico (solo lectura, escucha solo en este PC) segun la configuracion.
$publicPort = 5080
foreach ($configFile in @("config.json", "config.local.json")) {
    if (Test-Path -LiteralPath $configFile) {
        $parsed = Get-Content -LiteralPath $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($parsed.public_port) { $publicPort = [int]$parsed.public_port }
    }
}

function Set-EcoNodoPublicUrl([string]$Url) {
    $path = Join-Path $PSScriptRoot "config.local.json"
    $data = [pscustomobject]@{}
    if (Test-Path -LiteralPath $path) {
        $data = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    if ($data.PSObject.Properties.Name -contains "public_url") { $data.public_url = $Url }
    else { $data | Add-Member -NotePropertyName public_url -NotePropertyValue $Url }
    # UTF-8 sin BOM: con BOM el servidor no podria leer el JSON.
    [IO.File]::WriteAllText($path, ($data | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
}

if ($Desactivar) {
    & $tailscale funnel --bg $publicPort off
    Set-EcoNodoPublicUrl ""
    Write-Host "Funnel desactivado. La pagina vuelve a ser solo de la red local. Reinicia iniciar.ps1."
    exit 0
}

$status = & $tailscale status --json | ConvertFrom-Json
if ($status.BackendState -ne "Running") {
    Write-Host "Inicia sesion en Tailscale en el navegador que se abrira (cuenta gratuita)..."
    & $tailscale up
    if ($LASTEXITCODE -ne 0) { throw "No se pudo iniciar sesion en Tailscale." }
    $status = & $tailscale status --json | ConvertFrom-Json
}

Write-Host "Activando Funnel hacia 127.0.0.1:$publicPort ..."
Write-Host "La primera vez Tailscale muestra un enlace para habilitar HTTPS/Funnel en tu cuenta: abrelo, aceptalo y espera."
& $tailscale funnel --bg $publicPort
if ($LASTEXITCODE -ne 0) { throw "Tailscale no pudo activar Funnel (codigo $LASTEXITCODE). Revisa el mensaje anterior." }

$dnsName = "$($status.Self.DNSName)".TrimEnd(".")
if (-not $dnsName) { throw "No se pudo leer el nombre publico del equipo en Tailscale." }
$publicUrl = "https://$dnsName"
Set-EcoNodoPublicUrl $publicUrl

Write-Host ""
Write-Host "LISTO. Direccion publica fija de EcoNodo:"
Write-Host "  Pagina:            $publicUrl"
Write-Host "  QR para imprimir:  $publicUrl/acceso"
Write-Host "Se guardo en config.local.json (public_url). Reinicia iniciar.ps1 para que /acceso la use."
Write-Host "Funnel seguira activo tras reiniciar el PC; solo hace falta que iniciar.ps1 este corriendo."
Write-Host "Puede tardar unos minutos la primera vez mientras se emite el certificado HTTPS."
