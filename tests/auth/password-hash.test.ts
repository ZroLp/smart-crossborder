import { createHash } from 'crypto'
import {
  hashPassword,
  isLegacyHash,
  isScryptHash,
  needsRehash,
  parseScryptHash,
  verifyPasswordHash,
} from '@/lib/auth/password-hash'

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

describe('password-hash', () => {
  describe('scrypt format', () => {
    test('produces the documented scrypt$N$r$p$salt$key format', () => {
      const hash = hashPassword('mySecurePass123')
      expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{64}\$[0-9a-f]{128}$/)

      const parsed = parseScryptHash(hash)
      expect(parsed).not.toBeNull()
      expect(parsed!.N).toBe(16384)
      expect(parsed!.r).toBe(8)
      expect(parsed!.p).toBe(1)
      expect(parsed!.salt).toHaveLength(32)
      expect(parsed!.key).toHaveLength(64)
    })

    test('uses a fresh random salt on every call', () => {
      const first = hashPassword('samePassword1')
      const second = hashPassword('samePassword1')
      expect(first).not.toBe(second)
      expect(first.split('$')[4]).not.toBe(second.split('$')[4])
    })

    test('verifies the correct password', () => {
      const hash = hashPassword('correctPassword')
      expect(verifyPasswordHash('correctPassword', hash)).toBe(true)
    })

    test('rejects a wrong password', () => {
      const hash = hashPassword('correctPassword')
      expect(verifyPasswordHash('wrongPassword', hash)).toBe(false)
    })

    test('handles unicode passwords', () => {
      const hash = hashPassword('密码测试🔐abc')
      expect(verifyPasswordHash('密码测试🔐abc', hash)).toBe(true)
    })

    test('a current scrypt hash does not need a rehash', () => {
      const hash = hashPassword('stablePassword')
      expect(isScryptHash(hash)).toBe(true)
      expect(isLegacyHash(hash)).toBe(false)
      expect(needsRehash(hash)).toBe(false)
    })

    test('outdated scrypt parameters need a rehash', () => {
      const hash = hashPassword('stablePassword')
      const outdated = hash.replace('$16384$8$1$', '$32768$8$1$')
      expect(parseScryptHash(outdated)).not.toBeNull()
      expect(needsRehash(outdated)).toBe(true)
    })
  })

  describe('legacy SHA-256 compatibility', () => {
    test('verifies a legacy unsalted SHA-256 hash', () => {
      const legacy = sha256Hex('legacyPass123')
      expect(isLegacyHash(legacy)).toBe(true)
      expect(isScryptHash(legacy)).toBe(false)
      expect(verifyPasswordHash('legacyPass123', legacy)).toBe(true)
      expect(verifyPasswordHash('wrong', legacy)).toBe(false)
    })

    test('flags legacy hashes for rehash on next login', () => {
      const legacy = sha256Hex('legacyPass123')
      expect(needsRehash(legacy)).toBe(true)
    })

    test('legacy hex matching is case-insensitive', () => {
      const legacy = sha256Hex('legacyPass123').toUpperCase()
      expect(verifyPasswordHash('legacyPass123', legacy)).toBe(true)
    })
  })

  describe('malformed and plaintext values', () => {
    test('rejects plaintext stored passwords', () => {
      expect(verifyPasswordHash('plaintextPassword', 'plaintextPassword')).toBe(false)
      expect(isLegacyHash('plaintextPassword')).toBe(false)
      expect(needsRehash('plaintextPassword')).toBe(true)
    })

    test('returns false instead of throwing on malformed scrypt values', () => {
      expect(verifyPasswordHash('x', 'scrypt$bad')).toBe(false)
      expect(verifyPasswordHash('x', 'scrypt$16384$8$1$zz$zz')).toBe(false)
      expect(verifyPasswordHash('x', 'scrypt$16384$8$1$$')).toBe(false)
      expect(verifyPasswordHash('x', '')).toBe(false)
      expect(verifyPasswordHash('x', 'scrypt$0$8$1$00$00')).toBe(false)
    })
  })

  // The repository integration tests need better-sqlite3's native binding.
  // When the dependency tree was installed without build scripts (some sandboxes),
  // skip them instead of failing the whole suite; they run wherever the DB works.
  const sqliteAvailable = (() => {
    try {
      const Database = require('better-sqlite3')
      const probe = new Database(':memory:')
      probe.close()
      return true
    } catch {
      return false
    }
  })()
  const describeWithDb = sqliteAvailable ? describe : describe.skip

  describeWithDb('UserRepository integration', () => {
    test('upgrades a legacy SHA-256 row on first successful login', () => {
      const { initDatabase } = require('@/lib/db/init') as typeof import('@/lib/db/init')
      const { UserRepository } = require('@/lib/db/user-repository') as typeof import('@/lib/db/user-repository')
      const db = initDatabase(':memory:')
      try {
        const repo = new UserRepository(db)
        repo.create({ username: 'legacy-user', password: sha256Hex('legacyPass123') })
        expect(repo.findByUsername('legacy-user')!.password).toHaveLength(64)

        expect(repo.verifyPassword('legacy-user', 'legacyPass123')).toBe(true)

        const upgraded = repo.findByUsername('legacy-user')!.password
        expect(upgraded.startsWith('scrypt$')).toBe(true)
        expect(verifyPasswordHash('legacyPass123', upgraded)).toBe(true)
        // The upgraded hash still authenticates on subsequent logins.
        expect(repo.verifyPassword('legacy-user', 'legacyPass123')).toBe(true)
      } finally {
        db.close()
      }
    })

    test('rejects a stored plaintext password', () => {
      const { initDatabase } = require('@/lib/db/init') as typeof import('@/lib/db/init')
      const { UserRepository } = require('@/lib/db/user-repository') as typeof import('@/lib/db/user-repository')
      const db = initDatabase(':memory:')
      try {
        const repo = new UserRepository(db)
        repo.create({ username: 'plaintext-user', password: 'plaintextPassword' })
        expect(repo.verifyPassword('plaintext-user', 'plaintextPassword')).toBe(false)
      } finally {
        db.close()
      }
    })
  })
})
