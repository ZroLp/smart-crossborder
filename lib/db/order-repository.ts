import Database from 'better-sqlite3';
import { BaseRepository } from './base-repository';

interface Order {
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
  constructor(db: Database.Database) {
    super(db, 'orders');
  }

  findByShopId(shopId: number): Order[] {
    return this.db.prepare('SELECT * FROM orders WHERE shop_id = ?').all(shopId) as Order[];
  }

  findByStatus(status: string): Order[] {
    return this.db.prepare('SELECT * FROM orders WHERE status = ?').all(status) as Order[];
  }

  findAbnormal(): Order[] {
    return this.db.prepare("SELECT * FROM orders WHERE status IN ('abnormal', 'failed')").all() as Order[];
  }
}
