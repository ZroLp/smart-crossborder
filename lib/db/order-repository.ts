import { DbClient } from './client';
import { BaseRepository } from './base-repository';

export interface Order {
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
}

export interface OrderSummary {
  shopId: number;
  totalOrders: number;
  totalAmount: number;
  statusBreakdown: Record<string, number>;
}

export class OrderRepository extends BaseRepository<Order> {
  constructor(db: DbClient) {
    super(db, 'orders');
  }

  /**
   * P3-02 聚合口径：单次 GROUP BY 取回按状态统计 + 总额/数量，
   * 避免拉全量行到 JS 循环（1000 单样本 <200ms）。
   */
  async summarizeForShops(shopIds: number[]): Promise<OrderSummary[]> {
    if (shopIds.length === 0) return [];
    const rows = await this.db.query(
      `SELECT shop_id,
              status,
              COUNT(*)::BIGINT AS order_count,
              COALESCE(SUM(total_amount), 0) AS total_amount
       FROM orders
       WHERE shop_id = ANY(?)
       GROUP BY shop_id, status`,
      [shopIds]
    );
    const map = new Map<number, OrderSummary>();
    for (const row of rows.rows) {
      const entry =
        map.get(row.shop_id as number) ?? {
          shopId: row.shop_id as number,
          totalOrders: 0,
          totalAmount: 0,
          statusBreakdown: {},
        };
      entry.totalOrders += row.order_count as number;
      entry.totalAmount += row.total_amount as number;
      entry.statusBreakdown[row.status as string] = row.order_count as number;
      map.set(row.shop_id as number, entry);
    }
    return Array.from(map.values());
  }

  async findByShopId(shopId: number): Promise<Order[]> {
    return (await this.db.prepare('SELECT * FROM orders WHERE shop_id = ?').all(shopId)) as Order[];
  }

  async findByStatus(status: string): Promise<Order[]> {
    return (await this.db.prepare('SELECT * FROM orders WHERE status = ?').all(status)) as Order[];
  }

  async findAbnormal(): Promise<Order[]> {
    return (await this.db.prepare("SELECT * FROM orders WHERE status IN ('abnormal', 'failed')").all()) as Order[];
  }
}
