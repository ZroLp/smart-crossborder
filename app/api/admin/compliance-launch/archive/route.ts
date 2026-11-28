import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { requireAdmin } from '@/lib/auth/guards'
import { archiveComplianceDocument } from '@/lib/compliance/launch-check'
import { recordAudit } from '@/lib/admin/audit'
import { getClientIp } from '@/lib/auth/device'

/** P10-06 RoPA/DPIA 归档写入（仅 admin）：POST {kind:'ropa'|'dpia', title, payload}。 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  const user = auth.user

  let body: { kind?: string; title?: string; payload?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ success: false, code: 'INVALID_JSON' }, { status: 400 })
  }

  if (body.kind !== 'ropa' && body.kind !== 'dpia') {
    return NextResponse.json(
      { success: false, code: 'INVALID_KIND', error: "kind must be 'ropa' or 'dpia'" },
      { status: 400 }
    )
  }
  if (!body.title || !body.title.trim()) {
    return NextResponse.json(
      { success: false, code: 'MISSING_TITLE', error: 'title is required' },
      { status: 400 }
    )
  }

  try {
    const db = getDb()
    const id = await archiveComplianceDocument(db, {
      kind: body.kind,
      title: body.title.trim(),
      payload: body.payload,
      actorId: user.id,
    })
    if (id == null) {
      return NextResponse.json({ success: false, code: 'INVALID_KIND' }, { status: 400 })
    }
    void recordAudit(db, {
      actorId: user.id,
      action: `compliance.archive.${body.kind}`,
      resource: 'compliance_archive',
      resourceId: String(id),
      before: null,
      after: { kind: body.kind, title: body.title.trim() },
      ip: getClientIp(request),
    })
    return NextResponse.json({ success: true, data: { id, kind: body.kind } }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
