const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const output = process.argv[2] || path.join('dist', 'win-x64-recovery');
const executable = path.join(output, 'Winmap.DesktopHost.exe');
const webRoot = path.join(output, 'wwwroot');
const assets = ['app.js', 'icon.svg', 'index.html', 'manifest.webmanifest', 'space-engine.js', 'styles.css', 'sw.js'];

assert.ok(fs.statSync(executable).size > 30 * 1024 * 1024, 'self-contained Windows host executable should be present');
const publishedNames = fs.readdirSync(webRoot).sort();
assert.deepEqual(publishedNames, assets, 'native host should publish every required asset in wwwroot');

for (const name of assets) {
  const source = fs.readFileSync(name);
  const published = fs.readFileSync(path.join(webRoot, name));
  const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest(published), digest(source), `published ${name} should exactly match its source`);
}

console.log(`Native publish verified: self-contained executable (${fs.statSync(executable).size} bytes) and ${assets.length} exact wwwroot assets.`);

