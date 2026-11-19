import { initDatabase } from '@/lib/db/init';
import { applyDbCompat } from '../helpers/db-compat';
import { ShopRepository } from '@/lib/db/shop-repository';
import { generateState, validateState } from '@/lib/shopify/oauth-state';

let db: ReturnType<typeof initDatabase>;
let shopRepo: ShopRepository;

async function seedUsers() {
  await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('user1', 'pass1');
  await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('user2', 'pass2');
}

beforeAll(async () => {
  db = applyDbCompat(initDatabase(':memory:'));
  shopRepo = new ShopRepository(db);
  await seedUsers();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec('DELETE FROM shops');
});

describe('OAuth State', () => {
  it('generates and validates state within TTL', async () => {
    const state = await generateState(1, db);
    expect(typeof state).toBe('string');
    expect(state.length).toBe(32);

    const result = await validateState(state, db);
    expect(result).toEqual({ userId: 1 });
  });

  it('invalidates state after first use', async () => {
    const state = await generateState(1, db);
    await validateState(state, db);

    const result = await validateState(state, db);
    expect(result).toBeNull();
  });

  it('rejects unknown state', async () => {
    const result = await validateState('unknown-state', db);
    expect(result).toBeNull();
  });

  it('supports different user IDs', async () => {
    const state1 = await generateState(1, db);
    const state2 = await generateState(2, db);

    expect(await validateState(state1, db)).toEqual({ userId: 1 });
    expect(await validateState(state2, db)).toEqual({ userId: 2 });
  });
});

describe('ShopRepository', () => {
  it('creates and retrieves shop by userId', async () => {
    await shopRepo.create({
      user_id: 1,
      shop_name: 'test-store',
      domain: 'test-store.myshopify.com',
      access_token: 'shpat_test_token_123',
      scope: 'read_products,write_products',
      status: 'active',
    });

    const shops = await shopRepo.findByUserId(1);
    expect(shops).toHaveLength(1);
    expect(shops[0].shop_name).toBe('test-store');
    expect(shops[0].domain).toBe('test-store.myshopify.com');
    expect(shops[0].access_token).toBe('shpat_test_token_123');
  });

  it('retrieves shop by domain', async () => {
    await shopRepo.create({
      user_id: 1,
      shop_name: 'my-shop',
      domain: 'my-shop.myshopify.com',
      access_token: 'shpat_abc',
      scope: 'read_products',
      status: 'active',
    });

    const shop = await shopRepo.findByDomain('my-shop.myshopify.com');
    expect(shop).toBeDefined();
    expect(shop!.shop_name).toBe('my-shop');
  });

  it('retrieves shop by userId and domain', async () => {
    await shopRepo.create({
      user_id: 1,
      shop_name: 'shop-a',
      domain: 'shop-a.myshopify.com',
      access_token: 'token_a',
      scope: '',
      status: 'active',
    });

    await shopRepo.create({
      user_id: 1,
      shop_name: 'shop-b',
      domain: 'shop-b.myshopify.com',
      access_token: 'token_b',
      scope: '',
      status: 'active',
    });

    const result = await shopRepo.findByUserIdAndDomain(1, 'shop-b.myshopify.com');
    expect(result).toBeDefined();
    expect(result!.shop_name).toBe('shop-b');
  });

  it('supports multi-shop binding for same user', async () => {
    await shopRepo.create({
      user_id: 1,
      shop_name: 'shop-1',
      domain: 'shop-1.myshopify.com',
      access_token: 'token_1',
      scope: 'read_products',
      status: 'active',
    });

    await shopRepo.create({
      user_id: 1,
      shop_name: 'shop-2',
      domain: 'shop-2.myshopify.com',
      access_token: 'token_2',
      scope: 'read_orders',
      status: 'active',
    });

    const shops = await shopRepo.findByUserId(1);
    expect(shops).toHaveLength(2);
  });

  it('isolates shops by userId', async () => {
    await shopRepo.create({
      user_id: 1,
      shop_name: 'user1-shop',
      domain: 'user1.myshopify.com',
      access_token: 'token_1',
      scope: '',
      status: 'active',
    });

    await shopRepo.create({
      user_id: 2,
      shop_name: 'user2-shop',
      domain: 'user2.myshopify.com',
      access_token: 'token_2',
      scope: '',
      status: 'active',
    });

    expect(await shopRepo.findByUserId(1)).toHaveLength(1);
    expect(await shopRepo.findByUserId(2)).toHaveLength(1);
    expect(await shopRepo.findByUserId(999)).toHaveLength(0);
  });

  it('deletes shop by id', async () => {
    const result = await shopRepo.create({
      user_id: 1,
      shop_name: 'delete-me',
      domain: 'delete-me.myshopify.com',
      access_token: 'token_del',
      scope: '',
      status: 'active',
    });

    const shopId = Number(result.lastInsertRowid);
    await shopRepo.delete(shopId);

    const shop = await shopRepo.findById(shopId);
    expect(shop).toBeUndefined();
  });

  it('updates shop access token', async () => {
    await shopRepo.create({
      user_id: 1,
      shop_name: 'update-shop',
      domain: 'update-shop.myshopify.com',
      access_token: 'old_token',
      scope: 'old_scope',
      status: 'active',
    });

    const shop = await shopRepo.findByDomain('update-shop.myshopify.com');
    expect(shop).toBeDefined();

    await shopRepo.update(shop!.id, {
      access_token: 'new_token',
      scope: 'new_scope',
      status: 'active',
    });

    const updated = await shopRepo.findById(shop!.id);
    expect(updated!.access_token).toBe('new_token');
    expect(updated!.scope).toBe('new_scope');
  });
});

describe('Shop API route - DELETE', () => {
  it('deletes shop and removes from database', async () => {
    await shopRepo.create({
      user_id: 1,
      shop_name: 'unbind-test',
      domain: 'unbind-test.myshopify.com',
      access_token: 'token_ub',
      scope: '',
      status: 'active',
    });

    const shop = await shopRepo.findByDomain('unbind-test.myshopify.com');
    expect(shop).toBeDefined();

    await shopRepo.delete(shop!.id);

    const deleted = await shopRepo.findByDomain('unbind-test.myshopify.com');
    expect(deleted).toBeUndefined();
    expect(await shopRepo.findByUserId(1)).toHaveLength(0);
  });
});

describe('Auth failure scenarios', () => {
  it('returns undefined for non-existent domain', async () => {
    const shop = await shopRepo.findByDomain('non-existent.myshopify.com');
    expect(shop).toBeUndefined();
  });

  it('returns empty array for non-existent userId', async () => {
    const shops = await shopRepo.findByUserId(99999);
    expect(shops).toHaveLength(0);
  });

  it('returns null for invalid state', async () => {
    const result = await validateState('completely-invalid-state-value', db);
    expect(result).toBeNull();
  });
});
