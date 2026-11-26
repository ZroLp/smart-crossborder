import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import {
  checkLoginRateLimitAsync,
  clearLoginFailuresAsync,
  getClientKey,
  recordLoginFailureAsync,
} from '@/lib/auth/login-rate-limit'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { recordUserDevice, getClientIp } from '@/lib/auth/device'
import { recordAudit } from '@/lib/admin/audit'

/**
 * P8-01 管理后台独立登录：body { username, password }。
 * 成功仅当用户存在、密码正确且 role='admin'；否则统一 401 INVALID_CREDENTIALS
 * （不区分用户不存在 / 密码错误 / 角色不足）。会话复用 createSession。
 */
export async function POST(request: NextRequest) {
  let body: { username?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) {
    return NextResponse.json(
      { success: false, code: 'INVALID_INPUT', error: 'Missing username or password' },
      { status: 400 }
    )
  }

  try {
    const clientKey = getClientKey(request, username)
    const limit = await checkLoginRateLimitAsync(clientKey)
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMITED', error: 'Too many failed login attempts.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }

    const db = getDb()
    const userRepo = new UserRepository(db)
    const valid = await userRepo.verifyPassword(username, password)
    const user = valid ? await userRepo.findByUsername(username) : undefined

    if (!user || user.role !== 'admin') {
      await recordLoginFailureAsync(clientKey)
      return NextResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    await clearLoginFailuresAsync(clientKey)
    const token = await createSession(user.id, db)
    await recordUserDevice(user.id, request, db)
    const response = NextResponse.json({ success: true, userId: user.id, role: user.role })
    setSessionCookie(response, token)

    // P8-02: 审计管理后台登录
    await recordAudit(db, {
      actorId: user.id,
      action: 'admin.login',
      resource: 'admin_session',
      resourceId: String(user.id),
      after: { username: user.username },
      ip: getClientIp(request),
    })
    return response
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
