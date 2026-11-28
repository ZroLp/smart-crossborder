import type { DbClient, DbRow } from '@/lib/db/client'

export interface AuditEntry {
  actorId: number | null
  action: string
  resource?: string | null
  resourceId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
}

export interface UserAuditSnapshot {
  user: DbRow | null
  subscription: DbRow | null
}

const USER_SNAPSHOT_SQL = `SELECT id, username, email, role, subscription_plan, created_at FROM users WHERE id = ?`

const SUBSCRIPTION_SNAPSHOT_SQL = `SELECT id, user_id, plan_key, status, current_period_end, cancel_at_period_end FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`

/**
 * 用户快照（before/after 共用）：users 行 + 有效订阅行。
 * 审计是旁路能力：查询失败不抛错（返回空快照），不阻塞主业务。
 */
export async function fetchUserSnapshot(db: DbClient, userId: number): Promise<UserAuditSnapshot> {
  try {
    const user = (await db.prepare(USER_SNAPSHOT_SQL).get(userId)) ?? null
    let subscription: DbRow | null = null
    try {
      subscription = (await db.prepare(SUBSCRIPTION_SNAPSHOT_SQL).get(userId)) ?? null
    } catch {
      subscription = null
    }
    return { user, subscription }
  } catch {
    return { user: null, subscription: null }
  }
}

/** 该用户当前有效订阅行（无则 null）。审计旁路：失败不抛错。 */
export async function fetchSubscriptionSnapshot(db: DbClient, userId: number): Promise<DbRow | null> {
  try {
    return (await db.prepare(SUBSCRIPTION_SNAPSHOT_SQL).get(userId)) ?? null
  } catch {
    return null
  }
}

/** 写入一条审计记录；before/after 序列化为 JSON 字符串。审计旁路：失败仅告警不抛错。 */
export async function recordAudit(db: DbClient, entry: AuditEntry): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO admin_audit_logs (actor_id, action, resource, resource_id, before_json, after_json, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.actorId,
        entry.action,
        entry.resource ?? null,
        entry.resourceId ?? null,
        entry.before == null ? null : JSON.stringify(entry.before),
        entry.after == null ? null : JSON.stringify(entry.after),
        entry.ip ?? null
      )
  } catch (error) {
    console.warn('[admin-audit] recordAudit failed:', error)
  }
}
