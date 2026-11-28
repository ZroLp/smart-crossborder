#!/usr/bin/env bash
# 数据库备份与恢复演练（Postgres）。
#
# 备份（PITR 基线）：
#   pg_dump -Fc 全量快照 + pg_wal_archive 建议开启（托管 Postgres 默认保留 WAL 7 天）。
# 用法：
#   ./scripts/backup.sh                 # 全量备份到 ./backups/
#   ./scripts/backup.sh --restore <file> # 恢复演练（写入独立恢复库并做一致性抽查）
# 前置：环境变量 DATABASE_URL（同 .env.example）。
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/.." && pwd)/backups}"
mkdir -p "$BACKUP_DIR"

url="${DATABASE_URL:?DATABASE_URL is required (see .env.example)}"
db="${url#*//}"; db="${db%%/*}"

if [[ "${1:-}" == "--restore" ]]; then
  file="${2:?usage: backup.sh --restore <backup-file>}"
  # 恢复演练：恢复到独立 schema 校验可读性与关键表行数，不碰生产库。
  restore_db="${DRILL_DB:-smart_crossborder_drill_$(date +%s)}"
  psql "$url" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${restore_db};"
  psql "$url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${restore_db};"
  pg_restore --no-owner --exit-on-error -d "$restore_db" "$file"
  psql "$restore_db" -tA -c \
    "SELECT 'task_logs=' || (SELECT count(*) FROM task_logs)
      || ' users=' || (SELECT count(*) FROM users);"
  psql "$url" -v ON_ERROR_STOP=1 -c "DROP DATABASE ${restore_db};"
  echo "restore drill OK: $file"
else
  file="${BACKUP_DIR}/smart-crossborder-$(date +%Y%m%dT%H%M%SZ).dump"
  pg_dump "$url" -Fc --file="$file"
  # 一致性校验：可恢复性检查（--list 能解析元数据即格式完好）
  pg_restore --list "$file" > /dev/null
  echo "backup OK: $file"
fi
