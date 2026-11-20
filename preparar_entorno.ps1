# Entornos virtuales de Windows no se trasladan entre computadores.
function Test-EcoNodoPython {
    param([string]$Executable, [string[]]$PythonArguments = @())
    if (-not $Executable) { return $false }
    try {
        & $Executable @PythonArguments -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" *> $null
        return ($LASTEXITCODE -eq 0)
    }
    catch { return $false }
}

function Initialize-EcoNodoEnvironment {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)

    $projectDirectory = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
    $environmentDirectory = Join-Path $projectDirectory ".venv"
    $environmentPython = Join-Path $environmentDirectory "Scripts\python.exe"
    if ((Test-Path -LiteralPath $environmentPython) -and (Test-EcoNodoPython -Executable $environmentPython)) {
        return $environmentPython
    }

    # Elegir un Python instalado aqui antes de tocar el entorno anterior.
    $candidates = @()
    if ($env:ECONODO_PYTHON) {
        $candidates += @{ Executable = $env:ECONODO_PYTHON; Arguments = @() }
    }
    else {
        $launcher = Get-Command py -ErrorAction SilentlyContinue
        if ($launcher) { $candidates += @{ Executable = $launcher.Source; Arguments = @("-3") } }
        $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
        if ($pythonCommand) { $candidates += @{ Executable = $pythonCommand.Source; Arguments = @() } }
    }
    $selectedPython = $null
    foreach ($candidate in $candidates) {
        if (Test-EcoNodoPython -Executable $candidate.Executable -PythonArguments $candidate.Arguments) {
            $selectedPython = $candidate
            break
        }
    }
    if (-not $selectedPython) {
        throw "No se encontro Python 3.10 o posterior funcionando en este PC. Instalalo, abre otra terminal y repite iniciar.ps1. Si usas ECONODO_PYTHON, comprueba su ruta. No se modifico el entorno anterior."
    }

    if (Test-Path -LiteralPath $environmentDirectory) {
        # Solo renombrar la carpeta .venv directamente dentro de este proyecto.
        if ([IO.Path]::GetDirectoryName($environmentDirectory) -ne $projectDirectory) {
            throw "La carpeta del entorno no pertenece al proyecto."
        }
        $backupName = ".venv_incompatible_" + (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + ([guid]::NewGuid().ToString("N").Substring(0, 8))
        Write-Host "El entorno copiado no funciona en este PC. Se conserva como $backupName."
        Rename-Item -LiteralPath $environmentDirectory -NewName $backupName
    }

    Write-Host "Creando un entorno Python propio de este computador..."
    $baseExecutable = $selectedPython.Executable
    $baseArguments = $selectedPython.Arguments
    & $baseExecutable @baseArguments -m venv $environmentDirectory | Out-Host
    if ($LASTEXITCODE -ne 0 -or -not (Test-EcoNodoPython -Executable $environmentPython)) {
        throw "No se pudo crear el entorno Python. Revisa el mensaje anterior y la instalacion de Python."
    }
    return $environmentPython
}
