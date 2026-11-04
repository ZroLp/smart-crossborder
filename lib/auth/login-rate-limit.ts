export const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000
export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5

export interface RateLimitResult {
  allowed: boolean
  /** Seconds the caller should wait before retrying; 0 when allowed. */
  retryAfter: number
  /** Failed attempts still allowed in the current window. */
  remaining: number
}

interface FailureRecord {
  failures: number
  firstFailureAt: number
  blockedUntil: number | null
}

/**
 * Process-local (single instance) login throttling state.
 * Keyed by `username.toLowerCase()|clientIp`.
 */
const failures = new Map<string, FailureRecord>()

function allowed(remaining: number = LOGIN_RATE_LIMIT_MAX_FAILURES): RateLimitResult {
  return { allowed: true, retryAfter: 0, remaining }
}

function resultFrom(record: FailureRecord, now: number): RateLimitResult {
  if (record.blockedUntil !== null) {
    if (now < record.blockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((record.blockedUntil - now) / 1000)),
        remaining: 0,
      }
    }
    return allowed()
  }

  if (now - record.firstFailureAt >= LOGIN_RATE_LIMIT_WINDOW_MS) return allowed()

  return allowed(Math.max(0, LOGIN_RATE_LIMIT_MAX_FAILURES - record.failures))
}

/** Check whether this key is currently allowed to attempt a login. */
export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now()
  const record = failures.get(key)

  if (!record) return allowed()

  if (record.blockedUntil !== null && now >= record.blockedUntil) {
    failures.delete(key)
    return allowed()
  }

  if (record.blockedUntil === null && now - record.firstFailureAt >= LOGIN_RATE_LIMIT_WINDOW_MS) {
    failures.delete(key)
    return allowed()
  }

  return resultFrom(record, now)
}

/** Record one failed login attempt and return the resulting status. */
export function recordLoginFailure(key: string): RateLimitResult {
  const now = Date.now()
  let record = failures.get(key)

  const expiredWindow =
    record !== undefined &&
    record.blockedUntil === null &&
    now - record.firstFailureAt >= LOGIN_RATE_LIMIT_WINDOW_MS
  const expiredBlock = record !== undefined && record.blockedUntil !== null && now >= record.blockedUntil

  if (!record || expiredWindow || expiredBlock) {
    record = { failures: 0, firstFailureAt: now, blockedUntil: null }
    failures.set(key, record)
  }

  record.failures += 1

  if (record.failures >= LOGIN_RATE_LIMIT_MAX_FAILURES) {
    record.blockedUntil = now + LOGIN_RATE_LIMIT_WINDOW_MS
  }

  return resultFrom(record, now)
}

/** Clear failures for one key (called after a successful login). */
export function clearLoginFailures(key: string): void {
  failures.delete(key)
}

/** Reset all in-memory state; test helper only. */
export function resetLoginRateLimitForTests(): void {
  failures.clear()
}

export interface RequestWithHeaders {
  headers: { get(name: string): string | null }
}

/** Resolve the client IP from common proxy headers. */
export function getClientIp(request: RequestWithHeaders): string {
  const forwarded = request?.headers?.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = request?.headers?.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

/** Build the throttle key: `username.toLowerCase()|clientIp`. */
export function getClientKey(request: RequestWithHeaders, username: string): string {
  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : ''
  return `${normalizedUsername}|${getClientIp(request)}`
}

// Short aliases for callers/tests that prefer the terse names.
export {
  checkLoginRateLimit as check,
  recordLoginFailure as record,
  clearLoginFailures as clear,
  resetLoginRateLimitForTests as resetForTests,
}
