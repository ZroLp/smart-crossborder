import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const role = searchParams.get('role')

    const db = getDb()
    const userRepo = new UserRepository(db)

    let users = userRepo.findAll(10000, 0)

    if (role) {
      users = users.filter(u => u.role === role)
    }

    const total = users.length
    const offset = (page - 1) * limit
    const paginatedUsers = users.slice(offset, offset + limit).map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
    }))

    return NextResponse.json({
      success: true,
      users: paginatedUsers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, role } = body as { userId: number; role: string }

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or role' },
        { status: 400 }
      )
    }

    const validRoles = ['admin', 'operator', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    const db = getDb()
    const userRepo = new UserRepository(db)
    const user = userRepo.findById(userId)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    userRepo.updateRole(userId, role)

    return NextResponse.json({ success: true, userId, role })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
