$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath ".venv\Scripts\python.exe")) {
    throw "Primero ejecuta iniciar.ps1 para crear el entorno del servidor."
}
& ".venv\Scripts\python.exe" tools\comprobar_conexion.py
exit $LASTEXITCODE
