import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import { OrderRepository } from '@/lib/db/order-repository'
import { ProductRepository } from '@/lib/db/product-repository'
import { requireAdmin } from '@/lib/auth/guards'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (auth.response) return auth.response

    const db = getDb()
    const userRepo = new UserRepository(db)
    const shopRepo = new ShopRepository(db)
    const orderRepo = new OrderRepository(db)
    const productRepo = new ProductRepository(db)

    // admin 可按 userId 过滤统计范围；不传则为全局。
    const userIdStr = request.nextUrl.searchParams.get('userId')
    if (userIdStr) {
      const userId = parseInt(userIdStr, 10)
      if (!Number.isInteger(userId) || userId <= 0) {
        return NextResponse.json(
          { success: false, code: 'INVALID_INPUT', error: 'Invalid userId' },
          { status: 400 }
        )
      }

      const user = userRepo.findById(userId)
      if (!user) {
        return NextResponse.json(
          { success: false, code: 'USER_NOT_FOUND', error: 'User not found' },
          { status: 404 }
        )
      }

      const shops = shopRepo.findByUserId(userId)
      let totalGMV = 0
      let totalOrders = 0
      for (const shop of shops) {
        const orders = orderRepo.findByShopId(shop.id)
        totalOrders += orders.length
        for (const order of orders) {
          totalGMV += order.total_amount || 0
        }
      }

      return NextResponse.json({
        success: true,
        stats: {
          totalUsers: 1,
          totalShops: shops.length,
          totalOrders,
          totalGMV,
        },
      })
    }

    const users = userRepo.findAll(10000, 0)
    const shops = shopRepo.findAll(10000, 0)

    let totalGMV = 0
    let totalOrders = 0
    for (const shop of shops) {
      const orders = orderRepo.findByShopId(shop.id)
      totalOrders += orders.length
      for (const order of orders) {
        totalGMV += order.total_amount || 0
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: users.length,
        totalShops: shops.length,
        totalOrders,
        totalGMV,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
