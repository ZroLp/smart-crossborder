import { DbClient } from './client';
import { BaseRepository } from './base-repository';

export interface Product {
  id: number;
  shop_id: number;
  name: string;
  category: string | null;
  price: number | null;
  cost: number | null;
  sales: number;
  stock: number;
  status: string;
  created_at: string;
}

export class ProductRepository extends BaseRepository<Product> {
  constructor(db: DbClient) {
    super(db, 'products');
  }

  async findByShopId(shopId: number): Promise<Product[]> {
    return (await this.db.prepare('SELECT * FROM products WHERE shop_id = ?').all(shopId)) as Product[];
  }

  async findByCategory(category: string): Promise<Product[]> {
    return (await this.db.prepare('SELECT * FROM products WHERE category = ?').all(category)) as Product[];
  }

  async findLowStock(threshold: number): Promise<Product[]> {
    return (await this.db.prepare('SELECT * FROM products WHERE stock <= ? AND status = ?').all(threshold, 'active')) as Product[];
  }
}
