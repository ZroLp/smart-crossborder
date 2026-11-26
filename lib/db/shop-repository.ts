import { DbClient } from './client';
import { BaseRepository } from './base-repository';

interface Shop {
  id: number;
  user_id: number;
  shop_name: string;
  domain: string;
  access_token: string;
  scope: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ShopRepository extends BaseRepository<Shop> {
  constructor(db: DbClient) {
    super(db, 'shops');
  }

  async findByUserId(userId: number): Promise<Shop[]> {
    return (await this.db.prepare('SELECT * FROM shops WHERE user_id = ?').all(userId)) as Shop[];
  }

  async findByDomain(domain: string): Promise<Shop | undefined> {
    return (await this.db.prepare('SELECT * FROM shops WHERE domain = ?').get(domain)) as Shop | undefined;
  }

  async findByUserIdAndDomain(userId: number, domain: string): Promise<Shop | undefined> {
    return (await this.db.prepare('SELECT * FROM shops WHERE user_id = ? AND domain = ?').get(userId, domain)) as Shop | undefined;
  }
}

export type { Shop };
