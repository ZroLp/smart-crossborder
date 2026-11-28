# P10-04 灰度发布（canary）：新流量先打到灰度目标，健康探针通过才允许全量，
# 失败自动调用 rollback.ps1（5 分钟回滚目标）。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\canary.ps1 -TargetZip dist\sumaitong-abc123-20261125-1200.zip `
#     -DeployDir E:\deploy\canary -Base https://canary.sumaitong.example `
#     -RestartCommand "docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate app-1"
# 通过：输出 PROMOTE，人工执行全量（app-2）后收尾；
# 失败：输出 ROLLBACK 并自动调 scripts\rollback.ps1。
param(
  [Parameter(Mandatory = $true)][string]$TargetZip,
  [string]$DeployDir,
  [string]$Base = 'https://canary.sumaitong.example',
  [string]$RestartCommand = '',
  [int]$ProbeCount = 3,
  [int]$ProbeIntervalSec = 10
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> canary: deploy $TargetZip" -ForegroundColor Cyan
if ($DeployDir) {
  $prevDir = Join-Path $DeployDir 'previous'
  if (Test-Path $DeployDir) {
    if (Test-Path $prevDir) { Remove-Item $prevDir -Recurse -Force }
    Move-Item $DeployDir $prevDir -Force
  }
  New-Item -ItemType Directory -Path $DeployDir | Out-Null
  Expand-Archive -Path (Join-Path $root $TargetZip) -DestinationPath $DeployDir -Force
  Write-Host "    unpacked to $DeployDir (previous version stashed at $prevDir)"
}

if ($RestartCommand) {
  Write-Host "==> canary: restart ($RestartCommand)" -ForegroundColor Cyan
  Invoke-Expression $RestartCommand
  if ($LASTEXITCODE -ne 0) { throw "restart command failed" }
}

$health = "$Base/api/health"
$allOk = $true
foreach ($i in 1..$ProbeCount) {
  Start-Sleep -Seconds $ProbeIntervalSec
  try {
    $r = Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 10
    Write-Host ("    probe {0}/{1} -> {2} {3}" -f $i, $ProbeCount, $r.StatusCode, $r.Content.Trim()) -ForegroundColor $(if ($r.StatusCode -eq 200) { 'Green' } else { 'Yellow' })
    if ($r.StatusCode -ne 200) { $allOk = $false }
  } catch {
    Write-Host ("    probe {0}/{1} -> {2}" -f $i, $ProbeCount, $_.Exception.Message) -ForegroundColor Red
    $allOk = $false
    break
  }
}

if ($allOk) {
  Write-Host ""
  Write-Host "PROMOTE: canary probes passed. 全量发布：将同一版本部署到 app-2 并复验 /api/health。" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "CANARY FAILED -> auto rollback (<=5 min)" -ForegroundColor Red
  & (Join-Path $PSScriptRoot 'rollback.ps1') -Base $Base -RestartCommand $RestartCommand -DeployDir $DeployDir
}
