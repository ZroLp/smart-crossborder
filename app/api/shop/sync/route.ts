import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';
import { syncShopifyData } from '@/lib/shopify/sync';

/**
 * P5-05：手动触发 Shopify 增量同步（补拉）
 *
 * POST /api/shop/sync  { shopId: number }
 *
 * - 使用该店铺的 `last_sync_at` 作为增量游标；首次同步传 null（全量拉取）
 * - 同步成功后更新 `shops.last_sync_at`
 * - 若 token 过期（401）则将店铺 status 置为 'expired'，前端据此显示「重新授权」
 * - 返回同步统计 + 是否过期
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const shopId = Number(body.shopId);
    if (!Number.isFinite(shopId)) {
      return NextResponse.json(
        { success: false, error: 'shopId is required', code: 'VALIDATION' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify the shop belongs to the current user
    const shop = (await db
      .prepare('SELECT * FROM shops WHERE id = ? AND user_id = ?')
      .get(shopId, auth.user.id)) as
      | { id: number; domain: string; access_token: string; last_sync_at: string | null; status: string }
      | undefined;

    if (!shop) {
      return NextResponse.json(
        { success: false, code: 'SHOP_NOT_FOUND', error: 'Shop not found' },
        { status: 404 }
      );
    }

    const result = await syncShopifyData(
      shop.domain,
      shop.access_token,
      shop.id,
      db,
      shop.last_sync_at ?? undefined
    );

    // P5-05: if token expired, mark the shop status as 'expired'
    if (result.tokenExpired) {
      await db
        .prepare("UPDATE shops SET status = 'expired' WHERE id = ?")
        .run(shop.id);
    } else if (result.shopSynced) {
      await db
        .prepare('UPDATE shops SET last_sync_at = now(), status = \'active\' WHERE id = ?')
        .run(shop.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        products: result.products,
        orders: result.orders,
        errors: result.errors,
        tokenExpired: result.tokenExpired,
        syncedAt: result.shopSynced ? new Date().toISOString() : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
