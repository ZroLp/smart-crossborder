import Database from 'better-sqlite3';
import { BaseRepository } from './base-repository';

interface Shop {
  id: number;
  user_id: number;
  shop_name: string;
  domain: string;
  access_token: string;
  scope: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class ShopRepository extends BaseRepository<Shop> {
  constructor(db: Database.Database) {
    super(db, 'shops');
  }

  findByUserId(userId: number): Shop[] {
    return this.db.prepare('SELECT * FROM shops WHERE user_id = ?').all(userId) as Shop[];
  }

  findByDomain(domain: string): Shop | undefined {
    return this.db.prepare('SELECT * FROM shops WHERE domain = ?').get(domain) as Shop | undefined;
  }

  findByUserIdAndDomain(userId: number, domain: string): Shop | undefined {
    return this.db.prepare('SELECT * FROM shops WHERE user_id = ? AND domain = ?').get(userId, domain) as Shop | undefined;
  }
}

export type { Shop };
