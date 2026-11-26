import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { requireAdmin } from '@/lib/auth/guards'
import { runLaunchCheck } from '@/lib/compliance/launch-check'

// 该路由依赖请求上下文与数据库，禁止 Next 在 build 期静态预渲染。
export const dynamic = 'force-dynamic'

/** P10-06 合规上线检查（RoPA/DPIA 归档 + DSAR SLA + 泄露 72h + 保留期配置），仅 admin。 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  try {
    const db = getDb()
    const result = await runLaunchCheck(db)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
