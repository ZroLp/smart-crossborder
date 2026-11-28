import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { requireAdmin } from '@/lib/auth/guards'

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic'

/** P8-02: 审计列表（倒序），?limit= 默认 50，上限 500。 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  try {
    const raw = request.nextUrl.searchParams.get('limit')
    const parsed = raw !== null ? Number.parseInt(raw, 10) : 50
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 50

    const rows = await getDb()
      .prepare(
        `SELECT actor_id, action, resource, resource_id, before_json, after_json, ip, created_at
         FROM admin_audit_logs ORDER BY created_at DESC, id DESC LIMIT ?`
      )
      .all(limit)

    return NextResponse.json({ success: true, data: { logs: rows ?? [] } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
