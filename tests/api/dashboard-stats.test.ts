import { NextRequest } from 'next/server'

const mockCount = jest.fn()
const mockFindAll = jest.fn()

jest.mock('@/lib/db/init', () => ({
  getDb: jest.fn(() => ({})),
}))

jest.mock('@/lib/db/order-repository', () => ({
  OrderRepository: jest.fn().mockImplementation(() => ({
    count: mockCount,
    findAll: mockFindAll,
  })),
}))

jest.mock('@/lib/db/task-log-repository', () => ({
  TaskLogRepository: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
  })),
}))

jest.mock('@/lib/db/product-repository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({
    count: mockCount,
  })),
}))

import { GET } from '@/app/api/dashboard/stats/route'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Dashboard Stats API', () => {
  test('GET /api/dashboard/stats returns zero stats when no data', async () => {
    mockCount.mockReturnValue(0)

    const request = new NextRequest('http://localhost/api/dashboard/stats')
    const response = await GET(request)
    const data = await response.json()

    expect(data).toEqual({
      revenue: '0',
      orders: 0,
      roas: '0',
      csRate: '0',
      hasData: false,
    })
  })

  test('GET /api/dashboard/stats returns computed stats when data exists', async () => {
    let callIndex = 0
    mockCount.mockImplementation(() => {
      callIndex++
      if (callIndex === 1) return 2
      return 1
    })
    mockFindAll.mockImplementation((limit: number, offset: number) => {
      if (callIndex <= 2) {
        return [
          { id: 1, total_amount: 100 },
          { id: 2, total_amount: 200 },
        ]
      }
      return [
        { id: 1, status: 'success' },
        { id: 2, status: 'completed' },
        { id: 3, status: 'failed' },
      ]
    })

    const request = new NextRequest('http://localhost/api/dashboard/stats')
    const response = await GET(request)
    const data = await response.json()

    expect(data.hasData).toBe(true)
    expect(data.orders).toBe(2)
    expect(data.revenue).toBe('300.00')
    expect(typeof data.roas).toBe('string')
    expect(typeof data.csRate).toBe('string')
  })

  test('GET /api/dashboard/stats returns 500 on error', async () => {
    mockCount.mockImplementation(() => {
      throw new Error('DB connection failed')
    })

    const request = new NextRequest('http://localhost/api/dashboard/stats')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('DB connection failed')
  })
})
