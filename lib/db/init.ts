import { createDefaultClient, createPgliteClient, DbClient } from './client';
import { SCHEMA_SQL, LIFECYCLE_MIGRATION_SQL } from './schema';

let dbInstance: DbClient | null = null;

async function applySeed(client: DbClient): Promise<void> {
  const shouldSeedDemo =
    process.env.SEED_DEMO_DATA === 'true' ||
    (process.env.NODE_ENV === 'development' && process.env.SEED_DEMO_DATA !== 'false');

  if (!shouldSeedDemo) return;

  // 懒加载 seed，避免 init 的静态依赖环。
  const { seedDemoData } = await import('./seed');
  try {
    await seedDemoData(client);
  } catch (error) {
    console.warn('[db] demo seed skipped:', error);
  }
}

/**
 * 初始化数据库客户端（同步返回，内部异步就绪）。
 *
 * - `':memory:'`：内嵌 PGlite（Postgres 兼容），仅测试使用；
 * - 其它/缺省：DATABASE_URL → node-postgres；未配置时开发环境降级为内存 PGlite。
 *
 * 所有方法在 `client.ready` 完成 schema 迁移与 demo 种子前自动等待。
 */
export function initDatabase(dbPath?: string): DbClient {
  const client = dbPath === ':memory:' ? createPgliteClient() : createDefaultClient();

  // schema 迁移必须用 execDirect（不经过 ready 门控），否则会等待正在构建的
  // 自身 ready 链 → 死锁。种子数据在 ready 完成后走常规 API。
  const base = client.ready;
  const ready = base
    .then(async () => {
      await client.execDirect(SCHEMA_SQL);
      await client.execDirect(LIFECYCLE_MIGRATION_SQL);
    })
    .catch((error: unknown) => {
      console.error('[db] schema init failed:', error);
      throw error;
    });
  client.ready = ready;
  void ready.then(() => applySeed(client)).catch((error: unknown) => {
    console.warn('[db] demo seed skipped:', error);
  });

  dbInstance = client;
  return client;
}

export function getDb(): DbClient {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

/** 测试辅助：释放当前客户端连接。 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
