import Database from 'better-sqlite3';

interface SharedContextRecord {
  id: number;
  agent_type: string;
  key: string;
  value: string;
  created_at: string;
}

export interface SharedContextEntry {
  id: number;
  agentType: string;
  key: string;
  value: Record<string, unknown>;
  createdAt: string;
}

export class SharedContext {
  private db: Database.Database;

  constructor(db: Database.Database, private taskId?: string) {
    this.db = db;
  }

  private scope(key: string): string { return this.taskId ? JSON.stringify([this.taskId, key]) : key; }

  setData(agentType: string, key: string, value: Record<string, unknown>): void {
    this.db
      .prepare('INSERT INTO shared_context (agent_type, key, value) VALUES (?, ?, ?)')
      .run(agentType, this.scope(key), JSON.stringify(value));
  }

  getData(agentType: string, key: string): Record<string, unknown> | null {
    const row = this.db
      .prepare('SELECT value FROM shared_context WHERE agent_type = ? AND key = ? ORDER BY id DESC LIMIT 1')
      .get(agentType, this.scope(key)) as SharedContextRecord | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.value) as Record<string, unknown>;
  }

  getHistory(agentType: string, key?: string): SharedContextEntry[] {
    let rows: SharedContextRecord[];

    if (key) {
      rows = this.db
        .prepare('SELECT * FROM shared_context WHERE agent_type = ? AND key = ? ORDER BY id ASC')
        .all(agentType, this.scope(key)) as SharedContextRecord[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM shared_context WHERE agent_type = ? ORDER BY id ASC')
        .all(agentType) as SharedContextRecord[];
    }

    if (this.taskId) rows = rows.filter(row => { try { return JSON.parse(row.key)[0] === this.taskId; } catch { return false; } });
    return rows.map((row) => ({
      id: row.id,
      agentType: row.agent_type,
      key: this.taskId ? JSON.parse(row.key)[1] : row.key,
      value: JSON.parse(row.value) as Record<string, unknown>,
      createdAt: row.created_at,
    }));
  }

  clear(agentType: string, key?: string): void {
    if (key) {
      this.db
        .prepare('DELETE FROM shared_context WHERE agent_type = ? AND key = ?')
        .run(agentType, this.scope(key));
    } else {
      for (const entry of this.getHistory(agentType)) this.db.prepare('DELETE FROM shared_context WHERE id = ?').run(entry.id);
    }
  }
}
