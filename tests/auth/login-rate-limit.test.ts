import {
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  check,
  clear,
  getClientIp,
  getClientKey,
  record,
  resetForTests,
} from '@/lib/auth/login-rate-limit'

function requestWithHeaders(headers: Record<string, string>): { headers: { get(name: string): string | null } } {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  }
}

describe('login-rate-limit', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    resetForTests()
  })

  afterEach(() => {
    resetForTests()
    jest.useRealTimers()
  })

  test('allows the first check and exposes the remaining attempts', () => {
    const status = check('alice|1.1.1.1')
    expect(status.allowed).toBe(true)
    expect(status.retryAfter).toBe(0)
    expect(status.remaining).toBe(LOGIN_RATE_LIMIT_MAX_FAILURES)
  })

  test('allows attempts below the threshold', () => {
    const key = 'alice|1.1.1.1'
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES - 1; i++) {
      const status = record(key)
      expect(status.allowed).toBe(true)
    }
    expect(check(key).allowed).toBe(true)
    expect(check(key).remaining).toBe(1)
  })

  test('blocks the sixth attempt with a retryAfter after five failures', () => {
    const key = 'alice|1.1.1.1'
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES - 1; i++) {
      expect(record(key).allowed).toBe(true)
    }
    // The fifth failure engages the lock; the request itself is still
    // answered with INVALID_CREDENTIALS by the route.
    expect(record(key).allowed).toBe(false)

    const blocked = check(key)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
    expect(blocked.remaining).toBe(0)
  })

  test('unblocks after the window elapses', () => {
    const key = 'alice|1.1.1.1'
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) record(key)
    expect(check(key).allowed).toBe(false)

    jest.advanceTimersByTime(LOGIN_RATE_LIMIT_WINDOW_MS + 1000)
    expect(check(key).allowed).toBe(true)
  })

  test('clear removes the failure state after a successful login', () => {
    const key = 'alice|1.1.1.1'
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) record(key)
    expect(check(key).allowed).toBe(false)

    clear(key)
    expect(check(key).allowed).toBe(true)
  })

  test('isolates usernames and client IPs', () => {
    const key = getClientKey(requestWithHeaders({ 'x-forwarded-for': '1.1.1.1' }), 'Alice')
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) record(key)
    expect(check(key).allowed).toBe(false)

    expect(check('bob|1.1.1.1').allowed).toBe(true)
    expect(check('alice|2.2.2.2').allowed).toBe(true)
  })

  test('getClientKey normalizes the username and uses the first forwarded IP', () => {
    const request = requestWithHeaders({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })
    expect(getClientIp(request)).toBe('9.9.9.9')
    expect(getClientKey(request, '  Alice  ')).toBe('alice|9.9.9.9')
  })

  test('getClientKey falls back to x-real-ip and then unknown', () => {
    expect(getClientKey(requestWithHeaders({ 'x-real-ip': '3.3.3.3' }), 'bob')).toBe('bob|3.3.3.3')
    expect(getClientKey(requestWithHeaders({}), 'bob')).toBe('bob|unknown')
  })
})
