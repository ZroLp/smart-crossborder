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

export class OrderRepository extends BaseRepository<Order> {
  constructor(db: DbClient) {
    super(db, 'orders');
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
