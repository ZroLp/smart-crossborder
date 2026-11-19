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
    // 身份只取会话，不接受 query 中的 userId。
    const auth = await requireUser(request);
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
    const userShopIds = async (): Promise<number[]> => {
      if (userId === null) return [];
      return (await new ShopRepository(db).findByUserId(userId)).map((shop) => shop.id);
    };

    if (type === 'products') {
      const productRepo = new ProductRepository(db);
      if (shopId) {
        const shop = await new ShopRepository(db).findById(Number(shopId));
        if (!shop || shop.user_id !== userId) {
          return NextResponse.json(
            { success: false, code: 'SHOP_NOT_FOUND', error: 'Shop not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: await productRepo.findByShopId(shop.id) });
      }
      const shopIds = await userShopIds();
      const products = (
        await Promise.all(shopIds.map((id) => productRepo.findByShopId(id)))
      ).flatMap((list) => list);
      return NextResponse.json({ success: true, data: products.slice(offset, offset + limit) });
    }

    if (type === 'orders') {
      const orderRepo = new OrderRepository(db);
      // 完整订单字段 + 明细/轨迹空数组（当前无明细表，不伪造数据）。
      const toFullOrder = (order: {
        id: number;
        shop_id: number;
        order_number: string | null;
        customer_name: string | null;
        total_amount: number | null;
        status: string;
        shipping_region: string | null;
        shipping_weight: number | null;
        logistics_channel: string | null;
        created_at: string;
      }) => ({
        id: order.id,
        shop_id: order.shop_id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        total_amount: order.total_amount,
        status: order.status,
        shipping_region: order.shipping_region,
        shipping_weight: order.shipping_weight,
        logistics_channel: order.logistics_channel,
        created_at: order.created_at,
        items: [] as unknown[],
        tracking: [] as unknown[],
      });

      if (shopId) {
        const shop = await new ShopRepository(db).findById(Number(shopId));
        if (!shop || shop.user_id !== userId) {
          return NextResponse.json(
            { success: false, code: 'SHOP_NOT_FOUND', error: 'Shop not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: (await orderRepo.findByShopId(shop.id)).map(toFullOrder),
        });
      }
      const shopIds = await userShopIds();
      const orders = (
        await Promise.all(shopIds.map((id) => orderRepo.findByShopId(id)))
      ).flatMap((list) => list);
      return NextResponse.json({
        success: true,
        data: orders.slice(offset, offset + limit).map(toFullOrder),
      });
    }

    if (type === 'task-logs') {
      const taskLogRepo = new TaskLogRepository(db);
      let logs = await taskLogRepo.findByUserId(userId, 1000, 0);
      if (agentType) logs = logs.filter((log) => log.agent_type === agentType);
      return NextResponse.json({ success: true, data: logs.slice(offset, offset + limit) });
    }

    if (type === 'dashboard') {
      const productRepo = new ProductRepository(db);
      const orderRepo = new OrderRepository(db);
      const taskLogRepo = new TaskLogRepository(db);

      const shops = await userShopIds();
      const totalProducts = (
        await Promise.all(shops.map((id) => productRepo.findByShopId(id)))
      ).reduce((sum, list) => sum + list.length, 0);
      const totalOrders = (
        await Promise.all(shops.map((id) => orderRepo.findByShopId(id)))
      ).reduce((sum, list) => sum + list.length, 0);
      const recentLogs = await taskLogRepo.findByUserId(userId, 10, 0);
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
