/**
 * Jest setup: 在每个测试文件的沙箱里创建 PGlite 引擎并共享 pg 连接配置。
 *
 * PGlite 的 WASM 默认经动态 import() 加载，Jest vm 沙箱内不可靠；这里在
 * setupFiles（jest runtime 的 CJS 上下文）预编译 WASM 模块后直接注入，
 * 引擎随之常驻，测试通过 node-postgres 协议（pglite/node-postgres）访问，
 * 与生产 pg 客户端走同一条代码路径。
 *
 * 注意：jsdom 环境（@jest-environment jsdom 的组件测试）里 PGlite 的 WASM 会
 * 因 globalThis.window 存在而误判为"浏览器模式"，初始化时抛出
 * "The URL must be of scheme file" 并污染整个沙箱，导致该文件里并不使用数据库的
 * 纯组件测试（mock fetch）也跟着失败。组件测试并不创建真实数据库，因此这里
 * 在 jsdom 环境下直接跳过 PGlite 初始化，消除这整类 flake。
 */
const inJsdom =
  typeof globalThis.window !== 'undefined' &&
  globalThis.window !== null &&
  typeof globalThis.window.document !== 'undefined';

if (inJsdom) {
  console.log('[jest] pglite setup: skipped (jsdom component test, no real DB needed)');
} else {
  try {
    const path = require('path');
    const fs = require('fs');
    // pg-protocol（被 @electric-sql/pglite 加载）在模块顶层引用 TextEncoder /
    // TextDecoder。jest 的 node 沙箱里它们的全局定义可能尚未就绪，直接 require
    // 会抛 "TextEncoder is not defined"（间歇性 flake）。这里从 node:util 补齐，
    // 让 pglite 初始化在 node 环境下确定可用（jsdom 分支已跳过，不受影响）。
    const { TextEncoder, TextDecoder } = require('node:util');
    if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder;
    if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder;

    const { PGlite } = require('@electric-sql/pglite');
    const { createPgConfig } = require('@electric-sql/pglite/node-postgres');

    const distDir = path.dirname(require.resolve('@electric-sql/pglite'));
    const options = {};
    try {
      options.pgliteWasmModule = new WebAssembly.Module(
        fs.readFileSync(path.join(distDir, 'pglite.wasm'))
      );
      options.initdbWasmModule = new WebAssembly.Module(
        fs.readFileSync(path.join(distDir, 'initdb.wasm'))
      );
    } catch {
      /* 缺少 WASM 文件时走默认加载路径 */
    }

    // P9-01: pglite 的 createPgConfig 默认共享"一条" PglitePgConnection（poolSize=1）。
    // pg-pool 里的多个 pg Client 会监听同一个 EventEmitter → 查询消息串台，间歇性
    // "Received unexpected rowDescription" / "Connection terminated unexpectedly"。
    // 这里注入一个 pg Client 子类：每个 pg Client 拥有独立 PglitePgConnection
    // （pglite 引擎本身支持多连接；引擎生命周期不变，仍由调用方持有）。
    const makeIsolatedClientClass = (pgliteEngine) => {
      const { PglitePgConnection } = require('@electric-sql/pglite/node-postgres');
      const { Client: BasePgClient } = require('pg');
      class IsolatedPgliteClient extends BasePgClient {
        constructor(clientOptions) {
          super({ ...clientOptions, connection: new PglitePgConnection({ pglite: pgliteEngine }) });
        }
      }
      return IsolatedPgliteClient;
    };
    const buildPgliteConfig = (pgliteEngine) => {
      const baseConfig = createPgConfig(pgliteEngine);
      try {
        return { ...baseConfig, Client: makeIsolatedClientClass(pgliteEngine) };
      } catch {
        /* PglitePgConnection 不可用时退回默认共享连接配置 */
        return baseConfig;
      }
    };

    const engine = new PGlite(undefined, options);
    const pgliteConfig = buildPgliteConfig(engine);
    globalThis.__SUMAITONG_PGLITE_CONFIG__ = pgliteConfig;
    // P9-01: 同时暴露引擎引用，供 schema 初始化在 pglite 首跑失步时做"引擎稳定"门控。
    globalThis.__SUMAITONG_PGLITE__ = { config: pgliteConfig, engine };

    // 供测试文件在需要时换新引擎（tests/helpers/db-compat.ts 的
    // installFreshPgliteEngine 调用）：新引擎 + 同款隔离连接配置。
    globalThis.__SUMAITONG_PGLITE_CREATE__ = () => {
      const freshEngine = new PGlite(undefined, options);
      const freshConfig = buildPgliteConfig(freshEngine);
      globalThis.__SUMAITONG_PGLITE_CONFIG__ = freshConfig;
      globalThis.__SUMAITONG_PGLITE__ = { config: freshConfig, engine: freshEngine };
      return freshConfig;
    };
    console.log('[jest] pglite setup: wasm injected =', !!options.pgliteWasmModule);
    // 原生构建下 engine.ready 是布尔；WASM 构建下才是 Promise。
    const ready = engine.ready;
    if (ready && typeof ready.then === 'function') {
      ready
        .then(() => console.log('[jest] pglite engine ready'))
        .catch((err) => console.error('[jest] pglite engine init FAILED:', err));
    } else {
      console.log('[jest] pglite engine ready (sync) =', ready);
    }
  } catch (error) {
    console.error('[jest] pglite setup failed:', error);
  }
}
