// 一次性脚本：对比 5 语种 i18n 键集差异
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'lib', 'i18n', 'locales');
const locales = ['zh', 'en', 'es', 'fr', 'de'];

function load(file) {
  let s = fs.readFileSync(path.join(dir, file + '.ts'), 'utf8');
  s = s.replace(/^import .*$/m, '').replace(/: TranslationDict/g, '');
  const m = s.match(/export default (\w+);/);
  const name = m ? m[1] : null;
  // 把 "const en: TranslationDict = {" 的对象字面量 eval 出来
  const objSrc = s.replace(/export default .*$/m, '').replace(new RegExp('const ' + name + '\\s*=\\s*'), 'globalThis.__OBJ =');
  eval(objSrc);
  return globalThis.__OBJ;
}

function flatten(obj, prefix = '') {
  const out = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? prefix + '.' + k : k;
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v, full));
    else out.push(full);
  }
  return out;
}

const data = {};
for (const l of locales) data[l] = new Set(flatten(load(l)));
const ref = data.zh;
console.log('key counts:', locales.map(l => `${l}=${data[l].size}`).join(' '));
for (const l of locales) {
  const missing = [...ref].filter(k => !data[l].has(k));
  const extra = [...data[l]].filter(k => !ref.has(k));
  console.log(`\n== ${l} vs zh ==`);
  console.log('missing in ' + l + ` (${missing.length}):`);
  console.log(missing.join('\n'));
  console.log(`extra in ${l} (${extra.length}):`);
  console.log(extra.join('\n'));
}
