import Database from 'better-sqlite3';
import { BaseRepository } from './base-repository';

interface Product {
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
  constructor(db: Database.Database) {
    super(db, 'products');
  }

  findByShopId(shopId: number): Product[] {
    return this.db.prepare('SELECT * FROM products WHERE shop_id = ?').all(shopId) as Product[];
  }

  findByCategory(category: string): Product[] {
    return this.db.prepare('SELECT * FROM products WHERE category = ?').all(category) as Product[];
  }

  findLowStock(threshold: number): Product[] {
    return this.db.prepare('SELECT * FROM products WHERE stock <= ? AND status = ?').all(threshold, 'active') as Product[];
  }
}
