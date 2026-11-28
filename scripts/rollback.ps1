# P10-04 5 分钟回滚：恢复上一版本并复验健康。
# 优先级：① canary 暂存的 previous 目录（秒级切回）② dist 中上一版本 zip。
# 全程计时，超 300s 输出超时警示。DB 迁移仅前向兼容（P1）：回滚应用不回滚 schema。
#
# 用法（人工）：
#   powershell -ExecutionPolicy Bypass -File scripts\rollback.ps1 -Base https://sumaitong.example `
#     -RestartCommand "docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate app-1 app-2"
# 用法（canary.ps1 自动调用）：
#   rollback.ps1 -Base <canaryBase> -RestartCommand <restart> -DeployDir <canaryDir>
param(
  [string]$Base = 'https://sumaitong.example',
  [string]$RestartCommand = '',
  [string]$DeployDir = '',
  [int]$ProbeIntervalSec = 10
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sw = [Diagnostics.Stopwatch]::StartNew()

function Fail { param($msg) Write-Host $msg -ForegroundColor Red; $sw.Stop(); Write-Host ("rollback aborted after {0}s" -f $sw.Elapsed.TotalSeconds) -ForegroundColor Yellow; exit 1 }

$source = ''
# ① canary 暂存目录秒级切回
$prevDir = if ($DeployDir) { Join-Path $DeployDir 'previous' } else { '' }
if ($prevDir -and (Test-Path $prevDir)) {
  $current = Join-Path $DeployDir 'current'
  if (Test-Path $current) { Remove-Item $current -Recurse -Force }
  Rename-Item $prevDir 'current'
  $source = "stashed previous dir ($DeployDir\current)"
  Write-Host "==> [1/3] swapped back to stashed previous version" -ForegroundColor Cyan
}
else {
  # ② dist 中按时间戳取倒数第二个 zip（当前版 + 上一版）
  $zips = Get-ChildItem (Join-Path $root 'dist') -Filter 'sumaitong-*.zip' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '*.sha256' } | Sort-Object Name -Descending
  if ($zips.Count -lt 2) { Fail "no previous release zip found in dist\ (keep prior dist\sumaitong-*.zip + .sha256)" }
  $prev = $zips[1]
  if (Test-Path $DeployDir) { Remove-Item $DeployDir -Recurse -Force }
  New-Item -ItemType Directory -Path $DeployDir | Out-Null
  Expand-Archive -Path $prev.FullName -DestinationPath $DeployDir -Force
  # 完整性校验（P9-05 产物 .sha256）
  $expected = (Get-Content ($prev.FullName + '.sha256') -ErrorAction SilentlyContinue)
  if ($expected) {
    $actual = (Get-FileHash -Algorithm SHA256 -Path $prev.FullName).Hash.ToLower()
    if ($actual -ne ($expected -split '\s+')[0]) { Fail "sha256 mismatch for $($prev.Name), backup may be corrupt" }
  }
  $source = $prev.Name
  Write-Host "==> [1/3] restored $($prev.Name) to $DeployDir" -ForegroundColor Cyan
}

# ② 重启服务
Write-Host "==> [2/3] restart service" -ForegroundColor Cyan
if ($RestartCommand) {
  Invoke-Expression $RestartCommand
  if ($LASTEXITCODE -ne 0) { Fail "restart command failed" }
} else {
  Write-Host "    no -RestartCommand given; stop/restart the service manually now (systemd/pm2/docker)" -ForegroundColor Yellow
}

# ③ 健康复验
Write-Host "==> [3/3] health check $Base/api/health" -ForegroundColor Cyan
Start-Sleep -Seconds $ProbeIntervalSec
try {
  $r = Invoke-WebRequest -Uri "$Base/api/health" -UseBasicParsing -TimeoutSec 10
  if ($r.StatusCode -eq 200) {
    $sw.Stop()
    Write-Host ("ROLLBACK OK: restored from {0} in {1}s (target <=300s)." -f $source, [math]::Round($sw.Elapsed.TotalSeconds, 1)) -ForegroundColor Green
    Write-Host "DB 注意：迁移仅前向兼容，本步骤未（也不得）回滚 schema。" -ForegroundColor Yellow
  } else {
    Fail ("health check returned {0}" -f $r.StatusCode)
  }
} catch {
  $sw.Stop()
  Write-Host ("ROLLBACK TIMEOUT: health check failed ({0}) after {1}s — escalate: keep previous version live, investigate new build offline." -f $_.Exception.Message, [math]::Round($sw.Elapsed.TotalSeconds, 1)) -ForegroundColor Red
  exit 1
}
