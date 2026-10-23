import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import { OrderRepository } from '@/lib/db/order-repository'
import { ProductRepository } from '@/lib/db/product-repository'

export async function GET() {
  try {
    const db = getDb()
    const userRepo = new UserRepository(db)
    const shopRepo = new ShopRepository(db)
    const orderRepo = new OrderRepository(db)
    const productRepo = new ProductRepository(db)

    const users = userRepo.findAll(10000, 0)
    const shops = shopRepo.findAll(10000, 0)

    let totalGMV = 0
    let totalOrders = 0
    for (const shop of shops) {
      const orders = orderRepo.findByShopId(shop.id)
      totalOrders += orders.length
      for (const order of orders) {
        totalGMV += (order as any).total_amount || 0
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
