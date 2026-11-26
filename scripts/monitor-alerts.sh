#!/usr/bin/env bash
# P10-02 1 分钟级监控告警：轮询 /api/health 与 /api/monitor/metrics，
# 触发条件（默认阈值，可 env 覆盖）：
#   APP_DOWN        health 非 200 / 不可达（连续 2 次）
#   QUEUE_BACKLOG   task_queue_depth{pending} > QUEUE_ALERT_DEPTH（默认 100）
#   WORKER_STALE    pending>0 且最近完成距今 > STALE_TASK_SECONDS（默认 300s）
# 告警动作：POST ALERT_WEBHOOK_URL（JSON）+ stdout；同一告警状态持续时不重复发
# （状态翻转才发），告警恢复时发 resolved。
# 部署：nohup ./scripts/monitor-alerts.sh >> /var/log/monitor-alerts.log 2>&1 &
set -uo pipefail

BASE="${BASE_URL:?BASE_URL required, e.g. https://sumaitong.example}"
WEBHOOK="${ALERT_WEBHOOK_URL:-}"
INTERVAL="${ALERT_INTERVAL_SECONDS:-60}"   # 1min 轮询
QUEUE_DEPTH_LIMIT="${QUEUE_ALERT_DEPTH:-100}"
STALE_SECONDS="${STALE_TASK_SECONDS:-300}"
STATE_FILE="$(mktemp -t monitor-state-XXXX)"
trap 'rm -f "$STATE_FILE"' EXIT
prev_state=""

fetch_metric() { # fetch_metric <metric_name> [label]
  local body
  body=$(curl -fsS --max-time 10 "$BASE/api/monitor/metrics" 2>/dev/null) || body=""
  if [ -n "${2:-}" ]; then
    printf '%s\n' "$body" | grep "^${1}{${2}}" | head -n1 | awk '{print $2}'
  else
    printf '%s\n' "$body" | grep "^${1}" | head -n1 | awk '{print $2}'
  fi
}

send_alert() { # send_alert <alert> <state> <detail>
  local alert="$1" state="$2" detail="$3"
  echo "$(date -u +%FT%TZ) [$alert] $state :: $detail"
  if [ -n "$WEBHOOK" ]; then
    curl -fsS --max-time 10 -X POST "$WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "$(printf '{"alert":"%s","state":"%s","detail":"%s","ts":"%s"}' \
            "$alert" "$state" "$detail" "$(date -u +%FT%TZ)")" >/dev/null 2>&1 || true
  fi
}

fail=0
while :; do
  current=""

  health_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/api/health" 2>/dev/null || echo 000)
  if [ "$health_status" != "200" ]; then
    fail=$((fail + 1))
    if [ "$fail" -ge 2 ]; then current="APP_DOWN"; fi
  else
    fail=0
    pending=$(fetch_metric app_task_queue_depth '{status="pending"}')
    pending="${pending:-0}"
    last_ago=$(fetch_metric app_last_task_completed_ago_seconds)
    if [ "$(printf '%s' "$pending" | grep -o '[0-9]*' | head -n1)" -gt "$QUEUE_DEPTH_LIMIT" ]; then
      current="QUEUE_BACKLOG"
    elif [ "$pending" != "0" ] && [ "$last_ago" != "+Inf" ] && [ "${last_ago:-0}" -gt "$STALE_SECONDS" ]; then
      current="WORKER_STALE"
    fi
  fi

  if [ "$current" != "$prev_state" ]; then
    if [ -n "$current" ]; then
      send_alert "$current" "firing" "health=$health_status pending=${pending:-?} last_finished_ago=${last_ago:-n/a}"
    elif [ -n "$prev_state" ]; then
      send_alert "$prev_state" "resolved" "recovered, health=200"
    fi
    prev_state="$current"
  fi
  sleep "$INTERVAL"
done
