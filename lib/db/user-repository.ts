import { DbClient } from './client';
import { BaseRepository } from './base-repository';
import { hashPassword, needsRehash, verifyPasswordHash } from '@/lib/auth/password-hash'

interface User {
  id: number;
  username: string;
  password: string;
  email: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export class UserRepository extends BaseRepository<User> {
  constructor(db: DbClient) {
    super(db, 'users');
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return (await this.db.prepare('SELECT * FROM users WHERE username = ?').get(username)) as User | undefined;
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    if (!user) return false;

    if (!verifyPasswordHash(password, user.password)) return false;

    // Legacy unsalted SHA-256 rows are upgraded in place on first successful
    // login. The upgrade must never make a valid login fail.
    if (needsRehash(user.password)) {
      try {
        await this.update(user.id, { password: hashPassword(password) });
      } catch (error) {
        console.warn('[UserRepository] password rehash failed:', error);
      }
    }

    return true;
  }

  async getRole(userId: number): Promise<string | undefined> {
    const user = await this.findById(userId);
    return user?.role;
  }

  async updateRole(userId: number, role: string): Promise<void> {
    await this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  }
}
