import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export const SCRYPT_N = 16384
export const SCRYPT_R = 8
export const SCRYPT_P = 1
export const SCRYPT_SALT_BYTES = 32
export const SCRYPT_KEY_BYTES = 64

const SCRYPT_PREFIX = 'scrypt'
// 128 * N * r bytes are required; the default maxmem (32 MiB) is close to the
// limit for N=16384, r=8, so request explicit headroom.
const SCRYPT_MAX_MEM = 64 * 1024 * 1024

const LEGACY_SHA256_PATTERN = /^[0-9a-f]{64}$/i
const HEX_PATTERN = /^[0-9a-f]+$/i

export interface ScryptHashParts {
  N: number
  r: number
  p: number
  salt: Buffer
  key: Buffer
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

/**
 * Parse a stored `scrypt$N$r$p$salthex$keyhex` hash.
 * Returns null for anything that is not a well-formed scrypt hash.
 */
export function parseScryptHash(hash: string): ScryptHashParts | null {
  if (typeof hash !== 'string') return null

  const parts = hash.split('$')
  if (parts.length !== 6) return null

  const [prefix, nStr, rStr, pStr, saltHex, keyHex] = parts
  if (prefix !== SCRYPT_PREFIX) return null

  const N = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)

  if (!isPositiveInteger(N) || !isPositiveInteger(r) || !isPositiveInteger(p)) return null
  // Reject absurd parameters read from a corrupted row (DoS guard).
  if ((N & (N - 1)) !== 0 || N > 1048576 || r > 32 || p > 16) return null
  if (!HEX_PATTERN.test(saltHex) || saltHex.length === 0 || saltHex.length % 2 !== 0) return null
  if (!HEX_PATTERN.test(keyHex) || keyHex.length === 0 || keyHex.length % 2 !== 0) return null

  const salt = Buffer.from(saltHex, 'hex')
  const key = Buffer.from(keyHex, 'hex')
  if (salt.length === 0 || key.length === 0) return null

  return { N, r, p, salt, key }
}

function deriveKey(password: string, salt: Buffer, N: number, r: number, p: number): Buffer {
  return scryptSync(password, salt, SCRYPT_KEY_BYTES, { N, r, p, maxmem: SCRYPT_MAX_MEM })
}

/**
 * Hash a password with scrypt and a fresh 32-byte random salt.
 * A different salt (and therefore hash) is produced on every call.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES)
  const key = deriveKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
  return [
    SCRYPT_PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    key.toString('hex'),
  ].join('$')
}

/** True when the stored value is the legacy unsalted SHA-256 hex format. */
export function isLegacyHash(hash: string): boolean {
  return typeof hash === 'string' && LEGACY_SHA256_PATTERN.test(hash)
}

/** True when the stored value uses the current scrypt format. */
export function isScryptHash(hash: string): boolean {
  return typeof hash === 'string' && hash.startsWith(`${SCRYPT_PREFIX}$`)
}

/**
 * True when a stored hash should be replaced after a successful login:
 * legacy SHA-256, malformed values, or scrypt with outdated parameters.
 */
export function needsRehash(hash: string): boolean {
  if (!isScryptHash(hash)) return true

  const parsed = parseScryptHash(hash)
  if (!parsed) return true

  return (
    parsed.N !== SCRYPT_N ||
    parsed.r !== SCRYPT_R ||
    parsed.p !== SCRYPT_P ||
    parsed.salt.length !== SCRYPT_SALT_BYTES ||
    parsed.key.length !== SCRYPT_KEY_BYTES
  )
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Verify a password against a stored hash.
 * Supports both the scrypt format and the legacy unsalted SHA-256 format.
 * Malformed stored values return false instead of throwing.
 */
export function verifyPasswordHash(password: string, hash: string): boolean {
  if (typeof password !== 'string' || typeof hash !== 'string') return false

  if (isScryptHash(hash)) {
    const parsed = parseScryptHash(hash)
    if (!parsed) return false

    let derived: Buffer
    try {
      derived = deriveKey(password, parsed.salt, parsed.N, parsed.r, parsed.p)
    } catch {
      return false
    }
    return safeEqual(derived, parsed.key)
  }

  if (isLegacyHash(hash)) {
    const computed = createHash('sha256').update(password).digest()
    const expected = Buffer.from(hash, 'hex')
    return safeEqual(computed, expected)
  }

  return false
}
