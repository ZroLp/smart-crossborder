import type { DbClient } from '@/lib/db/client';

/**
 * P7-03 数据保留期自动清理。
 *
 * `data_retention_policies`（schema 幂等 seed）定义 data_type → max_age_days；
 * data_type → 物理表的映射用白名单硬编码，防止策略表被注入表名。
 * 清理谓词：`created_at < now() - (interval '1 day' * max_age_days)`。
 */
const RETENTION_TABLES: Record<string, string> = {
  sessions: 'sessions',
  analytics_events: 'analytics_events',
  task_logs: 'task_logs',
  email_verification_codes: 'email_verification_codes',
  sms_verification_codes: 'sms_verification_codes',
  compliance_events: 'compliance_events',
};

export interface RetentionCleanupResult {
  /** data_type → 实际删除行数（白名单外的 data_type 跳过且不出现在结果中）。 */
  cleaned: Record<string, number>;
}

export async function runRetentionCleanup(db: DbClient): Promise<RetentionCleanupResult> {
  const policies = (await db
    .prepare('SELECT data_type, max_age_days FROM data_retention_policies ORDER BY id')
    .all()) as Array<{ data_type: string; max_age_days: number }>;

  const cleaned: Record<string, number> = {};
  for (const policy of policies) {
    const table = RETENTION_TABLES[policy.data_type];
    if (!table) continue; // 未知 data_type：白名单映射兜底，跳过
    const result = await db
      .prepare(`DELETE FROM ${table} WHERE created_at < now() - (interval '1 day' * ?)`)
      .run(policy.max_age_days);
    cleaned[policy.data_type] = Number(result.changes ?? 0);
  }
  return { cleaned };
}
