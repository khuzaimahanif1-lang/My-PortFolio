param([switch]$Build)
$ErrorActionPreference = 'Stop'
$portfolioRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$portfolioBackend = Join-Path $portfolioRoot 'Backend'
$portfolioFrontend = Join-Path $portfolioRoot 'Frontend'
$portfolioStorage = Join-Path $portfolioBackend 'storage'
$portfolioRuntimePath = Join-Path $portfolioStorage 'local-runtime.json'
$portfolioPython = Join-Path $portfolioBackend '.venv/Scripts/python.exe'
$portfolioNode = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $portfolioPython)) { throw 'Initialize Backend with Start-Backend.ps1 first.' }
if (-not (Test-Path -LiteralPath (Join-Path $portfolioBackend '.env'))) { throw 'Initialize Backend/.env with Start-Backend.ps1 first.' }
New-Item -ItemType Directory -Path $portfolioStorage -Force | Out-Null
$portfolioPrevious = @()
if (Test-Path -LiteralPath $portfolioRuntimePath) {
    try { $portfolioSaved = Get-Content -Raw -LiteralPath $portfolioRuntimePath | ConvertFrom-Json; if ($portfolioSaved.project -eq $portfolioRoot) { $portfolioPrevious = @($portfolioSaved.services) } } catch {}
}
$portfolioServices = [System.Collections.Generic.List[object]]::new()
function Get-PortfolioListener([int]$Port, [string]$Protocol = 'TCP') {
    $portfolioPattern = if ($Protocol -eq 'UDP') { '^\s*UDP\s+127\.0\.0\.1:' + $Port + '\s+\*:\*\s+(\d+)\s*$' } else { '^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):' + $Port + '\s+\S+\s+LISTENING\s+(\d+)\s*$' }
    foreach ($portfolioLine in (& netstat -ano -p $Protocol)) { if ($portfolioLine -match $portfolioPattern) { return [int]$Matches[1] } }
    return $null
}
function Test-PortfolioHttp([string]$Uri, [switch]$Api) {
    try {
        if ($Api) { $portfolioHealth = Invoke-RestMethod -Uri $Uri -TimeoutSec 3; return $portfolioHealth.status -eq 'ok' -and $portfolioHealth.service -eq 'king-ai' }
        $portfolioResponse = Invoke-WebRequest -Uri $Uri -TimeoutSec 5 -UseBasicParsing
        return $portfolioResponse.StatusCode -eq 200 -and $portfolioResponse.Content.Contains('<app-root')
    } catch { return $false }
}
function Wait-PortfolioHttp([string]$Uri, [string]$Role, [System.Diagnostics.Process]$Child, [switch]$Api) {
    $portfolioDeadline = [DateTime]::UtcNow.AddSeconds(40)
    do {
        if (Test-PortfolioHttp -Uri $Uri -Api:$Api) { return }
        if ($Child.HasExited) { throw "$Role exited before becoming ready. See Backend/storage/runtime-$Role.err.log." }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $portfolioDeadline)
    throw "$Role did not become ready. See Backend/storage/runtime-$Role.err.log."
}
function Add-PortfolioService([string]$Role, [int]$ServiceId, [bool]$Created) {
    $portfolioProcess = Get-Process -Id $ServiceId -ErrorAction Stop
    $portfolioTicks = $portfolioProcess.StartTime.ToUniversalTime().Ticks.ToString()
    $portfolioOwned = $Created -or @($portfolioPrevious | Where-Object { $_.role -eq $Role -and $_.pid -eq $ServiceId -and $_.started_ticks -eq $portfolioTicks -and $_.managed }).Count -gt 0
    $portfolioServices.Add([pscustomobject]@{ role = $Role; pid = $ServiceId; started_ticks = $portfolioTicks; managed = $portfolioOwned })
    $portfolioRuntimeJson = [pscustomobject]@{ project = $portfolioRoot; services = @($portfolioServices.ToArray()) } | ConvertTo-Json -Depth 4
    $portfolioTemporaryRecord = Join-Path $portfolioStorage ('runtime-write-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    $portfolioStoragePrefix = [System.IO.Path]::GetFullPath($portfolioStorage).TrimEnd('\') + '\'
    if (-not [System.IO.Path]::GetFullPath($portfolioTemporaryRecord).StartsWith($portfolioStoragePrefix,[StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.Path]::GetFullPath($portfolioRuntimePath).StartsWith($portfolioStoragePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Runtime record target is outside project storage.' }
    [System.IO.File]::WriteAllText($portfolioTemporaryRecord,$portfolioRuntimeJson,[System.Text.UTF8Encoding]::new($false))
    try {
        # Windows PowerShell 5.1 has no File.Move(source, destination, overwrite) overload.
        if ([System.IO.File]::Exists($portfolioRuntimePath)) {
            [System.IO.File]::Replace($portfolioTemporaryRecord,$portfolioRuntimePath,[NullString]::Value)
        } else {
            [System.IO.File]::Move($portfolioTemporaryRecord,$portfolioRuntimePath)
        }
    }
    finally { if (Test-Path -LiteralPath $portfolioTemporaryRecord) { Remove-Item -LiteralPath $portfolioTemporaryRecord -Force } }
}
function Start-PortfolioChild([string]$Role) {
    $portfolioShell = (Get-Process -Id $PID).Path
    $portfolioRunner = Join-Path $portfolioRoot 'tools/run-local-service.ps1'
    # A separate hidden console avoids inheriting the launching terminal's pipes.
    Start-Process -FilePath $portfolioShell -ArgumentList @('-NoProfile','-NonInteractive','-File',('"' + $portfolioRunner + '"'),'-Service',$Role) -WorkingDirectory $portfolioRoot -WindowStyle Hidden -PassThru
}
$portfolioServerFile = Join-Path $portfolioFrontend 'dist/Frontend/server/server.mjs'
if ($Build -or -not (Test-Path -LiteralPath $portfolioServerFile)) {
    $portfolioExistingFrontend = Get-PortfolioListener -Port 4000
    if ($portfolioExistingFrontend) {
        $portfolioExistingProcess = Get-Process -Id $portfolioExistingFrontend
        $portfolioExistingTicks = $portfolioExistingProcess.StartTime.ToUniversalTime().Ticks.ToString()
        $portfolioManagedFrontend = @($portfolioPrevious | Where-Object { $_.role -eq 'frontend' -and $_.pid -eq $portfolioExistingFrontend -and $_.started_ticks -eq $portfolioExistingTicks -and $_.managed })
        if (-not $portfolioManagedFrontend.Count) { throw 'Stop your existing frontend before rebuilding. No unmanaged process was stopped.' }
        Stop-Process -Id $portfolioExistingFrontend -Force -ErrorAction Stop
    }
    Push-Location -LiteralPath $portfolioFrontend
    try {
        $env:NODE_OPTIONS = ($env:NODE_OPTIONS + ' --use-system-ca').Trim()
        if (-not (Test-Path -LiteralPath 'node_modules')) { & npm ci; if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' } }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
}
$portfolioApiId = Get-PortfolioListener -Port 8000
if ($portfolioApiId) {
    if (-not (Test-PortfolioHttp -Uri 'http://127.0.0.1:8000/api/health' -Api)) { throw 'Port 8000 is occupied by an unavailable or different service; it was left running.' }
    Add-PortfolioService -Role 'api' -ServiceId $portfolioApiId -Created $false
} else {
    Push-Location -LiteralPath $portfolioBackend
    try { & $portfolioPython -m app.seed; if ($LASTEXITCODE -ne 0) { throw 'Backend initialization failed.' } } finally { Pop-Location }
    $portfolioApiChild = Start-PortfolioChild -Role 'api'
    Wait-PortfolioHttp -Uri 'http://127.0.0.1:8000/api/health' -Role 'api' -Child $portfolioApiChild -Api
    Add-PortfolioService -Role 'api' -ServiceId (Get-PortfolioListener -Port 8000) -Created $true
}
$portfolioEnvText = Get-Content -Raw -LiteralPath (Join-Path $portfolioBackend '.env')
if ($portfolioEnvText -match '(?m)^WEBRTC_TURN_URL=["'']?turn:127\.0\.0\.1:3478') {
    $portfolioRelayId = Get-PortfolioListener -Port 3478 -Protocol 'UDP'
    if ($portfolioRelayId) { Add-PortfolioService -Role 'relay' -ServiceId $portfolioRelayId -Created $false }
    else {
        $portfolioTools = Join-Path $portfolioRoot 'tools'
        if (-not (Test-Path -LiteralPath (Join-Path $portfolioTools 'node_modules/node-turn'))) {
            $env:NODE_OPTIONS = ($env:NODE_OPTIONS + ' --use-system-ca').Trim()
            & npm ci --prefix $portfolioTools --ignore-scripts
            if ($LASTEXITCODE -ne 0) { throw 'Local relay dependency installation failed.' }
        }
        $portfolioRelayChild = Start-PortfolioChild -Role 'relay'
        $portfolioRelayDeadline = [DateTime]::UtcNow.AddSeconds(10)
        do { $portfolioRelayId = Get-PortfolioListener -Port 3478 -Protocol 'UDP'; if ($portfolioRelayId) { break }; if ($portfolioRelayChild.HasExited) { throw 'Local relay exited; see Backend/storage/runtime-relay.err.log.' }; Start-Sleep -Milliseconds 250 } while ([DateTime]::UtcNow -lt $portfolioRelayDeadline)
        if (-not $portfolioRelayId) { throw 'Local relay did not become ready; see Backend/storage/runtime-relay.err.log.' }
        Add-PortfolioService -Role 'relay' -ServiceId $portfolioRelayId -Created $true
    }
}
$portfolioFrontendId = Get-PortfolioListener -Port 4000
if ($portfolioFrontendId) {
    if (-not (Test-PortfolioHttp -Uri 'http://127.0.0.1:4000/api/health' -Api) -or -not (Test-PortfolioHttp -Uri 'http://127.0.0.1:4000/')) { throw 'Port 4000 is occupied by an unavailable or different service; it was left running.' }
    Add-PortfolioService -Role 'frontend' -ServiceId $portfolioFrontendId -Created $false
} else {
    $portfolioFrontendChild = Start-PortfolioChild -Role 'frontend'
    Wait-PortfolioHttp -Uri 'http://127.0.0.1:4000/api/health' -Role 'frontend' -Child $portfolioFrontendChild -Api
    if (-not (Test-PortfolioHttp -Uri 'http://127.0.0.1:4000/')) { throw 'Frontend page check failed; see Backend/storage/runtime-frontend.err.log.' }
    Add-PortfolioService -Role 'frontend' -ServiceId (Get-PortfolioListener -Port 4000) -Created $true
}
Write-Host 'King AI is ready at http://127.0.0.1:4000'
Write-Host 'API and preview run in the background. Close this terminal safely.'
Write-Host 'Logs: Backend/storage/runtime-*.log. Stop managed services with .\Stop-Project.ps1.'
