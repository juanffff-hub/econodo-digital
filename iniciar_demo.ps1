$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
function Assert-CommandSucceeded([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step falló (código $LASTEXITCODE). El servidor no se ha iniciado." }
}
. (Join-Path $PSScriptRoot "preparar_entorno.ps1")
$econodoPython = Initialize-EcoNodoEnvironment -ProjectRoot $PSScriptRoot
& $econodoPython -m pip install --disable-pip-version-check -r requirements.txt
Assert-CommandSucceeded "La instalación de dependencias"
# El cargador y Flask usan exactamente la misma carpeta, incluso si hay variables heredadas.
$env:ECONODO_DEMO = "1"
$env:ECONODO_DATA_DIR = Join-Path $PSScriptRoot "demo_data"
& $econodoPython tools\cargar_demo.py
Assert-CommandSucceeded "La carga de lecturas de demostración"
& $econodoPython run_server.py
Assert-CommandSucceeded "El servidor (comprueba que el puerto esté libre)"
