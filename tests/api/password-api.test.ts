const mockFindById = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/db/init', () => ({
  getDb: jest.fn(() => ({})),
}))

jest.mock('@/lib/db/user-repository', () => ({
  UserRepository: jest.fn().mockImplementation(() => ({
    findById: mockFindById,
    update: mockUpdate,
  })),
}))

jest.mock('@/lib/auth/password-hash', () => ({
  hashPassword: jest.fn((pw: string) => `hashed_${pw}`),
  verifyPasswordHash: jest.fn((pw: string, hash: string) => hash === `hashed_${pw}`),
}))

import { POST } from '@/app/api/auth/password/route'
import { NextRequest } from 'next/server'

beforeEach(() => {
  jest.clearAllMocks()
})

function createPostRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Password API', () => {
  test('returns 400 when missing required fields', async () => {
    const request = createPostRequest({ userId: 1 })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Missing required fields')
  })

  test('returns 404 when user not found', async () => {
    mockFindById.mockReturnValue(undefined)

    const request = createPostRequest({ userId: 999, currentPassword: 'old', newPassword: 'new' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.error).toBe('User not found')
  })

  test('returns 400 when current password is incorrect', async () => {
    mockFindById.mockReturnValue({ id: 1, password: 'hashed_correct' })

    const request = createPostRequest({ userId: 1, currentPassword: 'wrong', newPassword: 'new' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Current password is incorrect')
  })

  test('returns success when password is updated', async () => {
    mockFindById.mockReturnValue({ id: 1, password: 'hashed_correct' })

    const request = createPostRequest({ userId: 1, currentPassword: 'correct', newPassword: 'newpass' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(1, { password: 'hashed_newpass' })
  })
})
