import { getRedis } from '@/lib/infra/redis'

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

// ---------------------------------------------------------------------------
// Redis 后端（多实例部署共享限流状态）
//
// 状态存于 `sumaitong:login-limit:<key>`（JSON: {f 失败数, t 首败时间,
// b 锁定截止时间}），TTL 取 2 倍窗口保证跨实例语义一致；无 REDIS_URL 或
// Redis 故障时自动降级为进程内版本（可用性优先，语义不变）。
// ---------------------------------------------------------------------------

const REDIS_PREFIX = 'sumaitong:login-limit:'
const REDIS_TTL_SECONDS = Math.ceil((2 * LOGIN_RATE_LIMIT_WINDOW_MS) / 1000)

interface RedisRateLimitRecord {
  f: number
  t: number
  b: number | null
}

async function redisRecordFor(key: string): Promise<RedisRateLimitRecord | null> {
  const redis = getRedis()
  if (!redis) throw new Error('redis-unavailable')
  const raw = await redis.get(`${REDIS_PREFIX}${key}`)
  if (!raw) return null
  const record = JSON.parse(raw) as RedisRateLimitRecord
  const now = Date.now()
  // 与内存版一致：锁定已过或窗口滑出即视为无记录（TTL 会兜底清 key）。
  if ((record.b !== null && record.b <= now) || now - record.t >= LOGIN_RATE_LIMIT_WINDOW_MS) {
    await redis.del(`${REDIS_PREFIX}${key}`)
    return null
  }
  return record
}

/** Redis 紧凑记录 → FailureRecord（复用内存版的判定逻辑）。 */
function asFailureRecord(record: RedisRateLimitRecord): FailureRecord {
  return {
    failures: record.f,
    firstFailureAt: record.t,
    blockedUntil: record.b,
  }
}

/** 多实例部署：Redis 后端限流检查（无 Redis 时降级内存版）。 */
export async function checkLoginRateLimitAsync(key: string): Promise<RateLimitResult> {
  try {
    const record = await redisRecordFor(key)
    if (!record) return allowed()
    return resultFrom(asFailureRecord(record), Date.now())
  } catch (error) {
    if ((error as Error).message !== 'redis-unavailable') {
      console.warn('[login-rate-limit] Redis check failed, falling back to in-memory:', error)
    }
    return check(key)
  }
}

/** 多实例部署：Redis 后端记录一次登录失败（无 Redis 时降级内存版）。 */
export async function recordLoginFailureAsync(key: string): Promise<RateLimitResult> {
  try {
    const record =
      (await redisRecordFor(key)) ?? { f: 0, t: Date.now(), b: null }
    record.f += 1
    if (record.f >= LOGIN_RATE_LIMIT_MAX_FAILURES) record.b = Date.now() + LOGIN_RATE_LIMIT_WINDOW_MS
    const redis = getRedis()!
    await redis.set(`${REDIS_PREFIX}${key}`, JSON.stringify(record), 'EX', REDIS_TTL_SECONDS)
    return resultFrom(asFailureRecord(record), Date.now())
  } catch (error) {
    if ((error as Error).message !== 'redis-unavailable') {
      console.warn('[login-rate-limit] Redis record failed, falling back to in-memory:', error)
    }
    return record(key)
  }
}

/** 多实例部署：登录成功后清除 Redis 失败计数（无 Redis 时降级内存版）。 */
export async function clearLoginFailuresAsync(key: string): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) throw new Error('redis-unavailable')
    await redis.del(`${REDIS_PREFIX}${key}`)
  } catch (error) {
    if ((error as Error).message !== 'redis-unavailable') {
      console.warn('[login-rate-limit] Redis clear failed, falling back to in-memory:', error)
    }
    clear(key)
  }
}

export {
  checkLoginRateLimitAsync as checkAsync,
  recordLoginFailureAsync as recordAsync,
  clearLoginFailuresAsync as clearAsync,
}
