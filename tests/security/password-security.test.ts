/**
 * P0-B-05 账号安全独立验收测试（qa-verifier）
 *
 * 该文件不依赖任何实现方的测试断言，独立验证：
 * - scrypt 哈希格式、随机盐唯一性、timingSafeEqual 使用；
 * - 旧 SHA-256 哈希兼容且仅升级不回退登录结果；
 * - 明文哈希、损坏格式的拒绝行为；
 * - 密码策略 7 / 8 / 128 / 129 边界；
 * - 登录限流第 6 次返回 429，成功登录后计数清零；
 * - 改密接口不接受明文存储的密码。
 *
 * 说明：better-sqlite3 原生 binding 未构建时，本文件不加载真实 DB
 * （全部通过 jest.mock 隔离），因此不受该环境问题影响。
 */
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

const mockVerifyPassword = jest.fn()
const mockFindByUsername = jest.fn()
const mockGetRole = jest.fn()
const mockCreate = jest.fn()
const mockFindById = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/db/init', () => ({
  getDb: jest.fn(() => ({})),
}))

jest.mock('@/lib/db/user-repository', () => ({
  UserRepository: jest.fn().mockImplementation(() => ({
    verifyPassword: mockVerifyPassword,
    findByUsername: mockFindByUsername,
    getRole: mockGetRole,
    create: mockCreate,
    findById: mockFindById,
    update: mockUpdate,
  })),
}))

// P0-C-02：登录/改密接口改为会话身份；本验收文件不连真实 DB，用固定会话隔离。
jest.mock('@/lib/auth/session', () => ({
  SESSION_COOKIE_NAME: 'sumaitong_session',
  getSessionUser: jest.fn(() => ({ id: 1, username: 'alice', email: null, role: 'viewer' })),
  getSessionToken: jest.fn(() => 'test-token'),
  createSession: jest.fn(() => 'test-token'),
  setSessionCookie: jest.fn(),
  clearSessionCookie: jest.fn(),
  destroyCurrentSession: jest.fn(),
  destroyOtherSessionsForUser: jest.fn(),
}))

import {
  hashPassword,
  isLegacyHash,
  isScryptHash,
  needsRehash,
  parseScryptHash,
  verifyPasswordHash,
} from '@/lib/auth/password-hash'
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePasswordStrength,
} from '@/lib/auth/password-policy'
import {
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  resetLoginRateLimitForTests,
} from '@/lib/auth/login-rate-limit'
import { POST as loginRoute } from '@/app/api/auth/route'
import { POST as changePasswordRoute } from '@/app/api/auth/password/route'
import { NextRequest } from 'next/server'

const projectRoot = path.resolve(__dirname, '..', '..')
const passwordHashSource = readFileSync(
  path.join(projectRoot, 'lib', 'auth', 'password-hash.ts'),
  'utf8'
)
const userRepositorySource = readFileSync(
  path.join(projectRoot, 'lib', 'db', 'user-repository.ts'),
  'utf8'
)

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextExport = source.indexOf('\nexport ', start + 1)
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport)
}

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function login(username: string, password: string, ip: string) {
  const response = await loginRoute(
    jsonRequest('http://localhost/api/auth', { action: 'login', username, password }, { 'x-forwarded-for': ip })
  )
  return { response, data: await response.json() }
}

describe('[P0-B-05] scrypt 哈希与随机盐', () => {
  test('同密码多次哈希结果互不相同，盐唯一（10 次样本）', () => {
    const hashes = Array.from({ length: 10 }, () => hashPassword('SamePassword123'))
    const salts = hashes.map((hash) => hash.split('$')[4])

    expect(new Set(hashes).size).toBe(10)
    expect(new Set(salts).size).toBe(10)
    for (const salt of salts) {
      expect(salt).toMatch(/^[0-9a-f]{64}$/) // 32 字节随机盐
    }
  })

  test('哈希为 scrypt$N$r$p$salt$key 格式，且绝不再是裸 SHA-256', () => {
    const hash = hashPassword('FormatCheck123')
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{64}\$[0-9a-f]{128}$/)
    expect(hash).not.toMatch(/^[0-9a-f]{64}$/)
    expect(isScryptHash(hash)).toBe(true)
    expect(isLegacyHash(hash)).toBe(false)
    expect(needsRehash(hash)).toBe(false)

    const parsed = parseScryptHash(hash)
    expect(parsed).not.toBeNull()
    expect(parsed!.salt).toHaveLength(32)
    expect(parsed!.key).toHaveLength(64)
  })

  test('正确密码通过、错误密码拒绝（含 Unicode）', () => {
    const hash = hashPassword('密码测试🔐abc')
    expect(verifyPasswordHash('密码测试🔐abc', hash)).toBe(true)
    expect(verifyPasswordHash('密码测试🔐abd', hash)).toBe(false)
  })

  test('实现静态约束：hashPassword 不含 SHA-256 生成，校验使用 timingSafeEqual', () => {
    const hashBody = functionBody(passwordHashSource, 'hashPassword')
    expect(hashBody).toContain('randomBytes')
    expect(hashBody).toContain('deriveKey')
    expect(hashBody).not.toContain('sha256')
    expect(hashBody).not.toContain('createHash')
    // 密钥派生确实是 scrypt
    expect(passwordHashSource).toContain('scryptSync')

    // createHash 仅允许出现在旧格式兼容校验分支中（import + 1 处调用）
    expect((passwordHashSource.match(/createHash\(/g) ?? []).length).toBe(1)
    expect(passwordHashSource).toContain('timingSafeEqual')
    expect(passwordHashSource).toMatch(/safeEqual/)
  })
})

describe('[P0-B-05] 旧 SHA-256 兼容与静默升级', () => {
  test('旧 SHA-256 哈希仍可验证，错误密码被拒', () => {
    const legacy = sha256Hex('LegacyPass123')
    expect(isLegacyHash(legacy)).toBe(true)
    expect(verifyPasswordHash('LegacyPass123', legacy)).toBe(true)
    expect(verifyPasswordHash('WrongPass123', legacy)).toBe(false)
  })

  test('旧哈希被标记需要升级，升级后的 scrypt 哈希仍可验证同一密码', () => {
    const legacy = sha256Hex('LegacyPass123')
    expect(needsRehash(legacy)).toBe(true)
    expect(isLegacyHash(legacy)).toBe(true)

    // 模拟仓库在登录成功后升级：仅替换哈希，密码本身不变
    const upgraded = hashPassword('LegacyPass123')
    expect(needsRehash(upgraded)).toBe(false)
    expect(verifyPasswordHash('LegacyPass123', upgraded)).toBe(true)
  })

  test('登录失败不会触发升级：校验为纯函数且升级位于成功分支之后', () => {
    const legacy = sha256Hex('LegacyPass123')
    expect(verifyPasswordHash('WrongPass123', legacy)).toBe(false)
    // 失败校验不改变哈希状态（纯函数，无副作用）
    expect(legacy).toBe(sha256Hex('LegacyPass123'))
    expect(needsRehash(legacy)).toBe(true)

    // 源码顺序：先 verifyPasswordHash，后 needsRehash + update，且 update 包在 try/catch
    const methodStart = userRepositorySource.indexOf('verifyPassword(username')
    expect(methodStart).toBeGreaterThanOrEqual(0)
    const methodBody = userRepositorySource.slice(methodStart)
    const verifyIndex = methodBody.indexOf('verifyPasswordHash')
    const rehashIndex = methodBody.indexOf('needsRehash')
    const updateIndex = methodBody.indexOf('this.update')
    expect(verifyIndex).toBeGreaterThanOrEqual(0)
    expect(verifyIndex).toBeLessThan(rehashIndex)
    expect(rehashIndex).toBeLessThan(updateIndex)
    expect(methodBody).toMatch(/try\s*\{[\s\S]*?this\.update[\s\S]*?\}\s*catch/)
  })

  test('user-repository 中不存在明文等值放行分支', () => {
    expect(userRepositorySource).not.toMatch(/password\s*===\s*password/)
    expect(userRepositorySource).not.toMatch(/user\.password\s*===\s*(password|.*Password)/)
    expect(userRepositorySource).toContain('verifyPasswordHash')
    expect(userRepositorySource).toContain('hashPassword')
  })
})

describe('[P0-B-05] 明文与损坏格式拒绝', () => {
  test('数据库字段等于明文密码时返回 false', () => {
    expect(verifyPasswordHash('plaintextPassword', 'plaintextPassword')).toBe(false)
    expect(verifyPasswordHash('12345678', '12345678')).toBe(false)
    expect(verifyPasswordHash('', '')).toBe(false)
  })

  test('明文值被标记需要升级且不是旧哈希', () => {
    expect(isLegacyHash('plaintextPassword')).toBe(false)
    expect(isScryptHash('plaintextPassword')).toBe(false)
    expect(needsRehash('plaintextPassword')).toBe(true)
  })

  test('损坏/异常格式一律返回 false 且不抛异常', () => {
    const malformed = [
      '',
      'scrypt',
      'scrypt$',
      'scrypt$bad',
      'scrypt$16384$8$1$zz$zz',
      'scrypt$16384$8$1$$',
      'scrypt$16384$8$1$00$00',
      'scrypt$0$8$1$00$00',
      'scrypt$16384$8$1$abc$def', // 奇数长度 hex
      'scrypt$16384$8$1$00$00$extra',
      'not-a-hash',
    ]
    for (const hash of malformed) {
      expect(() => verifyPasswordHash('anything', hash)).not.toThrow()
      expect(verifyPasswordHash('anything', hash)).toBe(false)
    }
    expect(verifyPasswordHash('x', null as unknown as string)).toBe(false)
    expect(verifyPasswordHash('x', undefined as unknown as string)).toBe(false)
    expect(verifyPasswordHash(null as unknown as string, 'x')).toBe(false)
  })
})

describe('[P0-B-05] 密码策略边界（7 / 8 / 128 / 129）', () => {
  test('策略常量与边界一致', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(MAX_PASSWORD_LENGTH).toBe(128)
  })

  test('7 位拒绝、8 位通过', () => {
    expect(validatePasswordStrength('1234567').valid).toBe(false)
    expect(validatePasswordStrength('12345678').valid).toBe(true)
  })

  test('128 位通过、129 位拒绝', () => {
    expect(validatePasswordStrength('a'.repeat(128)).valid).toBe(true)
    expect(validatePasswordStrength('a'.repeat(129)).valid).toBe(false)
  })

  test('空值、纯空白、非字符串拒绝', () => {
    expect(validatePasswordStrength('').valid).toBe(false)
    expect(validatePasswordStrength('        ').valid).toBe(false)
    expect(validatePasswordStrength(undefined).valid).toBe(false)
    expect(validatePasswordStrength(null).valid).toBe(false)
    expect(validatePasswordStrength(12345678).valid).toBe(false)
  })
})

describe('[P0-B-05] 登录限流（第 6 次 429）与成功清零', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetLoginRateLimitForTests()
    mockGetRole.mockReturnValue('viewer')
    mockFindByUsername.mockReturnValue({ id: 1, username: 'alice', role: 'viewer' })
    mockVerifyPassword.mockReturnValue(false)
  })

  test('连续 5 次失败后第 6 次返回 429 RATE_LIMITED 与 Retry-After', async () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) {
      const { response, data } = await login('alice', 'wrongPass123', '9.9.9.9')
      expect(response.status).not.toBe(429)
      expect(data.code).toBe('INVALID_CREDENTIALS')
    }

    const { response, data } = await login('alice', 'wrongPass123', '9.9.9.9')
    expect(response.status).toBe(429)
    expect(data.success).toBe(false)
    expect(data.code).toBe('RATE_LIMITED')
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
  })

  test('成功登录后失败计数清零，可再次连续失败 4 次而不被限流', async () => {
    for (let i = 0; i < 4; i++) {
      await login('clear-user', 'wrongPass123', '8.8.8.8')
    }
    mockVerifyPassword.mockReturnValue(true)
    const success = await login('clear-user', 'correctPass123', '8.8.8.8')
    expect(success.response.status).toBe(200)
    expect(success.data.success).toBe(true)

    mockVerifyPassword.mockReturnValue(false)
    for (let i = 0; i < 4; i++) {
      const { response } = await login('clear-user', 'wrongPass123', '8.8.8.8')
      expect(response.status).not.toBe(429)
    }
  })
})

describe('[P0-B-05] 改密接口不接受明文存储的密码', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetLoginRateLimitForTests()
  })

  test('DB 中存明文时，用相同明文作为当前密码返回 400 INVALID_CREDENTIALS', async () => {
    mockFindById.mockReturnValue({ id: 1, username: 'alice', password: 'plaintextPassword' })
    const response = await changePasswordRoute(
      jsonRequest('http://localhost/api/auth/password', {
        userId: 1,
        currentPassword: 'plaintextPassword',
        newPassword: 'brandNewPass123',
      })
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.code).toBe('INVALID_CREDENTIALS')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('旧 SHA-256 当前密码可改密，落库的是 scrypt 新哈希', async () => {
    mockFindById.mockReturnValue({ id: 1, username: 'alice', password: sha256Hex('legacyPass123') })
    const response = await changePasswordRoute(
      jsonRequest('http://localhost/api/auth/password', {
        userId: 1,
        currentPassword: 'legacyPass123',
        newPassword: 'brandNewPass123',
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const stored = (mockUpdate.mock.calls[0][1] as { password: string }).password
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(verifyPasswordHash('brandNewPass123', stored)).toBe(true)
  })
})
