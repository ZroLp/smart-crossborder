import { DbClient, RunResult } from './client';

export class BaseRepository<T> {
  constructor(protected db: DbClient, protected tableName: string) {}

  async findById(id: number): Promise<T | undefined> {
    return (await this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id)) as T | undefined;
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<T[]> {
    return (await this.db.prepare(`SELECT * FROM ${this.tableName} LIMIT ? OFFSET ?`).all(limit, offset)) as T[];
  }

  async create(data: Partial<T>): Promise<RunResult> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    return this.db.prepare(sql).run(...values);
  }

  async update(id: number, data: Partial<T>): Promise<RunResult> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    return this.db.prepare(sql).run(...values, id);
  }

  async delete(id: number): Promise<RunResult> {
    return this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }

  async count(): Promise<number> {
    const row = (await this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get()) as { count: number };
    return row.count;
  }
}
