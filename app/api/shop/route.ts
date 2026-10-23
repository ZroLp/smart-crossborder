import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { ShopRepository } from '@/lib/db/shop-repository';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    const db = getDb();
    const shopRepo = new ShopRepository(db);
    const shops = shopRepo.findByUserId(Number(userId));

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
    const body = await request.json();
    const { userId, shopName, domain, accessToken, scope } = body as {
      userId: number;
      shopName: string;
      domain: string;
      accessToken: string;
      scope?: string;
    };

    if (!userId || !shopName || !domain || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing userId, shopName, domain, or accessToken' },
        { status: 400 }
      );
    }

    const db = getDb();
    const shopRepo = new ShopRepository(db);
    const result = shopRepo.create({
      user_id: userId,
      shop_name: shopName,
      domain,
      access_token: accessToken,
      scope: scope ?? '',
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
    const shopId = request.nextUrl.searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: 'Missing shopId' },
        { status: 400 }
      );
    }

    const db = getDb();
    const shopRepo = new ShopRepository(db);
    const shop = shopRepo.findById(Number(shopId));

    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      );
    }

    shopRepo.delete(Number(shopId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
