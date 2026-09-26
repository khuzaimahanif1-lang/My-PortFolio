param([Parameter(Mandatory = $true)][ValidateSet('api','frontend','relay')][string]$Service)
$ErrorActionPreference = 'Stop'
$portfolioRoot = Split-Path -Parent $PSScriptRoot
$portfolioStorage = Join-Path $portfolioRoot 'Backend/storage'
$portfolioOutput = Join-Path $portfolioStorage "runtime-$Service.out.log"
$portfolioErrors = Join-Path $portfolioStorage "runtime-$Service.err.log"
try {
    switch ($Service) {
        'api' {
            Set-Location -LiteralPath (Join-Path $portfolioRoot 'Backend')
            & (Join-Path $portfolioRoot 'Backend/.venv/Scripts/python.exe') -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log 1>> $portfolioOutput 2>> $portfolioErrors
        }
        'frontend' {
            Set-Location -LiteralPath (Join-Path $portfolioRoot 'Frontend')
            $env:API_URL = 'http://127.0.0.1:8000'; $env:PORT = '4000'
            & node (Join-Path $portfolioRoot 'Frontend/dist/Frontend/server/server.mjs') 1>> $portfolioOutput 2>> $portfolioErrors
        }
        'relay' {
            Set-Location -LiteralPath $portfolioRoot
            & node (Join-Path $portfolioRoot 'tools/local-turn.cjs') 1>> $portfolioOutput 2>> $portfolioErrors
        }
    }
    exit $LASTEXITCODE
} catch {
    $_ | Out-String | Add-Content -LiteralPath $portfolioErrors -Encoding utf8
    exit 1
}
