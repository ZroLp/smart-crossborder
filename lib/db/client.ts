import type { Client, QueryResult } from 'pg';
import { Pool } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * 统一异步数据库客户端。
 *
 * 生产/开发使用 node-postgres (pg) 连接 Postgres；测试使用 PGlite（内嵌 Postgres，
 * 内存模式），两者的调用面与 better-sqlite3 保持一致（prepare/get/all/run/
 * transaction），但全部为异步：
 *
 *   const row = await db.prepare('SELECT ... WHERE id = ?').get(1);
 *   const { changes } = await db.prepare('INSERT ...').run(a, b);
 *   await db.transaction(() => { ... }).immediate();
 *
 * 参数占位符沿用 `?` 风格，运行时自动改写为 $1..$n；INSERT 语句自动追加
 * `RETURNING "id"`，因此 RunResult 同时携带 lastInsertRowid。
 */

export type DbRow = Record<string, any>;

export interface RunResult {
  changes: number;
  lastInsertRowid: number | null;
}

export interface PreparedQuery {
  get(...params: unknown[]): Promise<DbRow | undefined>;
  all(...params: unknown[]): Promise<DbRow[]>;
  run(...params: unknown[]): Promise<RunResult>;
}

export interface TransactionHandle<T> {
  (): Promise<T>;
  immediate: () => Promise<T>;
  exclusive: () => Promise<T>;
}

export interface DbClient {
  readonly kind: 'pg' | 'pglite';
  /** 引擎就绪（连接建立 + schema 迁移）前所有方法都会等待它。可被 initDatabase 追加迁移链。 */
  ready: Promise<void>;
  exec(sql: string): Promise<void>;
  /** 不经过 ready 门控直接执行（初始化链专用，避免自锁）。 */
  execDirect(sql: string): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: DbRow[]; rowCount: number }>;
  prepare(sql: string): PreparedQuery;
  transaction<T>(fn: () => T | Promise<T>): TransactionHandle<T>;
  close(): Promise<void>;
}

/** 将 `?` 占位符（引号外）改写为 $1..$n。 */
export function toPostgresSql(sql: string, paramCount: number): string {
  let out = '';
  let n = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      out += ch;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
    } else if (ch === '?' && !inSingle && !inDouble) {
      n += 1;
      out += `$${n}`;
    } else {
      out += ch;
    }
  }
  return out;
}

/** INSERT 语句追加 RETURNING "id"（已有 RETURNING 子句时不动）。 */
function withReturning(sql: string): string {
  const normalized = sql.trim().replace(/\s+/g, ' ');
  if (!/^insert\b/i.test(normalized) || /\breturning\b/i.test(normalized)) return sql;
  return sql + ' RETURNING "id"';
}

/** Date → ISO 字符串，保证 pg / pglite 两种驱动的时间列语义一致。 */
function normalizeRow(row: DbRow): DbRow {
  for (const key of Object.keys(row)) {
    if (row[key] instanceof Date) {
      row[key] = row[key].toISOString();
    }
  }
  return row;
}

/**
 * pg 专用：按字段 OID 校正类型。
 * - int8 (OID 20) 默认返回字符串，统一转回 number；
 * - timestamptz (1186) / timestamp (1114) 返回 Date，转 ISO 字符串。
 */
function normalizePgRows(result: QueryResult): DbRow[] {
  // DDL 等无返回行的语句里 rows 可能缺省。
  return (result.rows ?? []).map((obj) => {
    const row: DbRow = {};
    for (const field of result.fields ?? []) {
      let value: unknown = (obj as Record<string, unknown>)[field.name];
      if (field.dataTypeID === 20 && typeof value === 'string') {
        // int8 默认文本解析，转回 number（如 BIGINT 的 expires_at）
        value = Number(value);
      } else if (
        field.dataTypeID === 1082 ||
        field.dataTypeID === 1114 ||
        field.dataTypeID === 1184 ||
        field.dataTypeID === 1186
      ) {
        // 日期/时间列统一为 ISO 字符串（pglite 解析器可能已返回字符串）
        value = value instanceof Date ? value.toISOString() : value;
      }
      row[field.name] = value;
    }
    return row;
  });
}

/** 事务内共享同一个连接：prepared 语句优先走当前事务连接。 */
const txScope = new AsyncLocalStorage<Client>();

class PgDbClient implements DbClient {
  readonly kind = 'pg' as const;
  ready: Promise<void>;
  private readonly pool: Pool;
  private closed = false;

  constructor(
    private readonly poolConfig:
      | string
      | ConstructorParameters<typeof Pool>[0] = {}
  ) {
    // PGlite 逻辑库通过 poolConfig.connection（PglitePgConnection）接入，
    // 其余场景 connectionString 形式传入。
    this.pool = new Pool(
      typeof poolConfig === 'string' || poolConfig === undefined
        ? {
            connectionString: poolConfig as string,
            max: Number(process.env.PG_POOL_SIZE ?? 10),
            idleTimeoutMillis: 60_000,
            connectionTimeoutMillis: 10_000,
          }
        : poolConfig
    );
    this.ready = this.pool
      .query('SELECT 1')
      .then(() => undefined)
      .catch((error: unknown) => {
        console.error('[db] Postgres connection failed:', error);
        throw error;
      });
  }

  private async run(sql: string, params: unknown[]): Promise<{ rows: DbRow[]; rowCount: number }> {
    await this.ready;
    const active = txScope.getStore();
    const pgSql = toPostgresSql(sql, params.length);
    const executor = active ?? this.pool;
    const result = await executor.query(pgSql, params);
    const rows = normalizePgRows(result as QueryResult);
    return { rows, rowCount: result.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.run(sql, []);
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: DbRow[]; rowCount: number }> {
    return this.run(sql, params);
  }

  prepare(sql: string): PreparedQuery {
    const client = this;
    return {
      get: async (...params: unknown[]) => {
        const result = await client.run(sql, params);
        return result.rows[0];
      },
      all: async (...params: unknown[]) => {
        const result = await client.run(sql, params);
        return result.rows;
      },
      run: async (...params: unknown[]) => {
        const result = await client.run(withReturning(sql), params);
        const lastInsertRowid =
          /^insert\b/i.test(sql.trim()) ? (result.rows[0]?.id ?? null) : null;
        return { changes: result.rowCount, lastInsertRowid };
      },
    };
  }

  transaction<T>(fn: () => T | Promise<T>): TransactionHandle<T> {
    const client = this;
    const run = async (): Promise<T> => {
      await client.ready;
      const conn = await client.pool.connect();
      try {
        await conn.query('BEGIN');
        const value = await txScope.run(conn, async () => fn());
        await conn.query('COMMIT');
        return value;
      } catch (error) {
        try {
          await conn.query('ROLLBACK');
        } catch {
          /* 连接可能已断开，释放即可 */
        }
        throw error;
      } finally {
        conn.release();
      }
    };
    const handle = run as TransactionHandle<T>;
    handle.immediate = run;
    handle.exclusive = run;
    return handle;
  }

  /** 不经过 ready 链（避免在 ready 追加逻辑里自锁）；直接走池执行。 */
  async execDirect(sql: string): Promise<void> {
    await this.pool.query(toPostgresSql(sql, 0));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
  }
}

export function createPgClient(connectionString?: string): DbClient {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for the Postgres client');
  }
  return new PgDbClient(url);
}

/**
 * 内嵌 PGlite（Postgres 兼容）客户端：测试与无 DATABASE_URL 的开发降级用。
 * 通过 pglite/node-postgres 的 PglitePgConnection 走 node-postgres 协议层，
 * 与生产 pg 客户端完全同构（int8/timestamptz 归一化逻辑共用）。
 *
 * PGlite 引擎的创建放在 CJS 顶层（Jest setup 文件或 node 脚本），
 * 避免在 Jest vm 沙箱内初始化 WASM（需要 --experimental-vm-modules）。
 */
function ensurePglitePoolConfig(): ConstructorParameters<typeof Pool>[0] {
  const preset = (globalThis as Record<string, unknown>).__SUMAITONG_PGLITE_CONFIG__ as
    | ConstructorParameters<typeof Pool>[0]
    | undefined;
  if (preset) return preset;

  // 原生 Node 环境：直接构建 PGlite 引擎（CJS require；预编译 WASM 可选注入）。
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pglite = require('@electric-sql/pglite');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createPgConfig } = require('@electric-sql/pglite/node-postgres');
  const fs = require('fs');
  const pathMod = require('path');

  const options: Record<string, unknown> = {};
  try {
    const distDir = pathMod.dirname(require.resolve('@electric-sql/pglite'));
    options.pgliteWasmModule = new WebAssembly.Module(fs.readFileSync(pathMod.join(distDir, 'pglite.wasm')));
    options.initdbWasmModule = new WebAssembly.Module(fs.readFileSync(pathMod.join(distDir, 'initdb.wasm')));
  } catch {
    /* 缺少 WASM 文件时走 PGlite 默认加载路径 */
  }

  const engine = new pglite.PGlite(undefined, options);
  const config = createPgConfig(engine) as ConstructorParameters<typeof Pool>[0];
  (globalThis as Record<string, unknown>).__SUMAITONG_PGLITE_CONFIG__ = config;
  return config;
}

/** 内存逻辑库：每个调用得到一个干净 schema 的客户端（同引擎 + DROP/CREATE public）。 */
export function createPgliteClient(): DbClient {
  const client = new PgDbClient(ensurePglitePoolConfig());
  const baseReady = client.ready;
  client.ready = baseReady
    .then(async () => {
      // 逐条执行：pglite 单语句查询语义，多语句串可能挂起。
      await client.execDirect('DROP SCHEMA IF EXISTS public CASCADE');
      await client.execDirect('CREATE SCHEMA public');
    });
  return client;
}

/** 默认引擎：DATABASE_URL 存在则用 Postgres，否则内存 PGlite（开发降级）。 */
export function createDefaultClient(): DbClient {
  if (process.env.DATABASE_URL) {
    return createPgClient();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL must be set in production');
  }
  console.warn('[db] DATABASE_URL not set — falling back to in-memory PGlite (data will not persist)');
  return createPgliteClient();
}
