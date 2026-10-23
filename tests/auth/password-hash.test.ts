import { hashPassword, verifyPasswordHash } from '@/lib/auth/password-hash';

describe('password-hash', () => {
  test('hashes a password consistently', () => {
    const hash1 = hashPassword('mySecurePass123');
    const hash2 = hashPassword('mySecurePass123');
    expect(hash1).toBe(hash2);
  });

  test('different passwords produce different hashes', () => {
    const hash1 = hashPassword('password1');
    const hash2 = hashPassword('password2');
    expect(hash1).not.toBe(hash2);
  });

  test('verifyPasswordHash returns true for correct password', () => {
    const hash = hashPassword('correctPassword');
    expect(verifyPasswordHash('correctPassword', hash)).toBe(true);
  });

  test('verifyPasswordHash returns false for wrong password', () => {
    const hash = hashPassword('correctPassword');
    expect(verifyPasswordHash('wrongPassword', hash)).toBe(false);
  });

  test('hash is a 64-character hex string (SHA-256)', () => {
    const hash = hashPassword('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('handles empty password', () => {
    const hash = hashPassword('');
    expect(hash).toHaveLength(64);
    expect(verifyPasswordHash('', hash)).toBe(true);
  });

  test('handles unicode characters', () => {
    const hash = hashPassword('密码测试🔐');
    expect(verifyPasswordHash('密码测试🔐', hash)).toBe(true);
  });
});
