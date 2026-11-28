import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { OrderRepository } from '@/lib/db/order-repository';
import { TaskLogRepository } from '@/lib/db/task-log-repository';
import { ProductRepository } from '@/lib/db/product-repository';
import { ShopRepository } from '@/lib/db/shop-repository';
import { requireUser } from '@/lib/auth/guards';

function emptyStats() {
  return {
    revenue: '0',
    orders: 0,
    roas: '0',
    csRate: '0',
    hasData: false,
  };
}

export async function GET(request: NextRequest) {
  try {
    // 身份只取会话；统计范围 = 当前用户。
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const orderRepo = new OrderRepository(db);
    const taskLogRepo = new TaskLogRepository(db);
    const productRepo = new ProductRepository(db);

    const shops = await new ShopRepository(db).findByUserId(auth.user.id);
    const shopIds = shops.map((shop) => shop.id);

    // P3-02：订单统计走单条 GROUP BY 聚合查询（idx_orders_shop_status），不再拉全量行。
    const summaries = await orderRepo.summarizeForShops(shopIds);
    let totalRevenue = 0;
    let totalOrders = 0;
    for (const summary of summaries) {
      totalOrders += summary.totalOrders;
      totalRevenue += summary.totalAmount;
    }
    let totalProducts = 0;
    for (const shop of shops) {
      totalProducts += (await productRepo.findByShopId(shop.id)).length;
    }

    if (totalOrders === 0 && totalProducts === 0) {
      return NextResponse.json(emptyStats());
    }

    const logs = await taskLogRepo.findByUserId(auth.user.id, 10000, 0);
    const successTasks = logs.filter(
      (log) => log.status === 'success' || log.status === 'completed'
    ).length;
    const successRate = logs.length > 0 ? (successTasks / logs.length) * 100 : 0;

    // P5-01：ROAS 口径 = 广告收入 / 广告花费（按 campaign 加权），
    // 不再用店铺营收反推（旧公式 totalRevenue/(totalRevenue*0.3) 恒等 3.3）。
    // ad_campaigns 表无独立收入列，单计划收入由花费 × 该计划 ROAS 还原。
    const adRow = (await db
      .prepare(
        `SELECT COALESCE(SUM(spent * roas), 0) AS ad_revenue,
                COALESCE(SUM(spent), 0) AS ad_spend
         FROM ad_campaigns WHERE user_id = ?`
      )
      .get(auth.user.id)) as { ad_revenue: number | string; ad_spend: number | string };
    const adSpend = Number(adRow?.ad_spend ?? 0);
    const adRevenue = Number(adRow?.ad_revenue ?? 0);
    const roas = adSpend > 0 ? (adRevenue / adSpend).toFixed(1) : '0';

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
