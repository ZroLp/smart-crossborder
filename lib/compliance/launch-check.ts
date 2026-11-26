import type { DbClient } from '@/lib/db/client';

export interface LaunchCheckItem {
  id: string;
  ok: boolean;
  blocking: boolean;
  detail: string;
}

export interface LaunchCheckResult {
  pass: boolean;
  checks: LaunchCheckItem[];
  archives: Array<{ kind: string; title: string; created_at: string; created_by: number | null }>;
}

/**
 * P10-06 合规上线检查（GDPR/PIPL 双轨）：
 * 阻断项（blocking）：RoPA/DPIA 未归档、DSAR 30 天 SLA 违约、泄露 72h 通知逾期；
 * 提示项（非阻断）：保留期策略未配置。
 * 仅读库；归档写入走 /api/admin/compliance-launch/archive（requireAdmin）。
 */
export async function runLaunchCheck(db: DbClient): Promise<LaunchCheckResult> {
  const [ropa, dpia, dsarBreach, breachOverdue, retentionCount] = await Promise.all([
    db.prepare(`SELECT id, title, created_at, created_by FROM compliance_archives
                WHERE kind = 'ropa' ORDER BY created_at DESC, id DESC LIMIT 1`).get(),
    db.prepare(`SELECT id, title, created_at, created_by FROM compliance_archives
                WHERE kind = 'dpia' ORDER BY created_at DESC, id DESC LIMIT 1`).get(),
    db.prepare(`SELECT count(*) AS count FROM dsar_requests
                WHERE status = 'pending' AND sla_due_at < now()`).get(),
    db.prepare(`SELECT count(*) AS count FROM breach_reports
                WHERE status = 'open' AND notification_deadline_at < now()`).get(),
    db.prepare(`SELECT count(*) AS count FROM data_retention_policies`).get(),
  ]);

  const archiveRows = await db
    .prepare(`SELECT kind, title, created_at, created_by FROM compliance_archives
              ORDER BY created_at DESC, id DESC LIMIT 20`)
    .all();

  const checks: LaunchCheckItem[] = [
    {
      id: 'ropa_archived',
      ok: Boolean(ropa),
      blocking: true,
      detail: ropa
        ? `RoPA 已归档：${ropa.title}（${ropa.created_at}）`
        : 'RoPA（处理活动记录，GDPR Art.30）未归档，上线前必须 POST /api/admin/compliance-launch/archive',
    },
    {
      id: 'dpia_archived',
      ok: Boolean(dpia),
      blocking: true,
      detail: dpia
        ? `DPIA 已归档：${dpia.title}（${dpia.created_at}）`
        : 'DPIA（数据保护影响评估，GDPR Art.35 / PIPL 55 条）未归档，上线前必须 POST /api/admin/compliance-launch/archive',
    },
    {
      id: 'dsar_sla',
      ok: Number((dsarBreach as { count: number } | null)?.count ?? 0) === 0,
      blocking: true,
      detail:
        Number((dsarBreach as { count: number } | null)?.count ?? 0) === 0
          ? '无超 30 天 SLA 的未完成 DSAR 请求'
          : `${Number((dsarBreach as { count: number }).count)} 条 DSAR 请求已超 30 天 SLA 未处理`,
    },
    {
      id: 'breach_72h',
      ok: Number((breachOverdue as { count: number } | null)?.count ?? 0) === 0,
      blocking: true,
      detail:
        Number((breachOverdue as { count: number } | null)?.count ?? 0) === 0
          ? '无逾期未通知（>72h）的 open 数据泄露'
          : `${Number((breachOverdue as { count: number }).count)} 条 open 数据泄露已超 72h 通知时限（GDPR Art.33）`,
    },
    {
      id: 'retention_configured',
      ok: Number((retentionCount as { count: number } | null)?.count ?? 0) > 0,
      blocking: false,
      detail:
        Number((retentionCount as { count: number } | null)?.count ?? 0) > 0
          ? `数据保留期策略 ${Number((retentionCount as { count: number }).count)} 条已配置（P7-03）`
          : 'data_retention_policies 为空（P7-03 自动清理不可用）',
    },
  ];

  return {
    pass: checks.filter((c) => c.blocking).every((c) => c.ok),
    checks,
    archives: (archiveRows as Array<{ kind: string; title: string; created_at: string; created_by: number | null }> ?? []),
  };
}

/** 归档 RoPA / DPIA（仅允许两种 kind，payload 任意 JSON 序列化）。 */
export async function archiveComplianceDocument(
  db: DbClient,
  input: { kind: string; title: string; payload: unknown; actorId: number | null }
): Promise<number | null> {
  if (input.kind !== 'ropa' && input.kind !== 'dpia') return null;
  const result = await db
    .prepare(
      `INSERT INTO compliance_archives (kind, title, payload_json, created_by)
       VALUES (?, ?, ?, ?) RETURNING "id"`
    )
    .run(input.kind, input.title, JSON.stringify(input.payload ?? {}), input.actorId);
  return Number(result.lastInsertRowid);
}
