import type Database from 'better-sqlite3'
import { initDatabase } from '@/lib/db/init'
import { UserRepository } from '@/lib/db/user-repository'
import { ShopRepository } from '@/lib/db/shop-repository'
import { ProductRepository } from '@/lib/db/product-repository'
import { OrderRepository } from '@/lib/db/order-repository'
import {
  AgentInputError,
  EMPTY_ORDER_LIBRARY,
  EMPTY_PRODUCT_LIBRARY,
  adaptAgentInput,
} from '@/lib/agents/input-adapter'

let db: Database.Database
let withDataUserId: number
let emptyUserId: number
let shopId: number
let productIds: number[]

beforeEach(() => {
  db = initDatabase(':memory:')
  const users = new UserRepository(db)
  withDataUserId = Number(users.create({ username: 'alice', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)
  emptyUserId = Number(users.create({ username: 'bob', password: 'x', email: null, role: 'viewer' }).lastInsertRowid)

  const shopRepo = new ShopRepository(db)
  shopId = Number(
    shopRepo.create({
      user_id: withDataUserId,
      shop_name: 'demo',
      domain: 'demo.myshopify.com',
      access_token: 'tok',
      scope: '',
      status: 'active',
    }).lastInsertRowid
  )

  const productRepo = new ProductRepository(db)
  productIds = []
  for (const product of [
    { name: 'Storage Box', category: 'home', price: 39.9, cost: 12.5, sales: 120 },
    { name: 'Wireless Mouse', category: 'electronics', price: 29.9, cost: 9.9, sales: 800 },
    { name: 'Pet Brush', category: 'pet', price: 19.9, cost: 5, sales: 300 },
    { name: 'Desk Lamp', category: 'home', price: 49.9, cost: 18, sales: 50 },
  ]) {
    productIds.push(
      Number(
        productRepo.create({
          shop_id: shopId,
          name: product.name,
          category: product.category,
          price: product.price,
          cost: product.cost,
          sales: product.sales,
          stock: 10,
          status: 'active',
        }).lastInsertRowid
      )
    )
  }

  const orderRepo = new OrderRepository(db)
  orderRepo.create({
    shop_id: shopId,
    order_number: 'ORD-OLD',
    customer_name: 'Old',
    total_amount: 10,
    status: 'completed',
    shipping_region: 'EU',
    shipping_weight: 1,
    logistics_channel: 'x',
  })
  orderRepo.create({
    shop_id: shopId,
    order_number: 'ORD-LATEST',
    customer_name: 'New',
    total_amount: 29.9,
    status: 'pending',
    shipping_region: 'US',
    shipping_weight: 2,
    logistics_channel: 'x',
  })
})

afterEach(() => {
  db.close()
})

describe('input-adapter: selection', () => {
  test('adapts page payload {category,region,keyword} from the user product library', () => {
    const { input, adapted } = adaptAgentInput(
      'selection',
      { category: 'home', region: 'sea', keyword: 'storage' },
      withDataUserId,
      db
    )

    expect(adapted).toBe('selection:product-library')
    const products = input.products as Array<Record<string, unknown>>
    expect(products).toHaveLength(1)
    expect(products[0].name).toBe('Storage Box')
    expect(products[0].region).toBe('SEA')
    expect(products[0].cost).toBe(12.5)
  })

  test('falls back to the whole library when filters match nothing', () => {
    const { input } = adaptAgentInput(
      'selection',
      { category: 'not-a-category', keyword: 'zzz' },
      withDataUserId,
      db
    )
    expect((input.products as unknown[]).length).toBe(4)
  })

  test('throws EMPTY_PRODUCT_LIBRARY with an actionable hint for empty libraries', () => {
    expect(() =>
      adaptAgentInput('selection', { category: 'home' }, emptyUserId, db)
    ).toThrow(AgentInputError)

    try {
      adaptAgentInput('selection', { category: 'home' }, emptyUserId, db)
    } catch (error) {
      const adapterError = error as AgentInputError
      expect(adapterError.code).toBe(EMPTY_PRODUCT_LIBRARY)
      expect(adapterError.message).toContain('商品库为空')
      expect(adapterError.hint).toContain('商品')
      expect(adapterError.hint).toContain('重试')
    }
  })

  test('passes native {products:[...]} through unchanged', () => {
    const native = { products: [{ name: 'X', category: 'home', price: 1, cost: 0.5, sales: 1 }] }
    const result = adaptAgentInput('selection', native, emptyUserId, db)
    expect(result.adapted).toBeNull()
    expect(result.input).toBe(native)
  })
})

describe('input-adapter: store-builder', () => {
  test('adapts {action:create} to the top three products by sales', () => {
    const { input, adapted } = adaptAgentInput(
      'store-builder',
      { action: 'create', templateId: 'tpl-001' },
      withDataUserId,
      db
    )

    expect(adapted).toBe('store-builder:top-products')
    const selected = input.selectedProducts as Array<Record<string, unknown>>
    expect(selected).toHaveLength(3)
    expect(selected.map((product) => product.name)).toEqual([
      'Wireless Mouse',
      'Pet Brush',
      'Storage Box',
    ])
    expect(input.templateId).toBe('tpl-001')
  })

  test('throws EMPTY_PRODUCT_LIBRARY when the user has no products', () => {
    expect(() =>
      adaptAgentInput('store-builder', { action: 'create' }, emptyUserId, db)
    ).toThrow(/商品库为空/)
  })
})

describe('input-adapter: content', () => {
  test('adapts {language,productId} to the requested product', () => {
    const { input, adapted } = adaptAgentInput(
      'content',
      { language: 'en', productId: String(productIds[3]) },
      withDataUserId,
      db
    )

    expect(adapted).toBe('content:product-by-id')
    const products = input.products as Array<Record<string, unknown>>
    expect(products).toHaveLength(1)
    expect(products[0].name).toBe('Desk Lamp')
    expect(input.language).toBe('en')
  })

  test('falls back to top1 by sales when productId is unknown', () => {
    const { input } = adaptAgentInput(
      'content',
      { language: 'en', productId: '99999' },
      withDataUserId,
      db
    )
    expect((input.products as Array<Record<string, unknown>>)[0].name).toBe('Wireless Mouse')
  })

  test('throws EMPTY_PRODUCT_LIBRARY for empty libraries', () => {
    expect(() =>
      adaptAgentInput('content', { language: 'en', productId: '1' }, emptyUserId, db)
    ).toThrow(/商品库为空/)
  })
})

describe('input-adapter: fulfillment', () => {
  test('adapts {action:sync} to the latest order', () => {
    const { input, adapted } = adaptAgentInput(
      'fulfillment',
      { action: 'sync' },
      withDataUserId,
      db
    )

    expect(adapted).toBe('fulfillment:latest-order')
    const order = input.order as Record<string, unknown>
    expect(order.orderNumber).toBe('ORD-LATEST')
    expect(order.totalAmount).toBe(29.9)
  })

  test('throws EMPTY_ORDER_LIBRARY with a hint for empty order libraries', () => {
    try {
      adaptAgentInput('fulfillment', { action: 'sync' }, emptyUserId, db)
      throw new Error('should have thrown')
    } catch (error) {
      const adapterError = error as AgentInputError
      expect(adapterError.code).toBe(EMPTY_ORDER_LIBRARY)
      expect(adapterError.message).toContain('订单库为空')
      expect(adapterError.hint).toContain('订单')
    }
  })

  test('passes a native {order:{...}} through unchanged', () => {
    const native = { order: { orderNumber: 'X', shippingRegion: 'US', shippingWeight: 1 } }
    const result = adaptAgentInput('fulfillment', native, emptyUserId, db)
    expect(result.adapted).toBeNull()
    expect(result.input).toBe(native)
  })
})

describe('input-adapter: passthrough agents', () => {
  test('ad-optimizer and customer-service payloads are unchanged', () => {
    const adInput = { adData: { campaigns: [] } }
    const csInput = { message: '你好', conversationHistory: [] }

    expect(adaptAgentInput('ad-optimizer', adInput, emptyUserId, db)).toEqual({
      input: adInput,
      adapted: null,
    })
    expect(adaptAgentInput('customer-service', csInput, emptyUserId, db)).toEqual({
      input: csInput,
      adapted: null,
    })
  })

  test('does not invent products/orders: empty DB stays empty', () => {
    expect(() =>
      adaptAgentInput('selection', { category: 'home' }, emptyUserId, db)
    ).toThrow(AgentInputError)
    expect(new ProductRepository(db).count()).toBe(4)
    expect(new OrderRepository(db).count()).toBe(2)
  })
})
