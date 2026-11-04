import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePasswordStrength,
} from '@/lib/auth/password-policy'

describe('password-policy', () => {
  test('exports the documented bounds', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(MAX_PASSWORD_LENGTH).toBe(128)
  })

  test('accepts an 8-character password', () => {
    expect(validatePasswordStrength('abcd1234')).toEqual({ valid: true })
  })

  test('accepts a 128-character password', () => {
    expect(validatePasswordStrength('a'.repeat(MAX_PASSWORD_LENGTH)).valid).toBe(true)
  })

  test('rejects a 7-character password', () => {
    const result = validatePasswordStrength('1234567')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 8')
  })

  test('rejects a 129-character password', () => {
    const result = validatePasswordStrength('a'.repeat(MAX_PASSWORD_LENGTH + 1))
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at most 128')
  })

  test('rejects missing or empty passwords', () => {
    expect(validatePasswordStrength('').valid).toBe(false)
    expect(validatePasswordStrength(undefined).valid).toBe(false)
    expect(validatePasswordStrength(null).valid).toBe(false)
    expect(validatePasswordStrength(12345678).valid).toBe(false)
  })

  test('rejects whitespace-only passwords', () => {
    expect(validatePasswordStrength('        ').valid).toBe(false)
  })

  test('accepts unicode passwords at the minimum length', () => {
    expect(validatePasswordStrength('密码密码密码密码').valid).toBe(true)
  })
})
