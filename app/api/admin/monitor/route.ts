import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { requireAdmin } from '@/lib/auth/guards'
import { findDunningTargets } from '@/lib/payment/payment-service'

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic'

/** P8-03: 监控运营一屏聚合（任务状态分布/近 24h 任务数、用户/支付/订阅计数、催缴条数、最近 10 条审计）。 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  try {
    const db = getDb()
    const [taskStatusRows, taskLast24, taskTotal, usersCount, paymentsCount, subscriptionsCount] =
      await Promise.all([
        db.prepare('SELECT status, COUNT(*) AS count FROM task_logs GROUP BY status').all(),
        db.prepare(`SELECT COUNT(*) AS count FROM task_logs WHERE created_at >= now() - interval '24 hours'`).get(),
        db.prepare('SELECT COUNT(*) AS count FROM task_logs').get(),
        db.prepare('SELECT COUNT(*) AS count FROM users').get(),
        db.prepare('SELECT COUNT(*) AS count FROM payments').get(),
        db.prepare('SELECT COUNT(*) AS count FROM subscriptions').get(),
      ])

    const byStatus: Record<string, number> = {}
    for (const row of taskStatusRows ?? []) {
      byStatus[row.status] = Number(row.count)
    }

    const dunningTargets = await findDunningTargets(db)
    const audit = await db
      .prepare(
        `SELECT actor_id, action, resource, resource_id, before_json, after_json, ip, created_at
         FROM admin_audit_logs ORDER BY created_at DESC, id DESC LIMIT 10`
      )
      .all()

    return NextResponse.json({
      success: true,
      data: {
        tasks: {
          byStatus,
          last24h: Number(taskLast24?.count ?? 0),
          total: Number(taskTotal?.count ?? 0),
        },
        users: Number(usersCount?.count ?? 0),
        payments: Number(paymentsCount?.count ?? 0),
        subscriptions: Number(subscriptionsCount?.count ?? 0),
        dunning: dunningTargets.length,
        audit: audit ?? [],
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
