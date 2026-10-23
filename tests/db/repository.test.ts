import Database from 'better-sqlite3';
import { initDatabase } from '../../lib/db/init';
import { UserRepository } from '../../lib/db/user-repository';
import { hashPassword } from '../../lib/auth/password-hash'
import { ShopRepository } from '../../lib/db/shop-repository';
import { ProductRepository } from '../../lib/db/product-repository';
import { OrderRepository } from '../../lib/db/order-repository';
import { TaskLogRepository } from '../../lib/db/task-log-repository';
import { KnowledgeBaseRepository } from '../../lib/db/knowledge-base-repository';

let db: Database.Database;
let userRepo: UserRepository;
let shopRepo: ShopRepository;
let productRepo: ProductRepository;
let orderRepo: OrderRepository;
let taskLogRepo: TaskLogRepository;
let kbRepo: KnowledgeBaseRepository;

beforeEach(() => {
  db = initDatabase(':memory:');
  userRepo = new UserRepository(db);
  shopRepo = new ShopRepository(db);
  productRepo = new ProductRepository(db);
  orderRepo = new OrderRepository(db);
  taskLogRepo = new TaskLogRepository(db);
  kbRepo = new KnowledgeBaseRepository(db);
});

afterEach(() => {
  db.close();
});

describe('Database Initialization', () => {
  test('should create all 6 tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
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
  test('should create a user', () => {
    const result = userRepo.create({ username: 'testuser', password: 'pass123', email: 'test@test.com' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find user by id', () => {
    userRepo.create({ username: 'testuser', password: 'pass123' });
    const user = userRepo.findById(1);
    expect(user).toBeDefined();
    expect(user!.username).toBe('testuser');
  });

  test('should find user by username', () => {
    userRepo.create({ username: 'testuser', password: 'pass123' });
    const user = userRepo.findByUsername('testuser');
    expect(user).toBeDefined();
    expect(user!.username).toBe('testuser');
  });

  test('should verify password correctly', () => {
    userRepo.create({ username: 'testuser', password: hashPassword('pass123') });
    expect(userRepo.verifyPassword('testuser', 'pass123')).toBe(true);
    expect(userRepo.verifyPassword('testuser', 'wrong')).toBe(false);
    expect(userRepo.verifyPassword('nonexistent', 'pass123')).toBe(false);
  });

  test('should update a user', () => {
    userRepo.create({ username: 'testuser', password: 'pass123' });
    userRepo.update(1, { email: 'new@test.com' });
    const user = userRepo.findById(1);
    expect(user!.email).toBe('new@test.com');
  });

  test('should delete a user', () => {
    userRepo.create({ username: 'testuser', password: 'pass123' });
    userRepo.delete(1);
    expect(userRepo.findById(1)).toBeUndefined();
  });

  test('should count users', () => {
    userRepo.create({ username: 'user1', password: 'pass1' });
    userRepo.create({ username: 'user2', password: 'pass2' });
    expect(userRepo.count()).toBe(2);
  });
});

describe('ShopRepository', () => {
  beforeEach(() => {
    userRepo.create({ username: 'shopowner', password: 'pass123' });
  });

  test('should create a shop', () => {
    const result = shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token-123' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find shops by user id', () => {
    shopRepo.create({ user_id: 1, shop_name: 'Shop 1', domain: 'shop1.myshopify.com', access_token: 'token1' });
    shopRepo.create({ user_id: 1, shop_name: 'Shop 2', domain: 'shop2.myshopify.com', access_token: 'token2' });
    const shops = shopRepo.findByUserId(1);
    expect(shops).toHaveLength(2);
  });

  test('should find shop by domain', () => {
    shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
    const shop = shopRepo.findByDomain('myshop.myshopify.com');
    expect(shop).toBeDefined();
    expect(shop!.shop_name).toBe('My Shop');
  });

  test('should update shop status', () => {
    shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
    shopRepo.update(1, { status: 'inactive' });
    const shop = shopRepo.findById(1);
    expect(shop!.status).toBe('inactive');
  });

  test('should delete a shop', () => {
    shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
    shopRepo.delete(1);
    expect(shopRepo.findById(1)).toBeUndefined();
  });
});

describe('ProductRepository', () => {
  beforeEach(() => {
    userRepo.create({ username: 'shopowner', password: 'pass123' });
    shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
  });

  test('should create a product', () => {
    const result = productRepo.create({ shop_id: 1, name: 'Widget', category: 'electronics', price: 29.99, cost: 10.0, stock: 100 });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find products by shop id', () => {
    productRepo.create({ shop_id: 1, name: 'Widget A' });
    productRepo.create({ shop_id: 1, name: 'Widget B' });
    const products = productRepo.findByShopId(1);
    expect(products).toHaveLength(2);
  });

  test('should find products by category', () => {
    productRepo.create({ shop_id: 1, name: 'Widget', category: 'electronics' });
    productRepo.create({ shop_id: 1, name: 'Gadget', category: 'accessories' });
    const products = productRepo.findByCategory('electronics');
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Widget');
  });

  test('should find low stock products', () => {
    productRepo.create({ shop_id: 1, name: 'Low Stock', category: 'test', stock: 3, status: 'active' });
    productRepo.create({ shop_id: 1, name: 'High Stock', category: 'test', stock: 100, status: 'active' });
    productRepo.create({ shop_id: 1, name: 'Inactive Low', category: 'test', stock: 2, status: 'inactive' });
    const lowStock = productRepo.findLowStock(5);
    expect(lowStock).toHaveLength(1);
    expect(lowStock[0].name).toBe('Low Stock');
  });

  test('should update product stock', () => {
    productRepo.create({ shop_id: 1, name: 'Widget', stock: 100 });
    productRepo.update(1, { stock: 50 });
    const product = productRepo.findById(1);
    expect(product!.stock).toBe(50);
  });

  test('should delete a product', () => {
    productRepo.create({ shop_id: 1, name: 'Widget' });
    productRepo.delete(1);
    expect(productRepo.findById(1)).toBeUndefined();
  });
});

describe('OrderRepository', () => {
  beforeEach(() => {
    userRepo.create({ username: 'shopowner', password: 'pass123' });
    shopRepo.create({ user_id: 1, shop_name: 'My Shop', domain: 'myshop.myshopify.com', access_token: 'test-token' });
  });

  test('should create an order', () => {
    const result = orderRepo.create({ shop_id: 1, order_number: 'ORD-001', customer_name: 'John', total_amount: 99.99, status: 'pending' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find orders by shop id', () => {
    orderRepo.create({ shop_id: 1, order_number: 'ORD-001' });
    orderRepo.create({ shop_id: 1, order_number: 'ORD-002' });
    const orders = orderRepo.findByShopId(1);
    expect(orders).toHaveLength(2);
  });

  test('should find orders by status', () => {
    orderRepo.create({ shop_id: 1, order_number: 'ORD-001', status: 'pending' });
    orderRepo.create({ shop_id: 1, order_number: 'ORD-002', status: 'shipped' });
    const pending = orderRepo.findByStatus('pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].order_number).toBe('ORD-001');
  });

  test('should find abnormal orders', () => {
    orderRepo.create({ shop_id: 1, order_number: 'ORD-001', status: 'abnormal' });
    orderRepo.create({ shop_id: 1, order_number: 'ORD-002', status: 'failed' });
    orderRepo.create({ shop_id: 1, order_number: 'ORD-003', status: 'pending' });
    const abnormal = orderRepo.findAbnormal();
    expect(abnormal).toHaveLength(2);
  });

  test('should update order status', () => {
    orderRepo.create({ shop_id: 1, order_number: 'ORD-001', status: 'pending' });
    orderRepo.update(1, { status: 'shipped' });
    const order = orderRepo.findById(1);
    expect(order!.status).toBe('shipped');
  });

  test('should delete an order', () => {
    orderRepo.create({ shop_id: 1, order_number: 'ORD-001' });
    orderRepo.delete(1);
    expect(orderRepo.findById(1)).toBeUndefined();
  });
});

describe('TaskLogRepository', () => {
  test('should create a task log', () => {
    const result = taskLogRepo.create({ agent_type: 'listing', task_name: 'generate_description', status: 'pending', input: '{"product": "Widget"}' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find task logs by agent type', () => {
    taskLogRepo.create({ agent_type: 'listing', task_name: 'task1' });
    taskLogRepo.create({ agent_type: 'logistics', task_name: 'task2' });
    const logs = taskLogRepo.findByAgentType('listing');
    expect(logs).toHaveLength(1);
  });

  test('should find task logs by status', () => {
    taskLogRepo.create({ agent_type: 'listing', task_name: 'task1', status: 'pending' });
    taskLogRepo.create({ agent_type: 'listing', task_name: 'task2', status: 'completed' });
    const pending = taskLogRepo.findByStatus('pending');
    expect(pending).toHaveLength(1);
  });

  test('should update task log status', () => {
    taskLogRepo.create({ agent_type: 'listing', task_name: 'task1', status: 'pending' });
    taskLogRepo.updateStatus(1, 'completed', 'Done successfully');
    const log = taskLogRepo.findById(1);
    expect(log!.status).toBe('completed');
    expect(log!.output).toBe('Done successfully');
  });

  test('should update task log status with error', () => {
    taskLogRepo.create({ agent_type: 'listing', task_name: 'task1', status: 'pending' });
    taskLogRepo.updateStatus(1, 'failed', undefined, 'Something went wrong');
    const log = taskLogRepo.findById(1);
    expect(log!.status).toBe('failed');
    expect(log!.error).toBe('Something went wrong');
  });

  test('should delete a task log', () => {
    taskLogRepo.create({ agent_type: 'listing', task_name: 'task1' });
    taskLogRepo.delete(1);
    expect(taskLogRepo.findById(1)).toBeUndefined();
  });
});

describe('KnowledgeBaseRepository', () => {
  test('should create a knowledge base entry', () => {
    const result = kbRepo.create({ agent_type: 'listing', question: 'How to optimize title?', answer: 'Use keywords in the first 50 chars' });
    expect(result.lastInsertRowid).toBe(1);
  });

  test('should find entries by agent type', () => {
    kbRepo.create({ agent_type: 'listing', question: 'Q1', answer: 'A1' });
    kbRepo.create({ agent_type: 'logistics', question: 'Q2', answer: 'A2' });
    const entries = kbRepo.findByAgentType('listing');
    expect(entries).toHaveLength(1);
  });

  test('should search by question keyword', () => {
    kbRepo.create({ agent_type: 'listing', question: 'How to optimize title?', answer: 'A1' });
    kbRepo.create({ agent_type: 'listing', question: 'Best pricing strategy?', answer: 'A2' });
    const results = kbRepo.searchByQuestion('listing', 'optimize');
    expect(results).toHaveLength(1);
    expect(results[0].question).toContain('optimize');
  });

  test('should find entries by language', () => {
    kbRepo.create({ agent_type: 'listing', question: 'Q1', answer: 'A1', language: 'zh' });
    kbRepo.create({ agent_type: 'listing', question: 'Q2', answer: 'A2', language: 'en' });
    const zhEntries = kbRepo.findByLanguage('zh');
    expect(zhEntries).toHaveLength(1);
  });

  test('should update a knowledge base entry', () => {
    kbRepo.create({ agent_type: 'listing', question: 'Q1', answer: 'Old answer' });
    kbRepo.update(1, { answer: 'New answer' });
    const entry = kbRepo.findById(1);
    expect(entry!.answer).toBe('New answer');
  });

  test('should delete a knowledge base entry', () => {
    kbRepo.create({ agent_type: 'listing', question: 'Q1', answer: 'A1' });
    kbRepo.delete(1);
    expect(kbRepo.findById(1)).toBeUndefined();
  });
});
