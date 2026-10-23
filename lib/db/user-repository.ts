import Database from 'better-sqlite3';
import { BaseRepository } from './base-repository';
import { hashPassword, verifyPasswordHash } from '@/lib/auth/password-hash'

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
  constructor(db: Database.Database) {
    super(db, 'users');
  }

  findByUsername(username: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  }

  verifyPassword(username: string, password: string): boolean {
    const user = this.findByUsername(username);
    if (!user) return false;
    if (verifyPasswordHash(password, user.password)) return true;
    if (user.password === password) {
      this.update(user.id, { password: hashPassword(password) });
      return true;
    }
    return false;
  }

  getRole(userId: number): string | undefined {
    const user = this.findById(userId);
    return user?.role;
  }

  updateRole(userId: number, role: string): void {
    this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  }
}
