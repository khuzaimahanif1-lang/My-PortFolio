param([string]$Origin = 'http://127.0.0.1:4000')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portfolioPython = Join-Path $PSScriptRoot 'Backend/.venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $portfolioPython)) {
    $portfolioSystemPython = Get-Command python -ErrorAction SilentlyContinue
    if (-not $portfolioSystemPython) { throw 'Install Python for Windows with Tkinter to run the desktop helper.' }
    $portfolioPython = $portfolioSystemPython.Source
}
& $portfolioPython -X utf8 tools/desktop_helper.py --origin $Origin
