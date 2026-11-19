import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { requireUser } from '@/lib/auth/guards';

interface OrderDetailRow {
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
  shop_name: string;
  shop_domain: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const numericId = /^\d+$/.test(id) ? Number(id) : -1;
    const db = getDb();

    // 归属校验在 JOIN 条件中完成：跨用户访问与不存在同样返回 404。
    const row = (await db
      .prepare(
        `SELECT o.*, s.shop_name, s.domain AS shop_domain
           FROM orders o
           JOIN shops s ON s.id = o.shop_id
          WHERE s.user_id = ? AND (o.id = ? OR o.order_number = ?)`
      )
      .get(auth.user.id, numericId, id)) as OrderDetailRow | undefined;

    if (!row) {
      return NextResponse.json(
        { success: false, code: 'ORDER_NOT_FOUND', error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: row.id,
          shopId: row.shop_id,
          shopName: row.shop_name,
          shopDomain: row.shop_domain,
          orderNumber: row.order_number,
          customerName: row.customer_name,
          totalAmount: row.total_amount,
          status: row.status,
          shippingRegion: row.shipping_region,
          shippingWeight: row.shipping_weight,
          logisticsChannel: row.logistics_channel,
          createdAt: row.created_at,
        },
        // 数据库当前没有订单明细/轨迹表：返回空数组，不伪造数据。
        items: [],
        tracking: [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
