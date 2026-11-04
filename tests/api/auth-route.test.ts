const mockVerifyPassword = jest.fn()
const mockFindByUsername = jest.fn()
const mockGetRole = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/db/init', () => ({
  getDb: jest.fn(() => ({})),
}))

jest.mock('@/lib/db/user-repository', () => ({
  UserRepository: jest.fn().mockImplementation(() => ({
    verifyPassword: mockVerifyPassword,
    findByUsername: mockFindByUsername,
    getRole: mockGetRole,
    create: mockCreate,
  })),
}))

import { POST } from '@/app/api/auth/route'
import { resetLoginRateLimitForTests } from '@/lib/auth/login-rate-limit'
import { NextRequest } from 'next/server'

function createPostRequest(body: object, ip = '1.2.3.4'): NextRequest {
  return new NextRequest('http://localhost/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

async function login(username: string, password: string, ip = '1.2.3.4') {
  const response = await POST(createPostRequest({ action: 'login', username, password }, ip))
  return { response, data: await response.json() }
}

beforeEach(() => {
  jest.clearAllMocks()
  resetLoginRateLimitForTests()
  mockGetRole.mockReturnValue('viewer')
  mockFindByUsername.mockReturnValue({ id: 1, username: 'alice', role: 'viewer' })
})

describe('POST /api/auth', () => {
  test('returns INVALID_INPUT when fields are missing', async () => {
    const request = createPostRequest({ action: 'login', username: 'alice' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.code).toBe('INVALID_INPUT')
  })

  test('treats a non-JSON body as INVALID_INPUT', async () => {
    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_INPUT')
  })

  test('rejects a weak password on register', async () => {
    const register = await POST(
      createPostRequest({ action: 'register', username: 'newuser', password: 'short' })
    )
    const registerData = await register.json()

    expect(register.status).toBe(400)
    expect(registerData.success).toBe(false)
    expect(registerData.code).toBe('WEAK_PASSWORD')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('returns INVALID_CREDENTIALS for a wrong password', async () => {
    mockVerifyPassword.mockReturnValue(false)
    const { data } = await login('alice', 'wrongPass123')
    expect(data.success).toBe(false)
    expect(data.code).toBe('INVALID_CREDENTIALS')
  })

  test('returns 429 with Retry-After from the sixth attempt on', async () => {
    mockVerifyPassword.mockReturnValue(false)

    for (let i = 0; i < 5; i++) {
      const { response } = await login('alice', 'wrongPass123')
      expect(response.status).not.toBe(429)
    }

    const { response, data } = await login('alice', 'wrongPass123')
    expect(response.status).toBe(429)
    expect(data.success).toBe(false)
    expect(data.code).toBe('RATE_LIMITED')
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
  })

  test('a successful login clears the failure counter', async () => {
    mockVerifyPassword.mockReturnValue(false)
    for (let i = 0; i < 4; i++) await login('alice', 'wrongPass123')

    mockVerifyPassword.mockReturnValue(true)
    const success = await login('alice', 'correctPass123')
    expect(success.response.status).toBe(200)
    expect(success.data.success).toBe(true)
    expect(success.data.userId).toBe(1)
    expect(success.data.role).toBe('viewer')

    mockVerifyPassword.mockReturnValue(false)
    for (let i = 0; i < 4; i++) {
      const { response } = await login('alice', 'wrongPass123')
      expect(response.status).not.toBe(429)
    }
  })

  test('throttles independently per username and IP', async () => {
    mockVerifyPassword.mockReturnValue(false)
    for (let i = 0; i < 5; i++) await login('alice', 'wrongPass123', '5.5.5.5')

    const blocked = await login('alice', 'wrongPass123', '5.5.5.5')
    expect(blocked.response.status).toBe(429)

    const otherIp = await login('alice', 'wrongPass123', '6.6.6.6')
    expect(otherIp.response.status).not.toBe(429)
  })
})
