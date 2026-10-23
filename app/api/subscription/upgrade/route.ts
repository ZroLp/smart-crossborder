import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'

interface PlanLimits {
  stores: number
  aiCalls: number
  features: string[]
}

const VALID_PLANS = ['基础版', '专业版', '企业版', 'Basic', 'Pro', 'Enterprise'] as const

const PLAN_LIMITS: Record<string, PlanLimits> = {
  '基础版': { stores: 3, aiCalls: 10000, features: ['basic_ai', 'data_board'] },
  'Basic': { stores: 3, aiCalls: 10000, features: ['basic_ai', 'data_board'] },
  '专业版': { stores: 10, aiCalls: 50000, features: ['full_ai', 'advanced_data', 'api_access'] },
  'Pro': { stores: 10, aiCalls: 50000, features: ['full_ai', 'advanced_data', 'api_access'] },
  '企业版': { stores: -1, aiCalls: -1, features: ['full_ai', 'dedicated_service', 'custom_dev', 'sla'] },
  'Enterprise': { stores: -1, aiCalls: -1, features: ['full_ai', 'dedicated_service', 'custom_dev', 'sla'] },
}

function isValidUserId(value: unknown): value is number {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return Number.isInteger(parsed) && parsed > 0
  }
  return false
}

function extractUserId(request: NextRequest): number | null {
  const headerValue = request.headers.get('x-user-id')
  if (headerValue && isValidUserId(headerValue)) {
    return parseInt(headerValue, 10)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { success: false, error: 'Content-Type must be application/json' },
        { status: 400 }
      )
    }

    let body: { plan?: unknown; userId?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { plan, userId } = body

    if (typeof plan !== 'string' || !plan.trim()) {
      return NextResponse.json(
        { success: false, error: 'Plan name is required' },
        { status: 400 }
      )
    }

    const sanitizedPlan = plan.trim()
    if (!VALID_PLANS.includes(sanitizedPlan as typeof VALID_PLANS[number])) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan name' },
        { status: 400 }
      )
    }

    const targetUserId = isValidUserId(userId) 
      ? (typeof userId === 'string' ? parseInt(userId, 10) : userId)
      : extractUserId(request)

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 401 }
      )
    }

    const db = getDb()
    const userRepo = new UserRepository(db)

    const user = userRepo.findById(targetUserId)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const currentPlan = ('subscription_plan' in user ? user.subscription_plan : null) as string | null
    const normalizedCurrentPlan = currentPlan || 'free'
    
    if (normalizedCurrentPlan === sanitizedPlan) {
      return NextResponse.json(
        { success: false, error: 'Already on this plan' },
        { status: 400 }
      )
    }

    const limits = PLAN_LIMITS[sanitizedPlan]

    const updateStmt = db.prepare(`
      UPDATE users 
      SET subscription_plan = ?, 
          subscription_stores = ?, 
          subscription_ai_calls = ?, 
          subscription_features = ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)

    const logStmt = db.prepare(`
      INSERT INTO subscription_logs (user_id, old_plan, new_plan, changed_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `)

    try {
      db.transaction(() => {
        updateStmt.run(
          sanitizedPlan,
          limits.stores,
          limits.aiCalls,
          JSON.stringify(limits.features),
          targetUserId
        )

        try {
          logStmt.run(targetUserId, normalizedCurrentPlan, sanitizedPlan)
        } catch {
          // subscription_logs table may not exist, skip logging
        }
      })()
    } catch (transactionError) {
      console.error('Transaction failed:', transactionError)
      return NextResponse.json(
        { success: false, error: 'Failed to upgrade subscription' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        plan: sanitizedPlan,
        stores: limits.stores,
        aiCalls: limits.aiCalls,
        features: limits.features,
        unlimitedStores: limits.stores === -1,
        unlimitedAiCalls: limits.aiCalls === -1,
      },
    })
  } catch (error) {
    console.error('Subscription upgrade error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
