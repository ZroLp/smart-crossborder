import { createDefaultClient, createPgliteClient, DbClient, getPgliteEngine } from './client';
import { SCHEMA_SQL, LIFECYCLE_MIGRATION_SQL } from './schema';

let dbInstance: DbClient | null = null;

/** P9-01: pglite 线协议类错误（引擎异步启动与首条 DDL 竞争时的一次性失步）。 */
function isPgliteWireError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /rowDescription|Connection terminated|pool.*ended|Unhandled error/i.test(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** P9-01: 已完成首跑稳定门控的 pglite 引擎（每个测试沙箱内各自记录）。 */
const pgliteSettledEngines = new WeakSet<object>();

/**
 * P9-01: pglite（内存）路径的 schema 初始化。
 *
 * 背景：WASM 引擎的 initdb 引导是异步的，每个测试文件的首个 initDatabase 与其
 * 竞争时会偶发 "Received unexpected rowDescription message from backend" /
 * "Connection terminated unexpectedly"（一次性线协议失步，引擎随后自行恢复）。
 * DROP/CREATE SCHEMA 与 SCHEMA_SQL（IF NOT EXISTS）整体幂等，失败后整段重放安全。
 *
 * - 引擎首跑：循环执行幂等 schema 序列直至连续成功两次（最多 ~8s），确认引擎
 *   已稳定后再放行，从根上消除"首个测试 timing flake"；
 * - 引擎已稳定：单次执行 + 小次数失步重放。
 *
 * 仅 pglite 客户端走此路径，pg 生产路径不受影响。
 */
async function applyPgliteSchema(client: DbClient, base: Promise<void>): Promise<void> {
  const attempt = async (): Promise<void> => {
    try {
      await base;
    } catch {
      /* base 链（DROP/CREATE）可能已因线协议失步失败；下方整段重放会复位状态 */
    }
    await sleep(0);
    await client.execDirect('SELECT 1'); // 让引擎事件循环消化挂起消息
    await client.execDirect('DROP SCHEMA IF EXISTS public CASCADE');
    await client.execDirect('CREATE SCHEMA public');
    await client.execDirect(SCHEMA_SQL);
    await client.execDirect(LIFECYCLE_MIGRATION_SQL);
  };

  const engine = getPgliteEngine() as object | undefined;
  if (engine && !pgliteSettledEngines.has(engine)) {
    let consecutive = 0;
    const startedAt = Date.now();
    while (consecutive < 2) {
      try {
        await attempt();
        consecutive += 1;
        if (consecutive >= 2) break;
        if (Date.now() - startedAt > 8000) break; // 保护：8s 内未稳定则按已尽量处理放行
      } catch (error) {
        if (!isPgliteWireError(error)) throw error;
        consecutive = 0;
        if (Date.now() - startedAt > 8000) throw error;
        await sleep(120);
      }
    }
    pgliteSettledEngines.add(engine);
    return;
  }

  for (let i = 0; i < 4; i += 1) {
    try {
      await attempt();
      return;
    } catch (error) {
      if (i === 3 || !isPgliteWireError(error)) throw error;
      await sleep(75 * (i + 1));
    }
  }
}

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
  const ready = (client.kind === 'pglite'
    ? applyPgliteSchema(client, base)
    : base.then(async () => {
        await client.execDirect(SCHEMA_SQL);
        await client.execDirect(LIFECYCLE_MIGRATION_SQL);
      }))
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
