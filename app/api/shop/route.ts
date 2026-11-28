import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { ShopRepository } from '@/lib/db/shop-repository';
import { AnalyticsRepository } from '@/lib/db/analytics-repository';
import { requireUser } from '@/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const shopRepo = new ShopRepository(db);
    const shops = await shopRepo.findByUserId(auth.user.id);

    return NextResponse.json({ success: true, data: shops });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: {
      shopName?: unknown;
      domain?: unknown;
      accessToken?: unknown;
      scope?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 身份只取会话，不接受请求体中的 userId。
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { shopName, domain, accessToken, scope } = body;

    if (
      typeof shopName !== 'string' ||
      !shopName ||
      typeof domain !== 'string' ||
      !domain ||
      typeof accessToken !== 'string' ||
      !accessToken
    ) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing shopName, domain, or accessToken' },
        { status: 400 }
      );
    }

    const db = getDb();
    const shopRepo = new ShopRepository(db);
    const result = await shopRepo.create({
      user_id: auth.user.id,
      shop_name: shopName,
      domain,
      access_token: accessToken,
      scope: typeof scope === 'string' ? scope : '',
      status: 'active',
    });

    // P5-02 埋点：店铺绑定成功（激活漏斗关键事件；失败不影响主流程）
    await AnalyticsRepository.trackSafe(auth.user.id, 'shop_connected', {
      properties: { domain },
    });

    return NextResponse.json({ success: true, shopId: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const shopId = request.nextUrl.searchParams.get('shopId');
    if (!shopId) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', error: 'Missing shopId' },
        { status: 400 }
      );
    }

    const db = getDb();
    const shopRepo = new ShopRepository(db);
    const shop = await shopRepo.findById(Number(shopId));

    // 跨用户访问不暴露资源是否存在。
    if (!shop || shop.user_id !== auth.user.id) {
      return NextResponse.json(
        { success: false, code: 'SHOP_NOT_FOUND', error: 'Shop not found' },
        { status: 404 }
      );
    }

    await shopRepo.delete(shop.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
