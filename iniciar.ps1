$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
function Assert-CommandSucceeded([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step fallo (codigo $LASTEXITCODE). Revisa el mensaje anterior." }
}
. (Join-Path $PSScriptRoot "preparar_entorno.ps1")
$econodoPython = Initialize-EcoNodoEnvironment -ProjectRoot $PSScriptRoot
& $econodoPython -m pip install --disable-pip-version-check -r requirements.txt
Assert-CommandSucceeded "La instalacion de dependencias"
# Si un servidor EcoNodo anterior sigue ocupando el puerto, se detiene para que
# arranque esta version (si no, seguiria respondiendo el codigo viejo).
$econodoPort = 5000
foreach ($configFile in @("config.json", "config.local.json")) {
    if (Test-Path -LiteralPath $configFile) {
        $parsed = Get-Content -LiteralPath $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($parsed.port) { $econodoPort = [int]$parsed.port }
    }
}
$listeners = Get-NetTCPConnection -LocalPort $econodoPort -State Listen -ErrorAction SilentlyContinue
foreach ($ownerId in @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId" -ErrorAction SilentlyContinue
    if ($owner -and $owner.CommandLine -match "run_server\.py") {
        Write-Host "Deteniendo un servidor EcoNodo anterior (proceso $ownerId) que ocupaba el puerto $econodoPort..."
        Stop-Process -Id $ownerId -Force
        Start-Sleep -Seconds 1
    } elseif ($owner) {
        throw "El puerto $econodoPort esta ocupado por otro programa ($($owner.Name), proceso $ownerId). Cierralo o cambia 'port' en config.local.json."
    }
}
Remove-Item Env:ECONODO_DEMO -ErrorAction SilentlyContinue
$env:ECONODO_DATA_DIR = Join-Path $PSScriptRoot "data"
& $econodoPython run_server.py
Assert-CommandSucceeded "El servidor (comprueba que el puerto este libre)"
