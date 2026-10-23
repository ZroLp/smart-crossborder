import { createHash } from 'crypto'

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function verifyPasswordHash(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}
