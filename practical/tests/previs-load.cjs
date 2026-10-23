// Browser UMD sources live in a repository whose package type is ESM.
// Load their CommonJS branch explicitly without changing the shared package.
const fs = require('node:fs');
const path = require('node:path');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const record = { exports: {} }; cache.set(file, record);
  new Function('module','require',fs.readFileSync(file,'utf8'))(record, name => load(path.resolve(path.dirname(file),name)));
  return record.exports;
}
module.exports = load;
