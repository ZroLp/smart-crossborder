/* pglite + pg 池形态探针（原生 node 运行，非 jest） */
const pglite = require('@electric-sql/pglite');
const { createPgConfig } = require('@electric-sql/pglite/node-postgres');
const fs = require('fs');
const path = require('path');

const distDir = path.dirname(require.resolve('@electric-sql/pglite'));
const options = {};
try {
  options.pgliteWasmModule = new WebAssembly.Module(
    fs.readFileSync(path.join(distDir, 'pglite.wasm'))
  );
  options.initdbWasmModule = new WebAssembly.Module(
    fs.readFileSync(path.join(distDir, 'initdb.wasm'))
  );
} catch (e) {
  console.log('wasm preload skipped:', e.message);
}

(async () => {
  const engine = new pglite.PGlite(undefined, options);
  console.log('ready type:', typeof engine.ready, 'thenable:', !!(engine.ready && engine.ready.then));
  const r = engine.ready;
  if (r && typeof r.catch === 'function') await r.catch(() => {});
  const { Pool } = require('pg');
  const pool = new Pool(createPgConfig(engine));
  const res = await pool.query("SELECT 12345678901234 AS big, now() AS ts, 'x' AS s");
  console.log('result keys:', Object.keys(res));
  console.log('rows:', JSON.stringify(res.rows));
  console.log('values:', JSON.stringify(res.values));
  console.log('fields:', JSON.stringify(res.fields));
  await pool.end();
})().catch((e) => {
  console.error('PROBE FAIL:', e);
  process.exit(1);
});
