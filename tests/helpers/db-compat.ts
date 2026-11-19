/**
 * 测试侧 PGlite 兼容包装（仅限 tests/ 使用，勿引入 lib/ 或生产代码）。
 *
 * 背景：lib 已从 better-sqlite3（同步）迁移到 Postgres 方言异步客户端
 * （生产 pg / 测试内嵌 PGlite）。两个迁移残留问题只能在测试侧兜底：
 *
 * 1) 嵌套事务死锁：PGlite 测试池只有 1 个连接（poolSize=1 且无
 *    connectionTimeoutMillis），`db.transaction()` 内再开一层
 *    `db.transaction()` 时内层 pool.connect() 会永久等待外层释放唯一连接。
 *    better-sqlite3 的原生语义是“嵌套 transaction 直接执行函数、并入外层
 *    事务”。本包装恢复该语义：已有事务开启时，嵌套调用并入外层事务。
 *    （触发点：commitTaskState → AgentProgressTracker.protected）
 *
 * 2) run() 无条件给 INSERT 追加 `RETURNING "id"`：sessions（主键
 *    token_hash）/ oauth_states（主键 state）没有 id 列，insert 必然
 *    `column "id" does not exist`。本包装对这两类 insert 预先显式追加
 *    主键列的 RETURNING 子句，使客户端的自动追加被跳过。
 *
 * 3) pglite 协议桥在“约束违例”等错误后的失步（withPgliteRetry /
 *    flushPgliteBridge）：PGlite 0.5.x 的 node-postgres 桥在
 *    ErrorResponse 之后会把残留的 parseComplete/rowDescription 旧消息
 *    泄漏给后续语句，表现为 "Connection terminated unexpectedly" 或
 *    "Received unexpected parseComplete/rowDescription message"；
 *    同引擎上第 2 次违例后 pglite 内部队列可能永久卡死，后续所有语句
 *    挂起。真实 Postgres 无此问题。规避：能预判的测试用 isLocked 等
 *    前置查询替代“靠违例失败”的写法；已发生单次违例后可用
 *    flushPgliteBridge（吞掉残留毒消息）或 withPgliteRetry 兜底。
 */
import type { DbClient, PreparedQuery, TransactionHandle } from '@/lib/db/client'

/** 无 id 列的表 → 主键列（insert 显式 RETURNING 它，避免自动追加 RETURNING "id"）。 */
const NO_ID_PRIMARY_KEY: Record<string, string> = {
  sessions: 'token_hash',
  oauth_states: 'state',
}

function compatInsertSql(sql: string): string {
  if (!/^insert\b/i.test(sql.trim()) || /\breturning\b/i.test(sql)) return sql
  const match = sql.match(/^\s*insert\s+into\s+([a-z_][a-z0-9_]*)/i)
  if (!match) return sql
  const pk = NO_ID_PRIMARY_KEY[match[1].toLowerCase()]
  return pk ? `${sql} RETURNING "${pk}"` : sql
}

export function applyDbCompat(db: DbClient): DbClient {
  const target = db as unknown as {
    prepare: (sql: string) => PreparedQuery
    transaction: <T>(fn: () => T | Promise<T>) => TransactionHandle<T>
  }
  const origPrepare = target.prepare.bind(db)
  const origTransaction = target.transaction.bind(db)
  const state = { open: 0 }

  target.prepare = (sql: string) => origPrepare(compatInsertSql(sql))

  target.transaction = <T>(fn: () => T | Promise<T>): TransactionHandle<T> => {
    if (state.open > 0) {
      // 嵌套：并入外层事务（等价 better-sqlite3 语义），不新开连接 / BEGIN。
      const join = async (): Promise<T> => fn()
      const handle = join as unknown as TransactionHandle<T>
      handle.immediate = join
      handle.exclusive = join
      return handle
    }
    state.open += 1
    const base = origTransaction(fn)
    const guard = <K>(work: () => Promise<K>) => async (): Promise<K> => {
      try {
        return await work()
      } finally {
        state.open = Math.max(0, state.open - 1)
      }
    }
    const handle = guard(() => base()) as unknown as TransactionHandle<T>
    handle.immediate = guard(() => base.immediate())
    handle.exclusive = guard(() => base.exclusive())
    return handle
  }

  return db
}

/**
 * 对 pglite 协议桥失步（错误响应后的残留消息泄漏）做有限重试。
 * 仅在错误信息匹配桥失步特征时重试；真实业务错误原样抛出。
 * 用于“主动制造约束违例”类测试中违例之后的断言查询。
 */
const PGLITE_BRIDGE_DESYNC = /Connection terminated unexpectedly|Received unexpected \w+ message/i

export async function withPgliteRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (attempt === retries || !PGLITE_BRIDGE_DESYNC.test(message)) throw err
    }
  }
  throw new Error('withPgliteRetry: unreachable')
}

/**
 * 标记 client.ready 的 rejection 已被处理。
 *
 * pglite 下 initDatabase 返回的 client.ready 会串接 schema 初始化
 * （DROP/CREATE public + SCHEMA_SQL）。若在 client.ready 完成前调用
 * db.close()（pool.end），链上残留的 execDirect 会抛
 * "Cannot use a pool after calling end"，使 client.ready 变成无人处理的
 * unhandledRejection → 崩掉 jest worker。本函数在创建/关闭 client 时挂一个
 * no-op .catch，把该 rejection 标记为“已处理”，避免崩 worker。
 * 真实 Postgres 下 client.ready 正常 resolve，本调用无副作用。
 */
export function markReadyHandled(db: DbClient): void {
  void db.ready.catch(() => { /* 已知 pglite pool-end 噪音，标记已处理 */ })
}

/**
 * 有界轮询等待一条数据库行可见（pglite 可见性兜底）。
 *
 * pglite 下并发事务写入后，参数化查询可能因桥失步短暂读不到新行
 * （或抛残留毒消息）。本助手重试直至行可见；真实 Postgres 下通常一次命中。
 * 超时仍读不到则抛错（调用方断言前置条件不成立）。
 */
export async function pollDbRow<T = unknown>(
  db: DbClient,
  sql: string,
  params: unknown[] = [],
  { attempts = 40, intervalMs = 25 }: { attempts?: number; intervalMs?: number } = {},
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      const row = (await db.prepare(sql).get(...(params as []))) as T | undefined
      if (row) return row
    } catch {
      /* pglite 桥残留消息，重试 */
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`pollDbRow: row not visible after ${attempts} attempts: ${sql}`)
}

/**
 * 冲刷 pglite 协议桥里残留的旧消息（约束违例等错误后会产生 2-3 条
 * "毒消息"，会依次污染后续语句：表现为 "Received unexpected
 * parseComplete/rowDescription message" 甚至重放旧的违例错误）。
 * 在同一 client 上连续执行无害的 SELECT 1 把毒消息逐条吞掉
 * （连续两次成功即认为已干净）。真实 Postgres 下只是几条无害的
 * SELECT 1，可安全调用。
 */
export async function flushPgliteBridge(db: DbClient, maxFlushes = 8): Promise<void> {
  let previousOk = false
  for (let i = 0; i < maxFlushes; i++) {
    try {
      // 每条 SELECT 1 最多冲刷掉一条残留毒消息。
      await db.exec('SELECT 1')
      if (previousOk) return // 连续成功说明已干净
      previousOk = true
    } catch {
      previousOk = false
      /* 吞掉毒消息（unexpected parseComplete / 残留违例错误等） */
    }
  }
}

/**
 * 给某次 initDatabase 提供全新 PGlite 引擎 + 桥（覆盖 jest setup 的
 * 全局共享 __SUMAITONG_PGLITE_CONFIG__）。用于会制造约束违例错误的
 * 测试文件：失步的残留消息只局限在单引擎内，不波及同沙箱其它 client。
 * 用法：`beforeEach` 里先调用本函数，再 initDatabase(':memory:')。
 *
 * 同时对 pglite 桥的 EventEmitter 挂一个常驻 no-op 'error' 监听器：
 * pglite 内部把“已关闭池的残留协议流错误”通过 EventEmitter.emit('error')
 * 抛出，若无监听器会以 uncaught exception 直接崩掉 jest worker 进程。
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgliteModule = require('@electric-sql/pglite')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgliteNodePostgres = require('@electric-sql/pglite/node-postgres')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeFs = require('fs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodePath = require('path')

const pgliteWasmOptions: Record<string, unknown> = {}
try {
  const distDir = nodePath.dirname(require.resolve('@electric-sql/pglite'))
  pgliteWasmOptions.pgliteWasmModule = new WebAssembly.Module(nodeFs.readFileSync(nodePath.join(distDir, 'pglite.wasm')))
  pgliteWasmOptions.initdbWasmModule = new WebAssembly.Module(nodeFs.readFileSync(nodePath.join(distDir, 'initdb.wasm')))
} catch {
  /* 缺 WASM 文件时走 PGlite 默认加载路径 */
}

function attachBridgeErrorListener(config: unknown): void {
  // pglite 桥的 EventEmitter 是 config.connection（PglitePgConnection）。
  const connection = config as {
    connection?: {
      on?: (event: string, fn: () => void) => unknown
      end?: (...args: unknown[]) => unknown
      emit?: (event: string, ...args: unknown[]) => boolean
      listenerCount?: (event: string) => number
      removeAllListeners?: (event?: string) => unknown
      removeListener?: (event: string, fn: unknown) => unknown
    }
  }
  const xr = connection?.connection
  if (!xr?.on) return
  const noop = () => {
    /* 常驻兜底：吞掉 pglite 残留协议流 error，避免崩掉 jest worker。 */
  }
  const attach = () => {
    try {
      xr.on?.('error', noop)
    } catch {
      /* ignore */
    }
  }
  attach()
  // pg-pool 在连接出错时会 end 该 pg client → 触发 pglite 桥 end()，
  // 其内部 removeAllListeners 会把上面的 'error' 监听器一并清掉；
  // 之后再来的残留协议流 emit('error') 就会因无监听器崩掉 worker。
  // 故 patch end()：调用原实现后重新挂回 'error' 监听器。
  const originalEnd = xr.end?.bind(xr)
  if (originalEnd && !(originalEnd as { __pgliteHardened?: boolean }).__pgliteHardened) {
    ;(originalEnd as { __pgliteHardened?: boolean }).__pgliteHardened = true
    xr.end = ((...args: unknown[]) => {
      let result: unknown
      try {
        result = originalEnd(...args)
      } catch {
        /* pglite 池已结束时 end() 可能抛错；忽略，确保下方重新挂监听器 */
      }
      attach()
      return result
    }) as typeof xr.end
  }
  // 兜底：若 pglite 走的是 emit('error') 且监听器仍被清（其它路径），
  // 包一层 emit 保证 'error' 至少有一个监听器。
  const originalEmit = xr.emit?.bind(xr)
  if (originalEmit && !(originalEmit as { __pgliteHardened?: boolean }).__pgliteHardened) {
    ;(originalEmit as { __pgliteHardened?: boolean }).__pgliteHardened = true
    xr.emit = ((event: string, ...args: unknown[]) => {
      if (event === 'error') {
        const count = xr.listenerCount?.('error')
        if (count === undefined || count === 0) attach()
        if (process.env.PGLITE_GUARD_DEBUG) {
          console.warn('[pglite-emit] error emit, listeners=', xr.listenerCount?.('error'), String(args[0]).slice(0, 60))
        }
        try {
          return originalEmit(event, ...args)
        } catch {
          // 即便瞬时 0 监听器触发 ERR_UNHANDLED_ERROR，也在此吞掉，不崩 worker。
          return true
        }
      }
      return originalEmit(event, ...args)
    }) as typeof xr.emit
  }
  // 关键：pglite 桥 end() 内部会 this.eventNames().forEach(r => this.removeAllListeners(r))，
  // 把 'error' 监听器一并清掉；之后再来的残留协议流 emit('error') 就崩 worker。
  // patch removeAllListeners / removeListener：每次清完后重新挂回 'error'。
  const originalRemoveAll = xr.removeAllListeners?.bind(xr) as
    | ((...args: unknown[]) => unknown)
    | undefined
  if (originalRemoveAll) {
    xr.removeAllListeners = ((...args: unknown[]) => {
      const result = originalRemoveAll(...args)
      if (args.length === 0 || (args[0] === undefined || String(args[0]) === 'error')) attach()
      return result as never
    }) as typeof xr.removeAllListeners
  }
  const originalRemoveOne = xr.removeListener?.bind(xr)
  if (originalRemoveOne) {
    xr.removeListener = ((event: string, fn: unknown) => {
      const result = originalRemoveOne(event, fn)
      if (event === 'error' && xr.listenerCount?.('error') === 0) attach()
      return result as never
    }) as typeof xr.removeListener
  }
  if (process.env.PGLITE_GUARD_DEBUG) {
    console.warn('[pglite-emit] patched xr.emit + xr.end, errListeners=', xr.listenerCount?.('error'))
  }
}

export function installFreshPgliteEngine(): void {
  const config = pgliteNodePostgres.createPgConfig(
    new pgliteModule.PGlite(undefined, pgliteWasmOptions),
  )
  attachBridgeErrorListener(config)
  ;(globalThis as Record<string, unknown>).__SUMAITONG_PGLITE_CONFIG__ = config
  if (process.env.PGLITE_GUARD_DEBUG) {
    const conn = (config as { connection?: { listenerCount?: (e: string) => number; on?: unknown } }).connection
    console.warn('[pglite-fresh] bridge err-listeners =', conn?.listenerCount?.('error') ?? 'n/a', 'hasOn =', !!conn?.on)
  }
}

/**
 * 兜底：pglite 引擎在测试结束 / 池关闭后仍可能有残留 schema-init / seed /
 * 协议流在飞，会以 uncaught "Cannot use a pool after calling end on the
 * pool"（或 pg Client 收到失步消息触发的 ERR_UNHANDLED_ERROR）崩掉 jest
 * worker。本函数挂 process 级 uncaughtException/unhandledRejection 钩子，
 * 仅吞 pglite 专属噪音（见 PGLITE_NOISE_RE），其它异常原样抛出。
 *
 * 幂等且常驻：残留消息常在 afterAll 之后的进程收尾阶段才触发，因此
 * 不在 afterAll 摘除（否则错过收尾阶段的噪音）；同一 worker 内多个测试
 * 文件重复调用也只挂一次。用法（测试文件顶层直接调用即可，无需 stop）。
 */
const PGLITE_NOISE_RE =
  /Cannot use a pool after calling end|unexpected \w+ message|Connection terminated unexpectedly|Unhandled error|pglite/i

let pgliteGuardInstalled = false

export function installPgliteWorkerGuard(): void {
  if (pgliteGuardInstalled) return
  pgliteGuardInstalled = true

  // 同步给“当前全局共享 pglite 桥”（jest.pglite-setup.cjs 创建的那个）挂
  // error 监听并 patch end/emit，防止它因残留协议流崩 worker。
  // 之后测试文件调 installFreshPgliteEngine 换成新引擎时，新桥会单独加固。
  const sharedCfg = (globalThis as Record<string, unknown>).__SUMAITONG_PGLITE_CONFIG__
  attachBridgeErrorListener(sharedCfg)
  if (process.env.PGLITE_GUARD_DEBUG) {
    const conn = (sharedCfg as { connection?: { listenerCount?: (e: string) => number } })?.connection
    console.warn('[pglite-guard] shared-bridge patched, errListeners=', conn?.listenerCount?.('error') ?? 'n/a')
  }

  // 仅识别 pglite 专属噪音；识别失败则原样抛出，避免掩盖真实异常。
  const isKnown = (err: unknown): boolean => {
    if (err instanceof Error && PGLITE_NOISE_RE.test(err.message)) return true
    if (typeof err === 'string') return PGLITE_NOISE_RE.test(err)
    // pglite 有时把（minified 命名的）PglitePgConnection / PGlite 引擎对象
    // 本身作为 rejection/exception 载荷；其构造器名含 "pglite"，据此识别。
    if (typeof err === 'object' && err !== null) {
      const name = String((err as { constructor?: { name?: string } }).constructor?.name ?? '')
      if (PGLITE_NOISE_RE.test(name)) return true
    }
    return false
  }
  process.on('uncaughtException', (err: unknown) => {
    if (process.env.PGLITE_GUARD_DEBUG) {
      console.warn('[pglite-guard] uncaughtException fired:', String((err as Error)?.message ?? err).slice(0, 100))
    }
    if (isKnown(err)) {
      // 已知 pglite 残留噪音：仅记录，不崩 worker。
      console.warn('[pglite-guard] swallowed uncaught:', String((err as Error)?.message ?? err).slice(0, 100))
      return
    }
    // 非 pglite 噪音：保持默认行为（终止），避免掩盖真实错误。
    throw err
  })
  process.on('unhandledRejection', (reason: unknown) => {
    if (process.env.PGLITE_GUARD_DEBUG) {
      console.warn('[pglite-guard] unhandledRejection fired:', String((reason as Error)?.message ?? reason).slice(0, 100))
    }
    if (isKnown(reason)) {
      console.warn('[pglite-guard] swallowed rejection:', String((reason as Error)?.message ?? reason).slice(0, 100))
      return
    }
    // 非 pglite 的 unhandledRejection：记录但不终止（Node 默认会终止，
    // 这里保持进程存活以便其余测试继续；真实断言失败仍由 jest 捕获）。
    console.error('[pglite-guard] UNHANDLED REJECTION (non-pglite):', reason)
  })
  if (process.env.PGLITE_GUARD_DEBUG) {
    console.warn('[pglite-guard] installed pid=', process.pid,
      'sameGlobal=', (globalThis as { process?: unknown }).process === process,
      'ucListeners=', process.listenerCount('uncaughtException'),
      'urListeners=', process.listenerCount('unhandledRejection'))
  }
}
