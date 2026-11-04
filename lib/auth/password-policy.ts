export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

export interface PasswordValidationResult {
  valid: boolean
  error?: string
}

/**
 * Basic password strength policy: 8-128 characters, not blank.
 * The upper bound also keeps scrypt input bounded.
 */
export function validatePasswordStrength(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'Password is required' }
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    }
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
    }
  }

  if (password.trim().length === 0) {
    return { valid: false, error: 'Password must not consist only of whitespace' }
  }

  return { valid: true }
}
