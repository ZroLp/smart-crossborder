import { NextRequest } from 'next/server'

const mockFindAll = jest.fn()
const mockFindById = jest.fn()
const mockUpdateRole = jest.fn()
const mockFindByShopId = jest.fn()

jest.mock('@/lib/db/init', () => ({
  getDb: jest.fn(() => ({})),
}))

jest.mock('@/lib/db/user-repository', () => {
  return {
    UserRepository: jest.fn().mockImplementation(() => ({
      findAll: mockFindAll,
      findById: mockFindById,
      updateRole: mockUpdateRole,
    })),
  }
})

jest.mock('@/lib/db/shop-repository', () => {
  return {
    ShopRepository: jest.fn().mockImplementation(() => ({
      findAll: mockFindAll,
    })),
  }
})

jest.mock('@/lib/db/order-repository', () => {
  return {
    OrderRepository: jest.fn().mockImplementation(() => ({
      findByShopId: mockFindByShopId,
    })),
  }
})

jest.mock('@/lib/db/product-repository', () => {
  return {
    ProductRepository: jest.fn().mockImplementation(() => ({
      findAll: mockFindAll,
    })),
  }
})

import { GET as getUsers, POST as updateUserRole } from '@/app/api/admin/users/route'
import { GET as getShops } from '@/app/api/admin/shops/route'
import { GET as getStats } from '@/app/api/admin/stats/route'

const mockUsers = [
  { id: 1, username: 'alice', email: 'alice@test.com', password: 'hashed', role: 'admin', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, username: 'bob', email: 'bob@test.com', password: 'hashed', role: 'viewer', created_at: '2024-01-02', updated_at: '2024-01-02' },
  { id: 3, username: 'charlie', email: 'charlie@test.com', password: 'hashed', role: 'admin', created_at: '2024-01-03', updated_at: '2024-01-03' },
]

const mockShops = [
  { id: 1, user_id: 1, shop_name: 'Shop A', domain: 'shopa.com', access_token: 'tok1', scope: '', status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, user_id: 2, shop_name: 'Shop B', domain: 'shopb.com', access_token: 'tok2', scope: '', status: 'active', created_at: '2024-01-02', updated_at: '2024-01-02' },
]

const mockOrders = [
  { id: 1, shop_id: 1, order_number: 'ORD001', customer_name: 'C1', total_amount: 100, status: 'completed', shipping_region: 'CN', shipping_weight: 1, logistics_channel: 'sf', created_at: '2024-01-01' },
  { id: 2, shop_id: 1, order_number: 'ORD002', customer_name: 'C2', total_amount: 200, status: 'pending', shipping_region: 'CN', shipping_weight: 2, logistics_channel: 'sf', created_at: '2024-01-02' },
]

beforeEach(() => {
  jest.clearAllMocks()
})

function createGetRequest(url: string): NextRequest {
  return new NextRequest(url)
}

function createPostRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Admin Users API', () => {
  test('GET /api/admin/users returns paginated user list', async () => {
    mockFindAll.mockReturnValue(mockUsers)

    const request = createGetRequest('http://localhost/api/admin/users?page=1&limit=20')
    const response = await getUsers(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.users).toHaveLength(3)
    expect(data.users[0]).toEqual({
      id: 1,
      username: 'alice',
      email: 'alice@test.com',
      role: 'admin',
      created_at: '2024-01-01',
    })
    expect(data.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 })
  })

  test('GET /api/admin/users?role=admin filters by role', async () => {
    mockFindAll.mockReturnValue(mockUsers)

    const request = createGetRequest('http://localhost/api/admin/users?role=admin')
    const response = await getUsers(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.users).toHaveLength(2)
    expect(data.users.every((u: any) => u.role === 'admin')).toBe(true)
    expect(data.pagination.total).toBe(2)
  })

  test('POST /api/admin/users updates user role', async () => {
    mockFindById.mockReturnValue(mockUsers[1])
    mockUpdateRole.mockReturnValue(undefined)

    const request = createPostRequest({ userId: 2, role: 'admin' })
    const response = await updateUserRole(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.userId).toBe(2)
    expect(data.role).toBe('admin')
    expect(mockUpdateRole).toHaveBeenCalledWith(2, 'admin')
  })

  test('POST /api/admin/users returns 400 when missing parameters', async () => {
    const request = createPostRequest({ userId: 1 })
    const response = await updateUserRole(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Missing userId or role')
  })

  test('POST /api/admin/users returns 400 for invalid role', async () => {
    const request = createPostRequest({ userId: 1, role: 'superadmin' })
    const response = await updateUserRole(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('Invalid role')
  })

  test('POST /api/admin/users returns 404 when user not found', async () => {
    mockFindById.mockReturnValue(undefined)

    const request = createPostRequest({ userId: 999, role: 'admin' })
    const response = await updateUserRole(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.error).toBe('User not found')
  })
})

describe('Admin Shops API', () => {
  test('GET /api/admin/shops returns shop list', async () => {
    mockFindAll.mockReturnValue(mockShops)

    const request = createGetRequest('http://localhost/api/admin/shops')
    const response = await getShops(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.shops).toHaveLength(2)
    expect(data.pagination.total).toBe(2)
    expect(data.shops[0].shop_name).toBe('Shop A')
  })
})

describe('Admin Stats API', () => {
  test('GET /api/admin/stats returns aggregated statistics', async () => {
    mockFindAll.mockImplementation(() => {
      return mockUsers
    })
    mockFindByShopId.mockReturnValue(mockOrders)

    const response = await getStats()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.stats.totalUsers).toBe(3)
    expect(data.stats.totalOrders).toBeGreaterThanOrEqual(0)
    expect(typeof data.stats.totalGMV).toBe('number')
  })

  test('GET /api/admin/stats handles empty data', async () => {
    mockFindAll.mockReturnValue([])
    mockFindByShopId.mockReturnValue([])

    const response = await getStats()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.stats.totalUsers).toBe(0)
    expect(data.stats.totalShops).toBe(0)
    expect(data.stats.totalOrders).toBe(0)
    expect(data.stats.totalGMV).toBe(0)
  })
})
