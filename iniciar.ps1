$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
function Assert-CommandSucceeded([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step fallo (codigo $LASTEXITCODE). Revisa el mensaje anterior." }
}
. (Join-Path $PSScriptRoot "preparar_entorno.ps1")
$econodoPython = Initialize-EcoNodoEnvironment -ProjectRoot $PSScriptRoot
& $econodoPython -m pip install --disable-pip-version-check -r requirements.txt
Assert-CommandSucceeded "La instalacion de dependencias"
Remove-Item Env:ECONODO_DEMO -ErrorAction SilentlyContinue
$env:ECONODO_DATA_DIR = Join-Path $PSScriptRoot "data"
& $econodoPython run_server.py
Assert-CommandSucceeded "El servidor (comprueba que el puerto este libre)"
