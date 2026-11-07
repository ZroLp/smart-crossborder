import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { ShopRepository } from '@/lib/db/shop-repository';
import { validateState } from '@/lib/shopify/oauth-state';
import { syncShopifyData } from '@/lib/shopify/sync';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const shop = request.nextUrl.searchParams.get('shop');
    const state = request.nextUrl.searchParams.get('state');
    const hmac = request.nextUrl.searchParams.get('hmac');

    if (!code || !shop || !state) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters (code, shop, state)' },
        { status: 400 }
      );
    }

    const stateData = validateState(state);
    if (!stateData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired state parameter' },
        { status: 403 }
      );
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, error: 'Shopify API configuration missing' },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return NextResponse.json(
        { success: false, error: `Token exchange failed: ${tokenResponse.status} ${errorText}` },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope || '';

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'No access token received from Shopify' },
        { status: 400 }
      );
    }

    const db = getDb();
    const shopRepo = new ShopRepository(db);

    let shopId: number;
    const existingShop = shopRepo.findByUserIdAndDomain(stateData.userId, shop);
    if (existingShop) {
      shopRepo.update(existingShop.id, {
        access_token: accessToken,
        scope,
        status: 'active',
        updated_at: new Date().toISOString(),
      });
      shopId = existingShop.id;
    } else {
      const created = shopRepo.create({
        user_id: stateData.userId,
        shop_name: shop.replace('.myshopify.com', ''),
        domain: shop,
        access_token: accessToken,
        scope,
        status: 'active',
      });
      shopId = Number(created.lastInsertRowid);
    }

    // 商品/订单同步是尽力而为：失败不影响授权成功。
    try {
      await syncShopifyData(shop, accessToken, shopId, db);
    } catch (syncError) {
      console.warn('[shopify] data sync failed:', syncError);
    }

    return NextResponse.json({ success: true, shop });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
