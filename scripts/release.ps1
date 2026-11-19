# 发布脚本：打包可独立启动的交付物（含 node_modules，排除 .git / .next）。
# 用法：powershell -ExecutionPolicy Bypass -File scripts\release.ps1
# 产物：dist\sumaitong-<commit>-<date>.zip

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

Push-Location $root
try {
    $commit = git rev-parse --short HEAD
    if (-not $commit) { $commit = 'nogit' }
    $date = Get-Date -Format 'yyyyMMdd-HHmm'
    $artifactsDir = Join-Path $root 'dist'
    $artifactName = "sumaitong-$commit-$date.zip"
    $staging = Join-Path $artifactsDir ("staging-" + $commit)

    Write-Host "==> [1/5] typecheck (tsc --noEmit)" -ForegroundColor Cyan
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }

    Write-Host "==> [2/5] tests (jest)" -ForegroundColor Cyan
    npx jest --ci
    if ($LASTEXITCODE -ne 0) { throw "tests failed" }

    Write-Host "==> [3/5] build (next build)" -ForegroundColor Cyan
    npx next build
    if ($LASTEXITCODE -ne 0) { throw "build failed" }

    Write-Host "==> [4/5] staging copy (excl .git, .next, dist)" -ForegroundColor Cyan
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null
    Copy-Item -Path $root\* -Destination $staging -Recurse -Force
    foreach ($skip in @('.git', '.next', 'dist', 'node_modules')) {
        $p = Join-Path $staging $skip
        if (Test-Path $p) { Remove-Item $p -Recurse -Force }
    }
    # 保留可独立启动所需：拷贝 node_modules 到 staging
    Write-Host "==> copying node_modules for standalone start" -ForegroundColor DarkGray
    Copy-Item -Path (Join-Path $root 'node_modules') -Destination $staging -Recurse -Force

    Write-Host "==> [5/5] packaging $artifactName" -ForegroundColor Cyan
    if (-not (Test-Path $artifactsDir)) { New-Item -ItemType Directory -Path $artifactsDir | Out-Null }
    $zipPath = Join-Path $artifactsDir $artifactName
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath
    Remove-Item $staging -Recurse -Force

    Write-Host ""
    Write-Host "Release ready: $zipPath" -ForegroundColor Green
    Write-Host "Commit: $commit"
    Write-Host "Start:   cd <extracted> ; npm start   (run `npm install` only if node_modules pruned)"
    Write-Host "Rollback: restore previous zip + previous DB snapshot, run migrations down (see P1)."
}
finally {
    Pop-Location
}
