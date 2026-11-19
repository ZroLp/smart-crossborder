/**
 * Jest setup: 在每个测试文件的沙箱里创建 PGlite 引擎并共享 pg 连接配置。
 *
 * PGlite 的 WASM 默认经动态 import() 加载，Jest vm 沙箱内不可靠；这里在
 * setupFiles（jest runtime 的 CJS 上下文）预编译 WASM 模块后直接注入，
 * 引擎随之常驻，测试通过 node-postgres 协议（pglite/node-postgres）访问，
 * 与生产 pg 客户端走同一条代码路径。
 */
try {
  const path = require('path');
  const fs = require('fs');
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

  const engine = new PGlite(undefined, options);
  globalThis.__SUMAITONG_PGLITE_CONFIG__ = createPgConfig(engine);
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
