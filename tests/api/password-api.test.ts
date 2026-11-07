const mockFindById = jest.fn()
const mockUpdate = jest.fn()
const mockGetSessionUser = jest.fn()

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

jest.mock('@/lib/auth/session', () => ({
  getSessionUser: (...args: unknown[]) => mockGetSessionUser(...args),
  getSessionToken: jest.fn(() => 'current-token'),
  destroyOtherSessionsForUser: jest.fn(),
}))

import { POST } from '@/app/api/auth/password/route'
import { NextRequest } from 'next/server'

const sessionUser = { id: 1, username: 'alice', email: null, role: 'viewer' }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSessionUser.mockReturnValue(sessionUser)
})

function createPostRequest(body: object, withCookie = true): NextRequest {
  return new NextRequest('http://localhost/api/auth/password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withCookie ? { cookie: 'sumaitong_session=test-token' } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('Password API (session identity)', () => {
  test('returns 401 for anonymous requests', async () => {
    mockGetSessionUser.mockReturnValue(null)
    const response = await POST(
      createPostRequest({ currentPassword: 'oldpass123', newPassword: 'newpass123' }, false)
    )
    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('UNAUTHORIZED')
  })

  test('returns 400 INVALID_INPUT when required fields are missing', async () => {
    const request = createPostRequest({ userId: 1 })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.code).toBe('INVALID_INPUT')
    expect(data.error).toBe('Missing required fields')
  })

  test('returns 400 WEAK_PASSWORD when the new password is too short', async () => {
    const request = createPostRequest({ userId: 1, currentPassword: 'oldpass123', newPassword: 'short' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.code).toBe('WEAK_PASSWORD')
    expect(mockFindById).not.toHaveBeenCalled()
  })

  test('returns 400 SAME_PASSWORD when the new password equals the current one', async () => {
    const request = createPostRequest({
      userId: 1,
      currentPassword: 'samepass123',
      newPassword: 'samepass123',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.code).toBe('SAME_PASSWORD')
  })

  test('returns 403 when body userId targets another user', async () => {
    const request = createPostRequest({
      userId: 2,
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('FORBIDDEN')
  })

  test('returns 404 USER_NOT_FOUND when the session user no longer exists', async () => {
    mockFindById.mockReturnValue(undefined)

    const request = createPostRequest({ userId: 1, currentPassword: 'oldpass123', newPassword: 'newpass123' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.code).toBe('USER_NOT_FOUND')
    expect(data.error).toBe('User not found')
  })

  test('returns 400 INVALID_CREDENTIALS when the current password is incorrect', async () => {
    mockFindById.mockReturnValue({ id: 1, password: 'hashed_correct' })

    const request = createPostRequest({ userId: 1, currentPassword: 'wrong', newPassword: 'newpass123' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.code).toBe('INVALID_CREDENTIALS')
    expect(data.error).toBe('Current password is incorrect')
  })

  test('hashes and stores the new password on success', async () => {
    mockFindById.mockReturnValue({ id: 1, password: 'hashed_correct' })

    const request = createPostRequest({ userId: 1, currentPassword: 'correct', newPassword: 'newpass123' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(1, { password: 'hashed_newpass123' })
  })
})
