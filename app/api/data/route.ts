import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { ProductRepository } from '@/lib/db/product-repository';
import { OrderRepository } from '@/lib/db/order-repository';
import { TaskLogRepository } from '@/lib/db/task-log-repository';

type DataType = 'products' | 'orders' | 'task-logs' | 'dashboard';

const VALID_TYPES: DataType[] = ['products', 'orders', 'task-logs', 'dashboard'];

export async function GET(request: NextRequest) {
  try {
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

    if (type === 'products') {
      const productRepo = new ProductRepository(db);
      if (shopId) {
        const products = productRepo.findByShopId(Number(shopId));
        return NextResponse.json({ success: true, data: products });
      }
      const products = productRepo.findAll(limit, offset);
      return NextResponse.json({ success: true, data: products });
    }

    if (type === 'orders') {
      const orderRepo = new OrderRepository(db);
      if (shopId) {
        const orders = orderRepo.findByShopId(Number(shopId));
        return NextResponse.json({ success: true, data: orders });
      }
      const orders = orderRepo.findAll(limit, offset);
      return NextResponse.json({ success: true, data: orders });
    }

    if (type === 'task-logs') {
      const taskLogRepo = new TaskLogRepository(db);
      if (agentType) {
        const logs = taskLogRepo.findByAgentType(agentType);
        return NextResponse.json({ success: true, data: logs });
      }
      const logs = taskLogRepo.findAll(limit, offset);
      return NextResponse.json({ success: true, data: logs });
    }

    if (type === 'dashboard') {
      const productRepo = new ProductRepository(db);
      const orderRepo = new OrderRepository(db);
      const taskLogRepo = new TaskLogRepository(db);

      const totalProducts = productRepo.count();
      const totalOrders = orderRepo.count();
      const pendingTasks = taskLogRepo.findByStatus('pending').length;
      const recentLogs = taskLogRepo.findAll(10, 0);

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
