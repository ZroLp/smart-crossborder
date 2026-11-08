import Database from 'better-sqlite3';
/** Additive, transactional migration; existing task and progress rows are retained. */
export function migrateTaskLifecycle(db: Database.Database): void {
  db.transaction(() => {
    const columns = db.prepare('PRAGMA table_info(task_logs)').all() as { name: string }[];
    for (const [name, type] of [['root_task_id', 'INTEGER'], ['parent_task_id', 'INTEGER'], ['attempt_number', 'INTEGER NOT NULL DEFAULT 1'], ['started_at', 'TEXT'], ['ended_at', 'TEXT'], ['chain', 'INTEGER NOT NULL DEFAULT 0']]) {
      if (!columns.some(c => c.name === name)) db.exec('ALTER TABLE task_logs ADD COLUMN ' + name + ' ' + type);
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL,
        from_status TEXT, to_status TEXT NOT NULL, agent_type TEXT NOT NULL,
        attempt_number INTEGER NOT NULL, error TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, id);
      CREATE INDEX IF NOT EXISTS idx_task_root ON task_logs(root_task_id);
      INSERT INTO task_events(task_id, from_status, to_status, agent_type, attempt_number, error)
        SELECT id, NULL, status, agent_type, attempt_number, error FROM task_logs t
        WHERE NOT EXISTS (SELECT 1 FROM task_events e WHERE e.task_id=t.id);
      CREATE TRIGGER IF NOT EXISTS task_created_event AFTER INSERT ON task_logs BEGIN
        INSERT INTO task_events(task_id, from_status, to_status, agent_type, attempt_number, error)
        VALUES (NEW.id, NULL, NEW.status, NEW.agent_type, NEW.attempt_number, NEW.error);
      END;
      CREATE TRIGGER IF NOT EXISTS task_status_event AFTER UPDATE OF status ON task_logs WHEN OLD.status <> NEW.status BEGIN
        INSERT INTO task_events(task_id, from_status, to_status, agent_type, attempt_number, error)
        VALUES (NEW.id, OLD.status, NEW.status, NEW.agent_type, NEW.attempt_number, NEW.error);
      END;
    `);
  }).immediate();
}
