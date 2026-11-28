import { initDatabase } from '@/lib/db/init'
import { DbClient } from '@/lib/db/client'
import { seedDemoData } from '@/lib/db/seed'
import { OrderRepository } from '@/lib/db/order-repository'
import { OrderItemRepository, TrackingEventRepository } from '@/lib/db/order-detail-repository'

let db: DbClient

beforeEach(async () => {
  db = initDatabase(':memory:')
  await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('alice', 'x')
  await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('bob', 'x')
})

afterEach(async () => {
  await db.close()
})

describe('[P3-01] 订单明细/物流轨迹', () => {
  test('seed 为每个 demo 订单补齐行项目与轨迹，且明细之和等于订单总额', async () => {
    await seedDemoData(db)

    const orders = await db.query('SELECT id, total_amount FROM orders ORDER BY id')
    expect(orders.rows).toHaveLength(6)

    for (const row of orders.rows) {
      const items = await new OrderItemRepository(db).listByOrder(row.id as number)
      expect(items).toHaveLength(2)
      const sum = items.reduce((acc, item) => acc + (item.subtotal ?? 0), 0)
      expect(Math.abs(sum - Number(row.total_amount))).toBeLessThanOrEqual(0.01)
      for (const item of items) {
        expect(item.name).toBeTruthy()
        expect(item.quantity).toBe(1)
      }
      const tracking = await new TrackingEventRepository(db).listByOrder(row.id as number)
      expect(tracking.length).toBeGreaterThan(0)
      // 轨迹按时间倒序
      for (let i = 1; i < tracking.length; i++) {
        expect(tracking[i - 1].occurred_at >= tracking[i].occurred_at).toBe(true)
      }
    }
  })

  test('seed 幂等：二次执行不产生重复明细/轨迹', async () => {
    await seedDemoData(db)
    const itemsBefore = (await db.prepare('SELECT COUNT(*) c FROM order_items').get()) as { c: number }
    const trackingBefore = (await db.prepare('SELECT COUNT(*) c FROM tracking_events').get()) as { c: number }

    await seedDemoData(db)

    const itemsAfter = (await db.prepare('SELECT COUNT(*) c FROM order_items').get()) as { c: number }
    const trackingAfter = (await db.prepare('SELECT COUNT(*) c FROM tracking_events').get()) as { c: number }
    expect(itemsAfter.c).toBe(itemsBefore.c)
    expect(trackingAfter.c).toBe(trackingBefore.c)
    expect(itemsAfter.c).toBeGreaterThan(0)
  })

  test('listByOrderIds 批量取回（订单列表页一次查询，避免 N+1）', async () => {
    await seedDemoData(db)
    const ids = (await db.query('SELECT id FROM orders')).rows as Array<{ id: number }>
    const items = await new OrderItemRepository(db).listByOrderIds(ids.map((row) => row.id))
    expect(items).toHaveLength(ids.length * 2)
    expect(new OrderItemRepository(db).listByOrderIds([])).resolves.toEqual([])
  })
})

describe('[P3-02] 订单聚合与性能', () => {
  test('summarizeForShops 单条 GROUP BY 返回状态分布与总额', async () => {
    await seedDemoData(db)
    const shop1 = (await db.prepare('SELECT id FROM shops WHERE user_id = 1').get()) as { id: number }
    const shop2 = (await db.prepare('SELECT id FROM shops WHERE user_id = 2').get()) as { id: number }

    const summaries = await new OrderRepository(db).summarizeForShops([shop1.id, shop2.id])
    expect(summaries).toHaveLength(2)

    const s1 = summaries.find((s) => s.shopId === shop1.id)
    expect(s1?.totalOrders).toBe(3)
    const breakdownValues = Object.values(s1!.statusBreakdown)
    expect(breakdownValues.reduce((a, b) => a + b, 0)).toBe(3)
    expect(s1!.statusBreakdown['completed']).toBe(1)
    expect(s1!.totalAmount).toBeGreaterThan(0)
  })

  test('1000 单样本：聚合查询 <200ms（DoD）', async () => {
    const orderRepo = new OrderRepository(db)
    await db.prepare(
      "INSERT INTO shops (user_id, shop_name, domain, access_token, status) VALUES (1, 'perf', 'p.myshopify.com', 't', 'active')"
    ).run()
    const shopRow = (await db.prepare('SELECT id FROM shops WHERE shop_name = ?').get('perf')) as { id: number }
    const shopId = shopRow.id

    const statuses = ['completed', 'pending', 'shipped', 'abnormal']
    await db.transaction(async () => {
      for (let i = 0; i < 1000; i++) {
        await orderRepo.create({
          shop_id: shopId,
          order_number: `PERF-${i}`,
          customer_name: `customer-${i}`,
          total_amount: 10 + (i % 90),
          status: statuses[i % statuses.length],
          shipping_region: 'US',
          shipping_weight: 1,
          logistics_channel: 'DHL',
        })
      }
    }).immediate()

    const startedAt = Date.now()
    const summaries = await orderRepo.summarizeForShops([shopId])
    const elapsed = Date.now() - startedAt

    expect(summaries).toHaveLength(1)
    expect(summaries[0].totalOrders).toBe(1000)
    expect(summaries[0].statusBreakdown).toEqual({ completed: 250, pending: 250, shipped: 250, abnormal: 250 })
    expect(elapsed).toBeLessThan(200)
  })
})
