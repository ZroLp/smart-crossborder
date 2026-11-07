import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { ProductRepository } from '@/lib/db/product-repository';
import { OrderRepository } from '@/lib/db/order-repository';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { ShopRepository } from '@/lib/db/shop-repository';
import { requireUser } from '@/lib/auth/guards';

type DataType = 'products' | 'orders' | 'task-logs' | 'dashboard';

const VALID_TYPES: DataType[] = ['products', 'orders', 'task-logs', 'dashboard'];

export async function GET(request: NextRequest) {
  try {
    // 身份只取会话；query userId 仅在 AUTH_LEGACY_COMPAT=1 时兜底。
    const auth = requireUser(request);
    if (auth.response) return auth.response;
    const userId: number = auth.user.id;

    const type = request.nextUrl.searchParams.get('type') as DataType | null;
    const shopId = request.nextUrl.searchParams.get('shopId');
    const limit = Number(request.nextUrl.searchParams.get('limit')) || 100;
    const offset = Number(request.nextUrl.searchParams.get('offset')) || 0;
    const agentType = request.nextUrl.searchParams.get('agentType');

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid or missing type. Valid types: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const db = getDb();

    // 数据一律按当前会话用户过滤。
    const userShopIds = (): number[] => {
      if (userId === null) return [];
      return new ShopRepository(db).findByUserId(userId).map((shop) => shop.id);
    };

    if (type === 'products') {
      const productRepo = new ProductRepository(db);
      if (shopId) {
        const shop = new ShopRepository(db).findById(Number(shopId));
        if (!shop || shop.user_id !== userId) {
          return NextResponse.json(
            { success: false, code: 'SHOP_NOT_FOUND', error: 'Shop not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: productRepo.findByShopId(shop.id) });
      }
      const products = userShopIds().flatMap((id) => productRepo.findByShopId(id));
      return NextResponse.json({ success: true, data: products.slice(offset, offset + limit) });
    }

    if (type === 'orders') {
      const orderRepo = new OrderRepository(db);
      if (shopId) {
        const shop = new ShopRepository(db).findById(Number(shopId));
        if (!shop || shop.user_id !== userId) {
          return NextResponse.json(
            { success: false, code: 'SHOP_NOT_FOUND', error: 'Shop not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: orderRepo.findByShopId(shop.id) });
      }
      const orders = userShopIds().flatMap((id) => orderRepo.findByShopId(id));
      return NextResponse.json({ success: true, data: orders.slice(offset, offset + limit) });
    }

    if (type === 'task-logs') {
      const taskLogRepo = new TaskLogRepository(db);
      let logs = taskLogRepo.findByUserId(userId, 1000, 0);
      if (agentType) logs = logs.filter((log) => log.agent_type === agentType);
      return NextResponse.json({ success: true, data: logs.slice(offset, offset + limit) });
    }

    if (type === 'dashboard') {
      const productRepo = new ProductRepository(db);
      const orderRepo = new OrderRepository(db);
      const taskLogRepo = new TaskLogRepository(db);

      const shops = userShopIds();
      const totalProducts = shops.reduce(
        (sum, id) => sum + productRepo.findByShopId(id).length,
        0
      );
      const totalOrders = shops.reduce(
        (sum, id) => sum + orderRepo.findByShopId(id).length,
        0
      );
      const recentLogs = taskLogRepo.findByUserId(userId, 10, 0);
      const pendingTasks = recentLogs.filter((log) => log.status === 'pending').length;

      return NextResponse.json({
        success: true,
        data: { totalProducts, totalOrders, pendingTasks, recentLogs },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unhandled type' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
