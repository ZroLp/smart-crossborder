import { DbClient } from '../../lib/db/client';
import { initDatabase } from '../../lib/db/init';
import { UserRepository } from '../../lib/db/user-repository';
import { hashPassword } from '../../lib/auth/password-hash'
import { ShopRepository } from '../../lib/db/shop-repository';
import { ProductRepository } from '../../lib/db/product-repository';
import { OrderRepository } from '../../lib/db/order-repository';
import { TaskLogRepository } from '../../lib/db/task-log-repository';
import { KnowledgeBaseRepository } from '../../lib/db/knowledge-base-repository';

let db: DbClient;
let userRepo: UserRepository;
let shopRepo: ShopRepository;
let productRepo: ProductRepository;
let orderRepo: OrderRepository;
let taskLogRepo: TaskLogRepository;
let kbRepo: KnowledgeBaseRepository;

beforeEach(async () => {
  db = initDatabase(':memory:');
  userRepo = new UserRepository(db);
  shopRepo = new ShopRepository(db);
  productRepo = new ProductRepository(db);
  orderRepo = new OrderRepository(db);
  taskLogRepo = new TaskLogRepository(db);
  kbRepo = new KnowledgeBaseRepository(db);
});

afterEach(async () => {
  await db.close();
});

describe('Database Initialization', () => {
  test('should create all 6 tables', async () => {
    const tables = await db.prepare("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY name").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('shops');
    expect(tableNames).toContain('products');
    expect(tableNames).toContain('orders');
    expect(tableNames).toContain('task_logs');
    expect(tableNames).toContain('knowledge_base');
  });
});

describe('UserRepository', () => {
  test('should create a user', async () => {
    const result = await userRepo.create({ username: 'testuser', password: 'pass123', email: 'test@test.com' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find user by id', async () => {
    await userRepo.create({ username: 'testuser', password: 'pass123' });
    const user = await userRepo.findById(1);
    expect(user).toBeDefined();
    expect(user!.username).toBe('testuser');
  });

  test('should find user by username', async () => {
    await userRepo.create({ username: 'testuser', password: 'pass123' });
    const user = await userRepo.findByUsername('testuser');
    expect(user).toBeDefined();
    expect(user!.username).toBe('testuser');
  });

  test('should verify password correctly', async () => {
    await userRepo.create({ username: 'testuser', password: hashPassword('pass123') });
    expect(await userRepo.verifyPassword('testuser', 'pass123')).toBe(true);
    expect(await userRepo.verifyPassword('testuser', 'wrong')).toBe(false);
    expect(await userRepo.verifyPassword('nonexistent', 'pass123')).toBe(false);
  });

  test('should update a user', async () => {
    await userRepo.create({ username: 'testuser', password: 'pass123' });
    await userRepo.update(1, { email: 'new@test.com' });
    const user = await userRepo.findById(1);
    expect(user!.email).toBe('new@test.com');
  });

  test('should delete a user', async () => {
    await userRepo.create({ username: 'testuser', password: 'pass123' });
    await userRepo.delete(1);
    expect(await userRepo.findById(1)).toBeUndefined();
  });

  test('should count users', async () => {
    await userRepo.create({ username: 'user1', password: 'pass1' });
    await userRepo.create({ username: 'user2', password: 'pass2' });
    expect(await userRepo.count()).toBe(2);
  });
});

describe('ShopRepository', () => {
  beforeEach(async () => {
    await userRepo.create({ username: 'shopowner', password: 'pass123' });
  });

  test('should create a shop', async () => {
    const result = await shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token-123' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find shops by user id', async () => {
    await shopRepo.create({ user_id: 1, shop_name: 'Shop 1', domain: 'shop1.myshopify.com', access_token: 'token1' });
    await shopRepo.create({ user_id: 1, shop_name: 'Shop 2', domain: 'shop2.myshopify.com', access_token: 'token2' });
    const shops = await shopRepo.findByUserId(1);
    expect(shops).toHaveLength(2);
  });

  test('should find shop by domain', async () => {
    await shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
    const shop = await shopRepo.findByDomain('myshop.myshopify.com');
    expect(shop).toBeDefined();
    expect(shop!.shop_name).toBe('My Shop');
  });

  test('should update shop status', async () => {
    await shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
    await shopRepo.update(1, { status: 'inactive' });
    const shop = await shopRepo.findById(1);
    expect(shop!.status).toBe('inactive');
  });

  test('should delete a shop', async () => {
    await shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
    await shopRepo.delete(1);
    expect(await shopRepo.findById(1)).toBeUndefined();
  });
});

describe('ProductRepository', () => {
  beforeEach(async () => {
    await userRepo.create({ username: 'shopowner', password: 'pass123' });
    await shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
  });

  test('should create a product', async () => {
    const result = await productRepo.create({ shop_id: 1, name: 'Widget', category: 'electronics', price: 29.99, cost: 10.0, stock: 100 });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find products by shop id', async () => {
    await productRepo.create({ shop_id: 1, name: 'Widget A' });
    await productRepo.create({ shop_id: 1, name: 'Widget B' });
    const products = await productRepo.findByShopId(1);
    expect(products).toHaveLength(2);
  });

  test('should find products by category', async () => {
    await productRepo.create({ shop_id: 1, name: 'Widget', category: 'electronics' });
    await productRepo.create({ shop_id: 1, name: 'Gadget', category: 'accessories' });
    const products = await productRepo.findByCategory('electronics');
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Widget');
  });

  test('should find low stock products', async () => {
    await productRepo.create({ shop_id: 1, name: 'Low Stock', category: 'test', stock: 3, status: 'active' });
    await productRepo.create({ shop_id: 1, name: 'High Stock', category: 'test', stock: 100, status: 'active' });
    await productRepo.create({ shop_id: 1, name: 'Inactive Low', category: 'test', stock: 2, status: 'inactive' });
    const lowStock = await productRepo.findLowStock(5);
    expect(lowStock).toHaveLength(1);
    expect(lowStock[0].name).toBe('Low Stock');
  });

  test('should update product stock', async () => {
    await productRepo.create({ shop_id: 1, name: 'Widget', stock: 100 });
    await productRepo.update(1, { stock: 50 });
    const product = await productRepo.findById(1);
    expect(product!.stock).toBe(50);
  });

  test('should delete a product', async () => {
    await productRepo.create({ shop_id: 1, name: 'Widget' });
    await productRepo.delete(1);
    expect(await productRepo.findById(1)).toBeUndefined();
  });
});

describe('OrderRepository', () => {
  beforeEach(async () => {
    await userRepo.create({ username: 'shopowner', password: 'pass123' });
    await shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
  });

  test('should create an order', async () => {
    const result = await orderRepo.create({ shop_id: 1, order_number: 'ORD-001', customer_name: 'John', total_amount: 99.99, status: 'pending' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find orders by shop id', async () => {
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-001' });
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-002' });
    const orders = await orderRepo.findByShopId(1);
    expect(orders).toHaveLength(2);
  });

  test('should find orders by status', async () => {
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-001', status: 'pending' });
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-002', status: 'shipped' });
    const pending = await orderRepo.findByStatus('pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].order_number).toBe('ORD-001');
  });

  test('should find abnormal orders', async () => {
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-001', status: 'abnormal' });
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-002', status: 'failed' });
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-003', status: 'pending' });
    const abnormal = await orderRepo.findAbnormal();
    expect(abnormal).toHaveLength(2);
  });

  test('should update order status', async () => {
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-001', status: 'pending' });
    await orderRepo.update(1, { status: 'shipped' });
    const order = await orderRepo.findById(1);
    expect(order!.status).toBe('shipped');
  });

  test('should delete an order', async () => {
    await orderRepo.create({ shop_id: 1, order_number: 'ORD-001' });
    await orderRepo.delete(1);
    expect(await orderRepo.findById(1)).toBeUndefined();
  });
});

describe('TaskLogRepository', () => {
  test('should create a task log', async () => {
    const result = await taskLogRepo.create({ agent_type: 'listing', task_name: 'generate_description', status: 'pending', input: '{"product": "Widget"}' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find task logs by agent type', async () => {
    await taskLogRepo.create({ agent_type: 'listing', task_name: 'task1' });
    await taskLogRepo.create({ agent_type: 'logistics', task_name: 'task2' });
    const logs = await taskLogRepo.findByAgentType('listing');
    expect(logs).toHaveLength(1);
  });

  test('should find task logs by status', async () => {
    await taskLogRepo.create({ agent_type: 'listing', task_name: 'task1', status: 'pending' });
    await taskLogRepo.create({ agent_type: 'listing', task_name: 'task2', status: 'completed' });
    const pending = await taskLogRepo.findByStatus('pending');
    expect(pending).toHaveLength(1);
  });

  test('should update task log status', async () => {
    await taskLogRepo.create({ agent_type: 'listing', task_name: 'task1', status: 'pending' });
    await taskLogRepo.updateStatus(1, 'completed', 'Done successfully');
    const log = await taskLogRepo.findById(1);
    expect(log!.status).toBe('completed');
    expect(log!.output).toBe('Done successfully');
  });

  test('should update task log status with error', async () => {
    await taskLogRepo.create({ agent_type: 'listing', task_name: 'task1', status: 'pending' });
    await taskLogRepo.updateStatus(1, 'failed', undefined, 'Something went wrong');
    const log = await taskLogRepo.findById(1);
    expect(log!.status).toBe('failed');
    expect(log!.error).toBe('Something went wrong');
  });

  test('should delete a task log', async () => {
    await taskLogRepo.create({ agent_type: 'listing', task_name: 'task1' });
    await taskLogRepo.delete(1);
    expect(await taskLogRepo.findById(1)).toBeUndefined();
  });
});

describe('KnowledgeBaseRepository', () => {
  test('should create a knowledge base entry', async () => {
    const result = await kbRepo.create({ agent_type: 'listing', question: 'How to optimize title?', answer: 'Use keywords in the first 50 chars' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find entries by agent type', async () => {
    await kbRepo.create({ agent_type: 'listing', question: 'Q1', answer: 'A1' });
    await kbRepo.create({ agent_type: 'logistics', question: 'Q2', answer: 'A2' });
    const entries = await kbRepo.findByAgentType('listing');
    expect(entries).toHaveLength(1);
  });

  test('should search by question keyword', async () => {
    await kbRepo.create({ agent_type: 'listing', question: 'How to optimize title?', answer: 'A1' });
    await kbRepo.create({ agent_type: 'listing', question: 'Best pricing strategy?', answer: 'A2' });
    const results = await kbRepo.searchByQuestion('listing', 'optimize');
    expect(results).toHaveLength(1);
    expect(results[0].question).toContain('optimize');
  });

  test('should find entries by language', async () => {
    await kbRepo.create({ agent_type: 'listing', question: 'Q1', answer: 'A1', language: 'zh' });
    await kbRepo.create({ agent_type: 'logistics', question: 'Q2', answer: 'A2', language: 'en' });
    const zhEntries = await kbRepo.findByLanguage('zh');
    expect(zhEntries).toHaveLength(1);
  });

  test('should update a knowledge base entry', async () => {
    await kbRepo.create({ agent_type: 'listing', question: 'Q1', answer: 'Old answer' });
    await kbRepo.update(1, { answer: 'New answer' });
    const entry = await kbRepo.findById(1);
    expect(entry!.answer).toBe('New answer');
  });

  test('should delete a knowledge base entry', async () => {
    await kbRepo.create({ agent_type: 'listing', question: 'Q1', answer: 'A1' });
    await kbRepo.delete(1);
    expect(await kbRepo.findById(1)).toBeUndefined();
  });
});
