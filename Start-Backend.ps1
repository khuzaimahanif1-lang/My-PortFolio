$ErrorActionPreference = 'Stop'
$backendRoot = Join-Path $PSScriptRoot 'Backend'

function Stop-ProjectBackendOnPort8000 {
    $portOwner = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $portOwner) { return }

    $portProcess = Get-Process -Id $portOwner.OwningProcess -ErrorAction SilentlyContinue
    if (-not $portProcess) { return }

    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($portProcess.Id)").CommandLine
    if (-not ($commandLine -match 'uvicorn' -and $commandLine -match 'app\.main:app')) {
        throw "Port 8000 is already in use by PID $($portProcess.Id) ($($portProcess.ProcessName)). Stop it before starting the backend."
    }

    Stop-Process -Id $portProcess.Id -Force -ErrorAction Stop
    Write-Host "Stopped stale backend process on port 8000 (PID $($portProcess.Id))."
}

Set-Location -LiteralPath $backendRoot
Stop-ProjectBackendOnPort8000
if (-not (Test-Path '.venv\Scripts\python.exe')) { python -m venv .venv }
if (-not (Test-Path '.env')) {
    $generatedSecret = & .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
    Set-Content -LiteralPath '.env' -Value "JWT_SECRET=$generatedSecret" -Encoding utf8
}
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& .\.venv\Scripts\python.exe -m app.seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$portfolioRelayProcess = $null
$portfolioBackendEnv = Get-Content -Raw -LiteralPath '.env'
if ($portfolioBackendEnv -match 'WEBRTC_TURN_URL=turn:127\.0\.0\.1:3478') {
    if (-not (Get-NetUDPEndpoint -LocalPort 3478 -ErrorAction SilentlyContinue)) {
        $portfolioToolsPath = Join-Path $PSScriptRoot 'tools'
        if (-not (Test-Path -LiteralPath (Join-Path $portfolioToolsPath 'node_modules/node-turn'))) {
            $env:NODE_OPTIONS = ($env:NODE_OPTIONS + ' --use-system-ca').Trim()
            & npm ci --prefix $portfolioToolsPath --ignore-scripts
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        $portfolioRelayScript = Join-Path $portfolioToolsPath 'local-turn.cjs'
        $portfolioRelayArgument = '"' + $portfolioRelayScript + '"'
        $portfolioRelayProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList $portfolioRelayArgument -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
    }
}
try { & .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log }
finally { if ($portfolioRelayProcess -and -not $portfolioRelayProcess.HasExited) { Stop-Process -Id $portfolioRelayProcess.Id -ErrorAction SilentlyContinue } }

