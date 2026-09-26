$ErrorActionPreference = 'Stop'
$portfolioRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$portfolioRuntimePath = Join-Path $portfolioRoot 'Backend/storage/local-runtime.json'
if (-not (Test-Path -LiteralPath $portfolioRuntimePath)) { Write-Host 'No managed project services recorded.'; return }
$portfolioRuntime = Get-Content -Raw -LiteralPath $portfolioRuntimePath | ConvertFrom-Json
if ($portfolioRuntime.project -ne $portfolioRoot) { throw 'Runtime record belongs to a different project; no processes were stopped.' }
foreach ($portfolioRole in @('frontend','api','relay')) {
    foreach ($portfolioService in @($portfolioRuntime.services | Where-Object { $_.role -eq $portfolioRole -and $_.managed })) {
        $portfolioProcess = Get-Process -Id $portfolioService.pid -ErrorAction SilentlyContinue
        if ($portfolioProcess -and $portfolioProcess.StartTime.ToUniversalTime().Ticks.ToString() -eq $portfolioService.started_ticks) {
            Stop-Process -Id $portfolioProcess.Id -Force -ErrorAction Stop
            Write-Host "Stopped managed $portfolioRole process."
        }
    }
}
