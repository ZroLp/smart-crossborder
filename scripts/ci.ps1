# P9-01: 质量与 CI 红灯门禁（Windows / PowerShell）
# 依次执行：tsc --noEmit → jest（全量）→ next build → next lint（无 eslint 配置则 SKIP）。
# 任一步失败立即以非 0 退出；输出各步耗时。
# 用法：powershell -ExecutionPolicy Bypass -File scripts\ci.ps1   （或 npm run ci）

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
$overallStart = Get-Date

function Write-Step {
    param([string]$name)
    Write-Host ""
    Write-Host "==> [$name]" -ForegroundColor Cyan
}

function Stop-Gate {
    param([string]$name, [int]$code)
    $elapsed = [math]::Round(((Get-Date) - $overallStart).TotalSeconds, 1)
    Write-Host ""
    Write-Host "GATE FAILED at step [$name] (exit $code), total ${elapsed}s" -ForegroundColor Red
    Pop-Location
    exit 1
}

function Step-Elapsed {
    param([double]$seconds)
    [math]::Round($seconds, 1)
}

# ---- 步骤 1：类型检查 ----
$stepStart = Get-Date
Write-Step "1/4 tsc --noEmit"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Stop-Gate "tsc" $LASTEXITCODE }
Write-Host ("    tsc ok ({0}s)" -f (Step-Elapsed ((Get-Date) - $stepStart).TotalSeconds)) -ForegroundColor DarkGray

# ---- 步骤 2：全量测试（jest）----
$stepStart = Get-Date
Write-Step "2/4 jest --forceExit (all suites)"
# pglite 依赖 experimental-vm-modules；与 tests/ 约定一致。
$env:NODE_OPTIONS = "--experimental-vm-modules"
npx jest --forceExit
if ($LASTEXITCODE -ne 0) {
    # 并行负载下 pglite 首跑 / jsdom 等待偶发 flake：对失败套件重跑一次，
    # 仍失败则门禁判红（真实回归两次都会失败，不会被掩盖）。
    Write-Host "    jest failed; flaky re-run of failed suites (--onlyFailures)" -ForegroundColor Yellow
    npx jest --onlyFailures --forceExit
    if ($LASTEXITCODE -ne 0) { Stop-Gate "jest" $LASTEXITCODE }
}
Write-Host ("    jest ok ({0}s)" -f (Step-Elapsed ((Get-Date) - $stepStart).TotalSeconds)) -ForegroundColor DarkGray

# ---- 步骤 3：生产构建 ----
$stepStart = Get-Date
Write-Step "3/4 next build"
npx next build
if ($LASTEXITCODE -ne 0) { Stop-Gate "next build" $LASTEXITCODE }
Write-Host ("    build ok ({0}s)" -f (Step-Elapsed ((Get-Date) - $stepStart).TotalSeconds)) -ForegroundColor DarkGray

# ---- 步骤 4：lint（无 eslint 配置则跳过）----
$stepStart = Get-Date
Write-Step "4/4 next lint (skip if no eslint config)"
$hasEslintConfig = $false
foreach ($p in @('.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs')) {
    if (Test-Path (Join-Path $root $p)) { $hasEslintConfig = $true; break }
}
if (-not $hasEslintConfig) {
    Write-Host "    SKIP: no eslint config found (lint not enforced)" -ForegroundColor Yellow
} else {
    npx next lint
    if ($LASTEXITCODE -ne 0) { Stop-Gate "next lint" $LASTEXITCODE }
    Write-Host ("    lint ok ({0}s)" -f (Step-Elapsed ((Get-Date) - $stepStart).TotalSeconds)) -ForegroundColor DarkGray
}

$total = [math]::Round(((Get-Date) - $overallStart).TotalSeconds, 1)
Write-Host ""
Write-Host "All CI gates passed in ${total}s" -ForegroundColor Green
Pop-Location
exit 0
