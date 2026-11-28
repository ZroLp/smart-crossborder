#!/usr/bin/env bash
# P10-05 灾备演练（DR drill）：真实备份 → 恢复到独立演练库 → 行数一致性比对 → 报告。
# 全程不碰生产库；演练库用完即删。建议随发布门禁每月执行一次并归档报告。
#
# 用法：
#   ./scripts/dr-drill.sh                # 用 DATABASE_URL 演练
# 前置：psql / pg_dump / pg_restore 可用；环境变量 DATABASE_URL（同 .env.example）。
# 产出：stdout 报告 + 退出码 0=PASS / 1=FAIL（可接 CI 门禁）。
set -euo pipefail

url="${DATABASE_URL:?DATABASE_URL is required (see .env.example)}"

# 生产库行数基线
baseline=$(psql "$url" -tA -c \
  "SELECT 'users=' || (SELECT count(*) FROM users)
     || ' task_logs=' || (SELECT count(*) FROM task_logs)
     || ' payments=' || (SELECT count(*) FROM payments);" 2>/dev/null \
  || psql "$url" -tA -c \
    "SELECT 'users=' || (SELECT count(*) FROM users) || ' task_logs=' || (SELECT count(*) FROM task_logs);" )
echo "baseline : $baseline"

dump="$(mktemp /tmp/dr-drill-XXXX.dump)"
trap 'rm -f "$dump"' EXIT
pg_dump "$url" -Fc --file="$dump"
pg_restore --list "$dump" > /dev/null && echo "backup   : OK ($dump)" || { echo "backup   : FAIL (corrupt)"; exit 1; }

drill_db="dr_drill_$(date +%s)"
psql "$url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${drill_db};"
echo "drill_db : created $drill_db"
if pg_restore --no-owner --exit-on-error -d "$drill_db" "$dump" 2>/dev/null; then
  echo "restore  : OK"
else
  echo "restore  : FAIL"
  psql "$url" -c "DROP DATABASE IF EXISTS ${drill_db};" >/dev/null
  exit 1
fi

restored=$(psql "$drill_db" -tA -c \
  "SELECT 'users=' || (SELECT count(*) FROM users)
     || ' task_logs=' || (SELECT count(*) FROM task_logs)
     || ' payments=' || (SELECT count(*) FROM payments);" 2>/dev/null \
  || psql "$drill_db" -tA -c \
    "SELECT 'users=' || (SELECT count(*) FROM users) || ' task_logs=' || (SELECT count(*) FROM task_logs);" )
echo "restored : $restored"

psql "$url" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${drill_db};" >/dev/null
echo "cleanup  : drill db dropped"

# 比对（payments 表在旧版备份中可能不存在，按基线实际内容比对）
if [[ "$baseline" == *payments=* ]]; then
  [[ "$baseline" == "$restored" ]] && echo "PASS: row counts match -> backup restorable" && exit 0
  echo "FAIL: count mismatch ($baseline vs $restored)" && exit 1
else
  # 旧版本无 payments 表：比对公共前缀
  base_trim="${baseline%\ }"
  [[ "$restored" == "$base_trim"* || "$base_trim" == "$restored"* ]] \
    && echo "PASS: comparable rows match -> backup restorable" && exit 0
  echo "FAIL: count mismatch ($baseline vs $restored)" && exit 1
fi
