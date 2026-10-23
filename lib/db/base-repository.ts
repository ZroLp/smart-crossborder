import Database from 'better-sqlite3';

export class BaseRepository<T> {
  constructor(protected db: Database.Database, protected tableName: string) {}

  findById(id: number): T | undefined {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id) as T | undefined;
  }

  findAll(limit: number = 100, offset: number = 0): T[] {
    return this.db.prepare(`SELECT * FROM ${this.tableName} LIMIT ? OFFSET ?`).all(limit, offset) as T[];
  }

  create(data: Partial<T>): Database.RunResult {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    return this.db.prepare(sql).run(...values);
  }

  update(id: number, data: Partial<T>): Database.RunResult {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    return this.db.prepare(sql).run(...values, id);
  }

  delete(id: number): Database.RunResult {
    return this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }

  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get() as { count: number };
    return row.count;
  }
}
