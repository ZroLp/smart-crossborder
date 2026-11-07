import type Database from 'better-sqlite3'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { generateState } from '@/lib/shopify/oauth-state'
import { syncShopifyData } from '@/lib/shopify/sync'
import { ProductRepository } from '@/lib/db/product-repository'
import { OrderRepository } from '@/lib/db/order-repository'

let db: Database.Database
const originalFetch = global.fetch

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

function installFetchMock(): jest.Mock {
  const mockFetch = jest.fn((url: string) => {
    if (url.includes('/admin/oauth/access_token')) {
      return Promise.resolve(jsonResponse({ access_token: 'shpat_test', scope: 'read_products,read_orders' }))
    }
    if (url.includes('/shop.json')) {
      return Promise.resolve(jsonResponse({ shop: { id: 1, name: 'Demo' } }))
    }
    if (url.includes('/products.json')) {
      return Promise.resolve(
        jsonResponse({
          products: [
            {
              id: 11,
              title: 'Shopify Mug',
              product_type: 'home',
              status: 'active',
              variants: [{ price: '19.90', inventory_quantity: 42 }],
            },
            {
              id: 12,
              title: 'Shopify Tee',
              product_type: 'fashion',
              status: 'active',
              variants: [{ price: '29.50', inventory_quantity: 7 }],
            },
          ],
        })
      )
    }
    if (url.includes('/orders.json')) {
      return Promise.resolve(
        jsonResponse({
          orders: [
            {
              id: 101,
              name: '#1001',
              total_price: '49.90',
              financial_status: 'paid',
              shipping_address: { name: 'Jane Doe', country_code: 'US' },
            },
            {
              id: 102,
              name: '#1002',
              total_price: '19.90',
              financial_status: 'pending',
              shipping_address: { name: 'John Roe', country_code: 'DE' },
            },
          ],
        })
      )
    }
    return Promise.resolve(jsonResponse({}, false, 404))
  })
  global.fetch = mockFetch as unknown as typeof fetch
  return mockFetch
}

beforeEach(() => {
  db = initDatabase(':memory:')
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('alice', 'x')
  process.env.SHOPIFY_API_KEY = 'test-key'
  process.env.SHOPIFY_API_SECRET = 'test-secret'
})

afterEach(() => {
  db.close()
  global.fetch = originalFetch
  delete process.env.SHOPIFY_API_KEY
  delete process.env.SHOPIFY_API_SECRET
})

describe('shopify sync', () => {
  test('imports shop info, products and orders', async () => {
    const created = db
      .prepare(
        'INSERT INTO shops (user_id, shop_name, domain, access_token, scope, status) VALUES (1, ?, ?, ?, ?, ?)'
      )
      .run('demo', 'demo.myshopify.com', 'token', '', 'active')
    const shopId = Number(created.lastInsertRowid)

    installFetchMock()
    const result = await syncShopifyData('demo.myshopify.com', 'token', shopId, db)

    expect(result.errors).toEqual([])
    expect(result.shopSynced).toBe(true)
    expect(result.products).toBe(2)
    expect(result.orders).toBe(2)
    expect(new ProductRepository(db).findByShopId(shopId)).toHaveLength(2)
    expect(new OrderRepository(db).findByShopId(shopId)).toHaveLength(2)
  })

  test('deduplicates repeat syncs', async () => {
    const created = db
      .prepare(
        'INSERT INTO shops (user_id, shop_name, domain, access_token, scope, status) VALUES (1, ?, ?, ?, ?, ?)'
      )
      .run('demo', 'demo.myshopify.com', 'token', '', 'active')
    const shopId = Number(created.lastInsertRowid)

    installFetchMock()
    await syncShopifyData('demo.myshopify.com', 'token', shopId, db)
    const second = await syncShopifyData('demo.myshopify.com', 'token', shopId, db)

    expect(second.products).toBe(0)
    expect(second.orders).toBe(0)
    expect(new ProductRepository(db).findByShopId(shopId)).toHaveLength(2)
  })

  test('collects errors instead of throwing when Shopify fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network down'))) as unknown as typeof fetch

    const result = await syncShopifyData('demo.myshopify.com', 'token', 1, db)
    expect(result.errors).toHaveLength(3)
    expect(result.products).toBe(0)
  })
})

describe('shopify OAuth callback', () => {
  test('authorizes, creates the shop and syncs data', async () => {
    installFetchMock()
    const state = generateState(1, db)

    const { GET } = await import('@/app/api/auth/shopify/callback/route')
    const request = new NextRequest(
      `http://localhost/api/auth/shopify/callback?code=code-1&shop=demo.myshopify.com&state=${state}`
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.shop).toBe('demo.myshopify.com')

    const shop = db
      .prepare('SELECT * FROM shops WHERE domain = ?')
      .get('demo.myshopify.com') as { id: number }
    expect(shop).toBeTruthy()
    expect(new ProductRepository(db).findByShopId(shop.id)).toHaveLength(2)
    expect(new OrderRepository(db).findByShopId(shop.id)).toHaveLength(2)
  })

  test('still succeeds when the data pull fails', async () => {
    const tokenResponse = { ok: true, status: 200, json: async () => ({ access_token: 'tok', scope: '' }) }
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/oauth/access_token')) return Promise.resolve(tokenResponse as Response)
      return Promise.reject(new Error('sync offline'))
    }) as unknown as typeof fetch

    const state = generateState(1, db)
    const { GET } = await import('@/app/api/auth/shopify/callback/route')
    const request = new NextRequest(
      `http://localhost/api/auth/shopify/callback?code=code-2&shop=demo2.myshopify.com&state=${state}`
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
