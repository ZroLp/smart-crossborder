import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/init'
import { ShopRepository } from '@/lib/db/shop-repository'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const shopId = parseInt(id, 10)

    if (isNaN(shopId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid shop ID' },
        { status: 400 }
      )
    }

    const db = getDb()
    const shopRepo = new ShopRepository(db)
    const shop = shopRepo.findById(shopId)

    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      shop: {
        id: shop.id,
        user_id: shop.user_id,
        shop_name: shop.shop_name,
        domain: shop.domain,
        status: shop.status,
        created_at: shop.created_at,
        updated_at: shop.updated_at,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
