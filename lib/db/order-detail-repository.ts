import { DbClient } from './client';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  name: string;
  quantity: number;
  unit_price: number | null;
  subtotal: number | null;
  created_at: string;
}

export interface TrackingEvent {
  id: number;
  order_id: number;
  status: string;
  location: string | null;
  description: string | null;
  carrier: string | null;
  tracking_number: string | null;
  occurred_at: string;
  created_at: string;
}

/** 订单行项目：明细写入 + 按订单批量/单个读取。 */
export class OrderItemRepository {
  constructor(private readonly db: DbClient) {}

  async add(item: Omit<OrderItem, 'id' | 'created_at'> & { created_at?: string }): Promise<number> {
    const result = await this.db
      .prepare('INSERT INTO order_items(order_id, product_id, name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
      .run(item.order_id, item.product_id ?? null, item.name, item.quantity, item.unit_price ?? null, item.subtotal ?? null);
    return Number(result.lastInsertRowid);
  }

  async listByOrder(orderId: number): Promise<OrderItem[]> {
    return (await this.db
      .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id')
      .all(orderId)) as OrderItem[];
  }

  /** 批量读取多个订单的行项目（订单列表页一次取全，避免 N+1）。 */
  async listByOrderIds(orderIds: number[]): Promise<OrderItem[]> {
    if (orderIds.length === 0) return [];
    const rows = await this.db.query(
      'SELECT * FROM order_items WHERE order_id = ANY(?) ORDER BY order_id, id',
      [orderIds]
    );
    return rows.rows as OrderItem[];
  }
}

/** 物流轨迹事件：追加写入 + 按订单倒序读取。 */
export class TrackingEventRepository {
  constructor(private readonly db: DbClient) {}

  async add(event: Omit<TrackingEvent, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db
      .prepare(
        'INSERT INTO tracking_events(order_id, status, location, description, carrier, tracking_number, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        event.order_id,
        event.status,
        event.location ?? null,
        event.description ?? null,
        event.carrier ?? null,
        event.tracking_number ?? null,
        event.occurred_at
      );
    return Number(result.lastInsertRowid);
  }

  /** 最新事件在前。 */
  async listByOrder(orderId: number): Promise<TrackingEvent[]> {
    return (await this.db
      .prepare('SELECT * FROM tracking_events WHERE order_id = ? ORDER BY occurred_at DESC, id DESC')
      .all(orderId)) as TrackingEvent[];
  }

  async listByOrderIds(orderIds: number[]): Promise<TrackingEvent[]> {
    if (orderIds.length === 0) return [];
    const rows = await this.db.query(
      'SELECT * FROM tracking_events WHERE order_id = ANY(?) ORDER BY order_id, occurred_at DESC, id DESC',
      [orderIds]
    );
    return rows.rows as TrackingEvent[];
  }
}
