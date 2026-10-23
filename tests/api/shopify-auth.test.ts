import { initDatabase } from '@/lib/db/init';
import { ShopRepository } from '@/lib/db/shop-repository';
import { generateState, validateState } from '@/lib/shopify/oauth-state';

let db: ReturnType<typeof initDatabase>;
let shopRepo: ShopRepository;

function seedUsers() {
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('user1', 'pass1');
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('user2', 'pass2');
}

beforeAll(() => {
  db = initDatabase(':memory:');
  shopRepo = new ShopRepository(db);
  seedUsers();
});

afterAll(() => {
  db.close();
});

beforeEach(() => {
  db.exec('DELETE FROM shops');
});

describe('OAuth State', () => {
  it('generates and validates state within TTL', () => {
    const state = generateState(1, db);
    expect(typeof state).toBe('string');
    expect(state.length).toBe(32);

    const result = validateState(state, db);
    expect(result).toEqual({ userId: 1 });
  });

  it('invalidates state after first use', () => {
    const state = generateState(1, db);
    validateState(state, db);

    const result = validateState(state, db);
    expect(result).toBeNull();
  });

  it('rejects unknown state', () => {
    const result = validateState('unknown-state', db);
    expect(result).toBeNull();
  });

  it('supports different user IDs', () => {
    const state1 = generateState(1, db);
    const state2 = generateState(2, db);

    expect(validateState(state1, db)).toEqual({ userId: 1 });
    expect(validateState(state2, db)).toEqual({ userId: 2 });
  });
});

describe('ShopRepository', () => {
  it('creates and retrieves shop by userId', () => {
    shopRepo.create({
      user_id: 1,
      shop_name: 'test-store',
      domain: 'test-store.myshopify.com',
      access_token: 'shpat_test_token_123',
      scope: 'read_products,write_products',
      status: 'active',
    });

    const shops = shopRepo.findByUserId(1);
    expect(shops).toHaveLength(1);
    expect(shops[0].shop_name).toBe('test-store');
    expect(shops[0].domain).toBe('test-store.myshopify.com');
    expect(shops[0].access_token).toBe('shpat_test_token_123');
  });

  it('retrieves shop by domain', () => {
    shopRepo.create({
      user_id: 1,
      shop_name: 'my-shop',
      domain: 'my-shop.myshopify.com',
      access_token: 'shpat_abc',
      scope: 'read_products',
      status: 'active',
    });

    const shop = shopRepo.findByDomain('my-shop.myshopify.com');
    expect(shop).toBeDefined();
    expect(shop!.shop_name).toBe('my-shop');
  });

  it('retrieves shop by userId and domain', () => {
    shopRepo.create({
      user_id: 1,
      shop_name: 'shop-a',
      domain: 'shop-a.myshopify.com',
      access_token: 'token_a',
      scope: '',
      status: 'active',
    });

    shopRepo.create({
      user_id: 1,
      shop_name: 'shop-b',
      domain: 'shop-b.myshopify.com',
      access_token: 'token_b',
      scope: '',
      status: 'active',
    });

    const result = shopRepo.findByUserIdAndDomain(1, 'shop-b.myshopify.com');
    expect(result).toBeDefined();
    expect(result!.shop_name).toBe('shop-b');
  });

  it('supports multi-shop binding for same user', () => {
    shopRepo.create({
      user_id: 1,
      shop_name: 'shop-1',
      domain: 'shop-1.myshopify.com',
      access_token: 'token_1',
      scope: 'read_products',
      status: 'active',
    });

    shopRepo.create({
      user_id: 1,
      shop_name: 'shop-2',
      domain: 'shop-2.myshopify.com',
      access_token: 'token_2',
      scope: 'read_orders',
      status: 'active',
    });

    const shops = shopRepo.findByUserId(1);
    expect(shops).toHaveLength(2);
  });

  it('isolates shops by userId', () => {
    shopRepo.create({
      user_id: 1,
      shop_name: 'user1-shop',
      domain: 'user1.myshopify.com',
      access_token: 'token_1',
      scope: '',
      status: 'active',
    });

    shopRepo.create({
      user_id: 2,
      shop_name: 'user2-shop',
      domain: 'user2.myshopify.com',
      access_token: 'token_2',
      scope: '',
      status: 'active',
    });

    expect(shopRepo.findByUserId(1)).toHaveLength(1);
    expect(shopRepo.findByUserId(2)).toHaveLength(1);
    expect(shopRepo.findByUserId(999)).toHaveLength(0);
  });

  it('deletes shop by id', () => {
    const result = shopRepo.create({
      user_id: 1,
      shop_name: 'delete-me',
      domain: 'delete-me.myshopify.com',
      access_token: 'token_del',
      scope: '',
      status: 'active',
    });

    const shopId = result.lastInsertRowid as number;
    shopRepo.delete(shopId);

    const shop = shopRepo.findById(shopId);
    expect(shop).toBeUndefined();
  });

  it('updates shop access token', () => {
    shopRepo.create({
      user_id: 1,
      shop_name: 'update-shop',
      domain: 'update-shop.myshopify.com',
      access_token: 'old_token',
      scope: 'old_scope',
      status: 'active',
    });

    const shop = shopRepo.findByDomain('update-shop.myshopify.com');
    expect(shop).toBeDefined();

    shopRepo.update(shop!.id, {
      access_token: 'new_token',
      scope: 'new_scope',
      status: 'active',
    });

    const updated = shopRepo.findById(shop!.id);
    expect(updated!.access_token).toBe('new_token');
    expect(updated!.scope).toBe('new_scope');
  });
});

describe('Shop API route - DELETE', () => {
  it('deletes shop and removes from database', () => {
    shopRepo.create({
      user_id: 1,
      shop_name: 'unbind-test',
      domain: 'unbind-test.myshopify.com',
      access_token: 'token_ub',
      scope: '',
      status: 'active',
    });

    const shop = shopRepo.findByDomain('unbind-test.myshopify.com');
    expect(shop).toBeDefined();

    shopRepo.delete(shop!.id);

    const deleted = shopRepo.findByDomain('unbind-test.myshopify.com');
    expect(deleted).toBeUndefined();
    expect(shopRepo.findByUserId(1)).toHaveLength(0);
  });
});

describe('Auth failure scenarios', () => {
  it('returns undefined for non-existent domain', () => {
    const shop = shopRepo.findByDomain('non-existent.myshopify.com');
    expect(shop).toBeUndefined();
  });

  it('returns empty array for non-existent userId', () => {
    const shops = shopRepo.findByUserId(99999);
    expect(shops).toHaveLength(0);
  });

  it('returns null for invalid state', () => {
    const result = validateState('completely-invalid-state-value', db);
    expect(result).toBeNull();
  });
});
