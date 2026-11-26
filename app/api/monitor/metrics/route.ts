import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';

export const dynamic = 'force-dynamic';

/**
 * P10-02 可观测指标（Prometheus 文本格式，供 /metrics 抓取或 1min 监控脚本解析）：
 * - 任务队列深度（pending/running 分型）
 * - 僵尸候选数（claimed 但 lease 已过期的 running 任务）
 * - 最近一次任务完成距今秒数（worker 活性；无完成记录为 +Inf）
 * - 进程 uptime
 * 注意：端点无鉴权（抓取器不带会话），生产部署须将 /api/monitor/metrics 置于
 * 内网可达路径或按源 IP 白名单限制（nginx location 段控制），勿直接暴露公网。
 */
export async function GET() {
  try {
    const db = getDb();
    const [statusRows, zombieRow, lastFinishedRow] = await Promise.all([
      db.prepare('SELECT status, COUNT(*) AS count FROM task_logs GROUP BY status').all(),
      db.prepare(`SELECT COUNT(*) AS count FROM task_logs
                  WHERE status = 'running' AND lease_until < now()`).get(),
      db.prepare(`SELECT EXTRACT(EPOCH FROM (now() - MAX(ended_at))) AS seconds_ago
                  FROM task_logs WHERE status = 'completed'`).get(),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusRows ?? []) byStatus[row.status] = Number(row.count);

    const lines: string[] = [
      '# HELP process_uptime_seconds Process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
      '# HELP app_task_queue_depth Task queue depth by status',
      '# TYPE app_task_queue_depth gauge',
    ];
    let anyDepth = false;
    for (const [status, count] of Object.entries(byStatus)) {
      lines.push(`app_task_queue_depth{status="${status}"} ${count}`)
      anyDepth = true;
    }
    if (!anyDepth) lines.push('app_task_queue_depth{status="pending"} 0');
    lines.push(
      `app_tasks_zombie_candidates ${Number((zombieRow as { count: number })?.count ?? 0)}`,
      '# HELP app_last_task_completed_ago_seconds Seconds since last completed task (+Inf when none)',
      '# TYPE app_last_task_completed_ago_seconds gauge',
    );
    const secondsAgo = (lastFinishedRow as { seconds_ago: number | null } | null)?.seconds_ago;
    lines.push(`app_last_task_completed_ago_seconds ${secondsAgo == null ? '+Inf' : Number(secondsAgo)}`);

    return new NextResponse(lines.join('\n') + '\n', {
      headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
