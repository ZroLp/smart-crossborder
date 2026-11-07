import Database from 'better-sqlite3';
import { ShopRepository } from './shop-repository';
import { ProductRepository } from './product-repository';
import { OrderRepository } from './order-repository';

export interface SeedResult {
  seeded: boolean;
  shops: number;
  products: number;
  orders: number;
}

interface SeedUserRow {
  id: number;
  username: string;
}

const DEMO_PRODUCTS = [
  { name: '便携折叠收纳箱', category: 'home', price: 39.9, cost: 12.5, sales: 1280, stock: 320 },
  { name: '无线蓝牙运动耳机', category: 'electronics', price: 129, cost: 48, sales: 860, stock: 180 },
  { name: '多功能宠物梳毛器', category: 'pet', price: 29.9, cost: 8.8, sales: 2400, stock: 540 },
];

const DEMO_ORDERS = [
  { suffix: '001', customer: 'Alice Chen', amount: 79.8, status: 'completed', region: 'US', weight: 1.2, channel: 'DHL Express' },
  { suffix: '002', customer: 'Bruno Silva', amount: 129, status: 'pending', region: 'BR', weight: 0.6, channel: '拉美专线' },
  { suffix: '003', customer: 'Yuki Tanaka', amount: 29.9, status: 'shipped', region: 'JP', weight: 0.4, channel: '中邮小包' },
];

/**
 * Idempotent demo seed: only runs when products and orders are empty.
 * Existing shops for a user are reused; a shop is created when missing.
 */
export function seedDemoData(db: Database.Database): SeedResult {
  const shopRepo = new ShopRepository(db);
  const productRepo = new ProductRepository(db);
  const orderRepo = new OrderRepository(db);

  if (productRepo.count() > 0 || orderRepo.count() > 0) {
    return { seeded: false, shops: 0, products: 0, orders: 0 };
  }

  const users = db
    .prepare('SELECT id, username FROM users ORDER BY id')
    .all() as SeedUserRow[];

  if (users.length === 0) {
    return { seeded: false, shops: 0, products: 0, orders: 0 };
  }

  let shopsCreated = 0;
  let productsCreated = 0;
  let ordersCreated = 0;

  const seed = db.transaction(() => {
    for (const user of users) {
      let shop = shopRepo.findByUserId(user.id)[0];
      if (!shop) {
        const result = shopRepo.create({
          user_id: user.id,
          shop_name: `${user.username} 的演示店铺`,
          domain: `${user.username}.myshopify.com`,
          access_token: 'demo-access-token',
          scope: 'read_products,read_orders',
          status: 'active',
        });
        shopsCreated += 1;
        shop = shopRepo.findById(Number(result.lastInsertRowid))!;
      }

      for (const product of DEMO_PRODUCTS) {
        productRepo.create({
          shop_id: shop.id,
          name: product.name,
          category: product.category,
          price: product.price,
          cost: product.cost,
          sales: product.sales,
          stock: product.stock,
          status: 'active',
        });
        productsCreated += 1;
      }

      for (const order of DEMO_ORDERS) {
        orderRepo.create({
          shop_id: shop.id,
          order_number: `${user.username}-ORD-${order.suffix}`,
          customer_name: order.customer,
          total_amount: order.amount,
          status: order.status,
          shipping_region: order.region,
          shipping_weight: order.weight,
          logistics_channel: order.channel,
        });
        ordersCreated += 1;
      }
    }
  });

  seed();

  return {
    seeded: shopsCreated + productsCreated + ordersCreated > 0,
    shops: shopsCreated,
    products: productsCreated,
    orders: ordersCreated,
  };
}
