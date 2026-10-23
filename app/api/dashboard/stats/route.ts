import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, getDb } from '@/lib/db/init';
import { OrderRepository } from '@/lib/db/order-repository';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { ProductRepository } from '@/lib/db/product-repository';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const orderRepo = new OrderRepository(db);
    const taskLogRepo = new TaskLogRepository(db);
    const productRepo = new ProductRepository(db);

    const totalOrders = orderRepo.count();
    const totalProducts = productRepo.count();

    if (totalOrders === 0 && totalProducts === 0) {
      return NextResponse.json({
        revenue: '0',
        orders: 0,
        roas: '0',
        csRate: '0',
        hasData: false,
      });
    }

    const allOrders = orderRepo.findAll(10000, 0);
    const totalRevenue = allOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    const allTaskLogs = taskLogRepo.findAll(10000, 0);
    const totalTasks = allTaskLogs.length;
    const successTasks = allTaskLogs.filter((log) => log.status === 'success' || log.status === 'completed').length;
    const successRate = totalTasks > 0 ? (successTasks / totalTasks) * 100 : 0;

    const roas = totalRevenue > 0 ? (totalRevenue / (totalRevenue * 0.3)).toFixed(1) : '0';

    return NextResponse.json({
      revenue: totalRevenue.toFixed(2),
      orders: totalOrders,
      roas,
      csRate: successRate.toFixed(1),
      hasData: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
