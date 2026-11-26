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

    # 先清理上次失败遗留的 staging（可能含源码/node_modules 副本）：否则会被 tsc 的
    # **/*.ts include 纳入编译导致类型检查剧烈变慢甚至卡死，同时白占磁盘。
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }

    Write-Host "==> [1/8] typecheck (tsc --noEmit)" -ForegroundColor Cyan
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }

    Write-Host "==> [2/8] tests (jest)" -ForegroundColor Cyan
    # P1-05：测试用 PGlite（内嵌 Postgres），需 --experimental-vm-modules 才能动态 import WASM，
    # 否则 jest worker 直接崩溃（ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG）。--forceExit 避免句柄残留挂起。
    $savedNodeOptions = $env:NODE_OPTIONS
    if ($savedNodeOptions) {
        $env:NODE_OPTIONS = "$savedNodeOptions --experimental-vm-modules"
    } else {
        $env:NODE_OPTIONS = '--experimental-vm-modules'
    }
    npx jest --ci --forceExit
    $jestExit = $LASTEXITCODE
    if ($jestExit -ne 0) {
        # jest 30 + Node 24 的已知抖动：PGlite 并发动态 import WASM 时偶发 jest-runtime 内部崩溃
        # （TypeError: Cannot read properties of undefined (reading 'identifier')），单套件重跑必过。
        # 策略：串行重跑失败用例；仅在重跑仍失败时判定为真实失败。
        Write-Host "==> [2/8] tests failed under parallel run, retrying failures serially (--onlyFailures)" -ForegroundColor Yellow
        npx jest --ci --forceExit --runInBand --onlyFailures
        $jestExit = $LASTEXITCODE
        if ($jestExit -eq 0) {
            Write-Host "    flaky parallel crash only; all tests pass when re-run serially" -ForegroundColor Yellow
        }
    }
    $env:NODE_OPTIONS = $savedNodeOptions
    if ($jestExit -ne 0) { throw "tests failed" }

    Write-Host "==> [3/8] build (next build)" -ForegroundColor Cyan
    npx next build
    if ($LASTEXITCODE -ne 0) { throw "build failed" }

    Write-Host "==> [4/8] staging copy (excl .git, .next, dist)" -ForegroundColor Cyan
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null
    # Windows PowerShell 5 的 Copy-Item -Recurse 在含 node_modules 的大目录上会抛
    # OutOfMemoryException，改用 robocopy（原生复制、内存占用低）。robocopy 退出码 0-7 视为成功。
    robocopy $root $staging /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 /XD (Join-Path $root '.git') (Join-Path $root '.next') (Join-Path $root 'dist') (Join-Path $root 'node_modules') | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "staging copy failed (robocopy exit $LASTEXITCODE)" }

    # 保留可独立启动所需：拷贝 node_modules 到 staging
    Write-Host "==> copying node_modules for standalone start" -ForegroundColor DarkGray
    robocopy (Join-Path $root 'node_modules') (Join-Path $staging 'node_modules') /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "node_modules copy failed (robocopy exit $LASTEXITCODE)" }

    Write-Host "==> [5/8] packaging $artifactName" -ForegroundColor Cyan
    if (-not (Test-Path $artifactsDir)) { New-Item -ItemType Directory -Path $artifactsDir | Out-Null }
    $zipPath = Join-Path $artifactsDir $artifactName
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    # Compress-Archive 在 node_modules（数万文件 + 长路径）下会 OOM 或超 2GB 限制，
    # 改用系统自带 bsdtar（Windows 10+）：-a 按扩展名自动选 zip，支持长路径。
    tar -a -c -f $zipPath -C $staging .
    if ($LASTEXITCODE -ne 0) { throw "packaging failed (tar exit $LASTEXITCODE)" }
    Remove-Item $staging -Recurse -Force

    # ---- P9-05: 产物 ① zip 的 SHA256 校验文件（<zipname>.sha256） ----
    Write-Host "==> [6/8] SHA256 checksum" -ForegroundColor Cyan
    $sha256 = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash.ToLower()
    $sha256Path = $zipPath + '.sha256'
    Set-Content -Path $sha256Path -Value ("$sha256  $artifactName") -Encoding ascii
    Write-Host "    wrote $([IO.Path]::GetFileName($sha256Path))"

    # ---- P9-05: 产物 ② RELEASE_NOTES.txt（git log + 变更类型统计） ----
    Write-Host "==> [7/8] release notes (git log)" -ForegroundColor Cyan
    $notesPath = Join-Path $artifactsDir 'RELEASE_NOTES.txt'
    # git 在无 tag 的仓库执行 describe 会向 stderr 输出 fatal；PS5 在 ErrorActionPreference=Stop 下
    # 会把原生命令的 stderr 升级为终止错误，故该段落局部改为 Continue，靠结果判空兜底。
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lastTag = (git describe --tags --abbrev=0 2>$null)
    $logSpec = if ($lastTag) { "$lastTag..HEAD" } else { 'HEAD~20..HEAD' }
    $logLines = git log --oneline $logSpec 2>$null
    if (-not $logLines) { $logLines = git log --oneline -n 20 2>$null }
    $subjects = git log --pretty=%s $logSpec 2>$null
    if (-not $subjects) { $subjects = git log --pretty=%s -n 20 2>$null }
    $ErrorActionPreference = $prevEap
    # 变更类型统计：按 conventional-commit 前缀归类。
    $typeStats = @{}
    $typeOrder = @('feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'chore', 'style', 'ci', 'build', 'other')
    foreach ($t in $typeOrder) { $typeStats[$t] = 0 }
    foreach ($s in $subjects) {
        $m = [regex]::Match([string]$s, '^([a-zA-Z]+)(\([^)]*\))?!?:')
        if ($m.Success) {
            $k = $m.Groups[1].Value.ToLower()
            if ($typeStats.ContainsKey($k)) { $typeStats[$k] += 1 } else { $typeStats['other'] += 1 }
        } else {
            $typeStats['other'] += 1
        }
    }
    $notes = New-Object System.Collections.Generic.List[string]
    $notes.Add("Release notes - $artifactName")
    $notes.Add("Generated: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
    $notes.Add("Commit: $commit")
    $notes.Add("Range: $logSpec$(if ($lastTag) { " (last tag: $lastTag)" } else { " (no tag, last 20)" })")
    $notes.Add('')
    $notes.Add('--- Changelog ---')
    if ($logLines) { foreach ($l in $logLines) { $notes.Add((([string]$l))) } } else { $notes.Add('(no git history available)') }
    $notes.Add('')
    $notes.Add('--- Change type stats ---')
    foreach ($t in $typeOrder) {
        if ($typeStats[$t] -gt 0) { $notes.Add(("{0,-8} {1}" -f $t, $typeStats[$t])) }
    }
    Set-Content -Path $notesPath -Value $notes -Encoding utf8
    Write-Host "    wrote RELEASE_NOTES.txt ($($logLines.Count) commits)"

    # ---- P9-05: 产物 ③ ROLLBACK.txt（回滚步骤） ----
    Write-Host "==> [8/8] rollback doc" -ForegroundColor Cyan
    $rollbackPath = Join-Path $artifactsDir 'ROLLBACK.txt'
    $rollback = @(
        "ROLLBACK PROCEDURE - $artifactName",
        "Generated: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),
        '',
        'Steps:',
        '  1. Stop the running service:  npm stop / kill the `next start` process (or stop the systemd/pm2 unit).',
        "  2. Verify the previous release zip is available (keep the prior dist\sumaitong-*.zip and its .sha256).",
        '  3. Verify previous zip integrity:  certutil -hashfile <prev.zip> SHA256   (or:  Get-FileHash <prev.zip>).',
        '  4. Unpack the previous version and overwrite the current deployment directory:',
        '       Expand-Archive -Path <prev.zip> -DestinationPath <deploy-dir> -Force',
        '  5. Restore node_modules if the previous release bundled a different set:',
        '       cd <deploy-dir> ; npm ci   (only when node_modules was pruned or versions differ).',
        '  6. DATABASE: migrations are FORWARD-ONLY. Rolling back the app does NOT roll back the schema.',
        '       - Do NOT run "migrate down". Confirm the previous app version is compatible with the current',
        '         schema (forward-compatible). If the release introduced breaking schema changes, restore the',
        '         pre-release DB snapshot instead of down-migrating (see P1 backup policy).',
        '  7. Start the service:  cd <deploy-dir> ; npm start',
        '  8. Health check (P10-02): curl <base>/api/health  -> 200 {"status":"ok"}',
        '       (db/redis 逐项探针；503 = not ready。容器 HEALTHCHECK 亦使用该端点。)',
        '  9. 自动化（P10-04）: scripts\rollback.ps1 -Base <base> -RestartCommand "<restart cmd>" -DeployDir <dir>',
        '       全程计时，目标 <=5 分钟；canary.ps1 探针失败会自动调用本回滚。',
        '',
        'Note: DB migrations are forward-only (P1). Never down-migrate in production.'
    )
    Set-Content -Path $rollbackPath -Value $rollback -Encoding utf8
    Write-Host "    wrote ROLLBACK.txt"

    Write-Host ""
    Write-Host "Release ready: $zipPath" -ForegroundColor Green
    Write-Host "Commit: $commit"
    Write-Host "SHA256:  $sha256"
    Write-Host "Notes:   $notesPath"
    Write-Host "Rollback: $rollbackPath"
    Write-Host "Start:   cd <extracted> ; npm start   (run `npm install` only if node_modules pruned)"
}
finally {
    Pop-Location
}
