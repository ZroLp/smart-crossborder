import { initDatabase } from '@/lib/db/init'
import { DbClient } from '@/lib/db/client'
import { seedDemoData } from '@/lib/db/seed'
import { ProductRepository } from '@/lib/db/product-repository'
import { OrderRepository } from '@/lib/db/order-repository'
import { ShopRepository } from '@/lib/db/shop-repository'

let db: DbClient

beforeEach(async () => {
  db = initDatabase(':memory:')
  await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('alice', 'x')
  await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('bob', 'x')
})

afterEach(async () => {
  await db.close()
})

describe('seedDemoData', () => {
  test('creates one shop, three products and three orders per user', async () => {
    const result = await seedDemoData(db)

    expect(result.seeded).toBe(true)
    expect(result.shops).toBe(2)
    expect(result.products).toBe(6)
    expect(result.orders).toBe(6)
    expect(result.compliance).toBe(48)
    expect(result.adCampaigns).toBe(6)
    expect(result.adSuggestions).toBe(6)

    const shopRepo = new ShopRepository(db)
    expect(await shopRepo.findByUserId(1)).toHaveLength(1)
    expect(await shopRepo.findByUserId(2)).toHaveLength(1)
    expect(await new ProductRepository(db).count()).toBe(6)
    expect(await new OrderRepository(db).count()).toBe(6)
    expect((await db.prepare('SELECT COUNT(*) c FROM compliance_items').get()) as { c: number }).toEqual({ c: 48 })
    expect((await db.prepare('SELECT COUNT(*) c FROM ad_campaigns').get()) as { c: number }).toEqual({ c: 6 })
    expect((await db.prepare('SELECT COUNT(*) c FROM ad_suggestions').get()) as { c: number }).toEqual({ c: 6 })
  })

  test('seeds compliance groups per user (5 policy / 4 tax / 5 check / 5 risk / 5 suggestion)', async () => {
    await seedDemoData(db)

    for (const kind of ['policy', 'tax', 'check', 'risk', 'suggestion']) {
      const rows = (await db
        .prepare('SELECT COUNT(*) c FROM compliance_items WHERE user_id = 1 AND kind = ?')
        .get(kind)) as { c: number }
      const expected = kind === 'tax' ? 4 : 5
      expect(rows.c).toBe(expected)
    }

    const campaign = (await db.prepare('SELECT * FROM ad_campaigns WHERE user_id = 1 ORDER BY id LIMIT 1').get()) as {
      external_id: string
      audience_json: string
      creatives_json: string
    }
    expect(Object.keys(JSON.parse(campaign.audience_json)).length).toBeGreaterThan(0)
    expect(Array.isArray(JSON.parse(campaign.creatives_json))).toBe(true)
  })

  test('is idempotent and skips non-empty tables', async () => {
    await seedDemoData(db)
    const ordersBefore = (await db.prepare('SELECT COUNT(*) c FROM orders').get()) as { c: number }
    const second = await seedDemoData(db)

    expect(second.seeded).toBe(false)
    expect(second.products).toBe(0)
    expect(second.orders).toBe(0)
    expect(second.compliance).toBe(0)
    expect(second.adCampaigns).toBe(0)
    expect(second.adSuggestions).toBe(0)
    expect(await new ProductRepository(db).count()).toBe(6)
    expect(await new OrderRepository(db).count()).toBe(6)
    expect((await db.prepare('SELECT COUNT(*) c FROM compliance_items').get()) as { c: number }).toEqual({ c: 48 })
    expect((await db.prepare('SELECT COUNT(*) c FROM ad_campaigns').get()) as { c: number }).toEqual({ c: 6 })
    expect((await db.prepare('SELECT COUNT(*) c FROM orders').get()) as { c: number }).toEqual(ordersBefore)
  })

  test('compliance/ad rows can be seeded on a database that already has orders', async () => {
    // 模拟旧库：已有店铺与订单，但没有合规/投流数据
    await db.prepare(
      "INSERT INTO shops (user_id, shop_name, domain, access_token, scope, status) VALUES (1, 's', 's.myshopify.com', 't', '', 'active')"
    ).run()
    await new OrderRepository(db).create({
      shop_id: 1,
      order_number: 'EXISTING-1',
      customer_name: 'X',
      total_amount: 10,
      status: 'completed',
      shipping_region: 'US',
      shipping_weight: 1,
      logistics_channel: 'x',
    })

    const result = await seedDemoData(db)

    // catalog 整体跳过（不删除/不重复现有订单），但合规与投流仍按用户补齐
    expect(result.orders).toBe(0)
    expect(result.products).toBe(0)
    expect(result.compliance).toBe(48)
    expect(result.adCampaigns).toBe(6)
    expect(await new OrderRepository(db).count()).toBe(1)
  })

  test('reuses an existing shop instead of creating a duplicate', async () => {
    await new ShopRepository(db).create({
      user_id: 1,
      shop_name: 'existing',
      domain: 'existing.myshopify.com',
      access_token: 'tok',
      scope: '',
      status: 'active',
    })

    const result = await seedDemoData(db)
    expect(result.shops).toBe(1)
    expect(await new ShopRepository(db).findByUserId(1)).toHaveLength(1)
    expect(await new ProductRepository(db).findByShopId(1)).toHaveLength(3)
  })

  test('does nothing when there are no users', async () => {
    await db.prepare('DELETE FROM users').run()
    const result = await seedDemoData(db)
    expect(result.seeded).toBe(false)
  })
})
