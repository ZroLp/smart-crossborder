import Database from 'better-sqlite3'
import { initDatabase } from '@/lib/db/init'
import { seedDemoData } from '@/lib/db/seed'
import { ProductRepository } from '@/lib/db/product-repository'
import { OrderRepository } from '@/lib/db/order-repository'
import { ShopRepository } from '@/lib/db/shop-repository'

let db: Database.Database

beforeEach(() => {
  db = initDatabase(':memory:')
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('alice', 'x')
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('bob', 'x')
})

afterEach(() => {
  db.close()
})

describe('seedDemoData', () => {
  test('creates one shop, three products and three orders per user', () => {
    const result = seedDemoData(db)

    expect(result.seeded).toBe(true)
    expect(result.shops).toBe(2)
    expect(result.products).toBe(6)
    expect(result.orders).toBe(6)

    const shopRepo = new ShopRepository(db)
    expect(shopRepo.findByUserId(1)).toHaveLength(1)
    expect(shopRepo.findByUserId(2)).toHaveLength(1)
    expect(new ProductRepository(db).count()).toBe(6)
    expect(new OrderRepository(db).count()).toBe(6)
  })

  test('is idempotent and skips non-empty tables', () => {
    seedDemoData(db)
    const second = seedDemoData(db)

    expect(second.seeded).toBe(false)
    expect(second.products).toBe(0)
    expect(new ProductRepository(db).count()).toBe(6)
    expect(new OrderRepository(db).count()).toBe(6)
  })

  test('reuses an existing shop instead of creating a duplicate', () => {
    new ShopRepository(db).create({
      user_id: 1,
      shop_name: 'existing',
      domain: 'existing.myshopify.com',
      access_token: 'tok',
      scope: '',
      status: 'active',
    })

    const result = seedDemoData(db)
    expect(result.shops).toBe(1)
    expect(new ShopRepository(db).findByUserId(1)).toHaveLength(1)
    expect(new ProductRepository(db).findByShopId(1)).toHaveLength(3)
  })

  test('does nothing when there are no users', () => {
    db.prepare('DELETE FROM users').run()
    const result = seedDemoData(db)
    expect(result.seeded).toBe(false)
  })
})
