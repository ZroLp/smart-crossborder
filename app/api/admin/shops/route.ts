import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { ShopRepository } from '@/lib/db/shop-repository'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const status = searchParams.get('status')

    const db = getDb()
    const shopRepo = new ShopRepository(db)

    let shops = shopRepo.findAll(10000, 0)

    if (status) {
      shops = shops.filter(s => s.status === status)
    }

    const total = shops.length
    const offset = (page - 1) * limit
    const paginatedShops = shops.slice(offset, offset + limit).map(s => ({
      id: s.id,
      user_id: s.user_id,
      shop_name: s.shop_name,
      domain: s.domain,
      status: s.status,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }))

    return NextResponse.json({
      success: true,
      shops: paginatedShops,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
