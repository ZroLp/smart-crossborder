const path = require('path');
const fs = require('fs');
const { PGlite } = require('@electric-sql/pglite');
const { createPgConfig } = require('@electric-sql/pglite/node-postgres');
const { Pool } = require('pg');

async function main() {
  const distDir = path.dirname(require.resolve('@electric-sql/pglite'));
  const pgliteWasmModule = new WebAssembly.Module(fs.readFileSync(path.join(distDir, 'pglite.wasm')));
  const initdbWasmModule = new WebAssembly.Module(fs.readFileSync(path.join(distDir, 'initdb.wasm')));
  const pg = new PGlite(undefined, { pgliteWasmModule, initdbWasmModule });
  const pool = new Pool(createPgConfig(pg));
  const res = await pool.query('SELECT 1 AS x');
  console.log('pg-over-pglite OK:', JSON.stringify(res.rows), 'fields:', res.fields.map(f => f.name));
  await pool.end();
  await pg.close();
}
main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
