import { createPgliteClient } from '../lib/db/client';
import { SCHEMA_SQL, LIFECYCLE_MIGRATION_SQL } from '../lib/db/schema';

async function main() {
  const db = createPgliteClient();
  await db.exec(SCHEMA_SQL);
  await db.exec(LIFECYCLE_MIGRATION_SQL);

  const user = await db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('u1', 'h', 'admin');
  console.log('user run:', user);

  const u = await db.prepare('SELECT * FROM users WHERE username = ?').get('u1');
  console.log('user get:', u, 'created_at typeof:', typeof u?.created_at);

  // 触发器：insert task_logs 应产生 task_events
  await db.prepare('INSERT INTO task_logs (agent_type, task_name, status, user_id) VALUES (?, ?, ?, ?)').run('shop', 't1', 'pending', user.lastInsertRowid);
  const events = await db.prepare('SELECT count(*) AS c FROM task_events').get();
  console.log('task_events after insert:', events);

  await db.prepare('UPDATE task_logs SET status = ? WHERE id = ?').run('running', 1);
  const events2 = await db.prepare('SELECT count(*) AS c FROM task_events').get();
  console.log('task_events after status update:', events2);

  // 事务 + 唯一约束
  await db.prepare('INSERT INTO task_locks (resource, agent_type, task_id) VALUES (?, ?, ?)').run('res-1', 'a', '1');
  let dupCaught = false;
  try {
    await db.prepare('INSERT INTO task_locks (resource, agent_type, task_id) VALUES (?, ?, ?)').run('res-1', 'a', '2');
  } catch {
    dupCaught = true;
  }
  console.log('unique constraint blocked dup:', dupCaught);

  // 事务回滚
  try {
    await db.transaction(async () => {
      await db.prepare('UPDATE task_logs SET status = ? WHERE id = ?').run('failed', 1);
      throw new Error('boom');
    }).immediate();
  } catch (e) {
    console.log('tx rejected:', (e as Error).message);
  }
  const status = await db.prepare('SELECT status FROM task_logs WHERE id = ?').get(1);
  console.log('status after rollback (expect running):', status);

  // 多语句
  await db.exec('INSERT INTO shared_context (agent_type, key, value) VALUES (\'a\', \'k\', \'v\');');
  console.log('multi-stmt ok');

  // interval 比较
  await db.prepare('DELETE FROM task_locks WHERE acquired_at <= now() - ?::interval').run('60 seconds');
  console.log('interval delete ok');

  await db.close();
  console.log('SMOKE OK');
}

main().catch((e) => {
  console.error('SMOKE FAIL', e);
  process.exit(1);
});
