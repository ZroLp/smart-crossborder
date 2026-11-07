import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { ShopRepository } from '@/lib/db/shop-repository';
import { requireUser } from '@/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    const auth = requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const shopRepo = new ShopRepository(db);
    const shops = shopRepo.findByUserId(auth.user.id);

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
      userId?: unknown;
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

    const auth = requireUser(request, body.userId);
    if (auth.response) return auth.response;

    if (body.userId !== undefined && body.userId !== null && String(body.userId) !== String(auth.user.id)) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', error: 'Cannot create a shop for another user' },
        { status: 403 }
      );
    }

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
    const result = shopRepo.create({
      user_id: auth.user.id,
      shop_name: shopName,
      domain,
      access_token: accessToken,
      scope: typeof scope === 'string' ? scope : '',
      status: 'active',
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
    const auth = requireUser(request);
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
    const shop = shopRepo.findById(Number(shopId));

    // 跨用户访问不暴露资源是否存在。
    if (!shop || shop.user_id !== auth.user.id) {
      return NextResponse.json(
        { success: false, code: 'SHOP_NOT_FOUND', error: 'Shop not found' },
        { status: 404 }
      );
    }

    shopRepo.delete(shop.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
