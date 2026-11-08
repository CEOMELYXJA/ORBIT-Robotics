const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
assert.match(serviceWorker, /const CACHE = 'winmap-spacial-v26'/, 'this release should invalidate the previous offline asset cache');
const launcher = fs.readFileSync('Start-Winmap.cmd', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const idSet = new Set(ids);
assert.equal(idSet.size, ids.length, 'HTML ids should be unique');
assert.ok(idSet.has('zoomOutButton'), 'the top rail should expose a direct one-level zoom-out control');
assert.ok(idSet.has('menuButton') && idSet.has('spaceMenu'), 'the spherical menu should expose its round trigger and spatial region');
assert.match(html, /menu-sphere-mark/, 'the top menu trigger should have a spherical visual');
assert.doesNotMatch(html, /menu-sphere-heading|menu-sphere-close|spaceMenuTitle|spaceMenuHint|menuClose/, 'the command globe should not include a fixed flat heading or close button');
assert.match(styles, /#universe\.is-menu-open > \.top-rail,[\s\S]*?#universe\.is-menu-open > \.bottom-rail \{ visibility: hidden; opacity: 0; pointer-events: none; \}/, 'the spherical command scene should hide the flat desktop rails and readouts');
assert.doesNotMatch(html, /class="menu-actions"|class="menu-field"|class="menu-tools"/, 'the space menu should not regress to a flat button panel');
assert.match(app, /kind:\s*'menu'[\s\S]*?menuAction:[\s\S]*?menuCore:\s*true/, 'menu actions and the central close/return control should be represented as 3D scene atoms');
assert.doesNotMatch(app, /el\(['"](?:walkButton|nativeCloseButton|nativeWindowsButton)['"]\)/, 'the spherical menu migration should not leave dead flat-menu controls in app code');

const referenced = [...app.matchAll(/\bel\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);
for (const id of referenced) assert.ok(idSet.has(id), `app.js expects an HTML element with id="${id}"`);
for (const match of html.matchAll(/\baria-controls="([^"]+)"/g)) {
  for (const id of match[1].split(/\s+/)) assert.ok(idSet.has(id), `aria-controls references missing id="${id}"`);
}
for (const match of html.matchAll(/\bdata-close="([^"]+)"/g)) assert.ok(idSet.has(match[1]), `dialog close button references missing id="${match[1]}"`);
assert.match(app, /showDirectoryPicker\(\{\s*id:\s*'winmap-root',\s*mode:\s*'read'\s*\}\)/, 'directory selection should start with read-only access');
assert.match(app, /requestPermission\(\{\s*mode:\s*'readwrite'\s*\}\)/, 'write access should be requested only for a real disk move');
assert.match(app, /el\('zoomOutButton'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{\s*closeSpaceMenu\(\{ restoreCamera: false \}\);\s*zoomOutScope\(\);\s*\}\)/, 'the top rail control should move outward by one ecosystem');
assert.match(app, /if \(state\.focusId !== 'root'\) zoomOutScope\(\)/, 'Escape should move one level outward rather than jump to the root');
assert.match(app, /if \(!el\('spaceMenu'\)\.classList\.contains\('hidden'\)\) \{ closeSpaceMenu\(\{ focusTrigger: true \}\); return; \}/, 'Escape should close the spatial menu and return keyboard focus to its round trigger');
assert.match(app, /taskStatus:\s*'queued',\s*taskProgress:\s*0/, 'new tasks should begin queued with no claimed progress');
assert.match(launcher, /start\s+""\s+"%EDGE%"\s+--user-data-dir="%EDGE_PROFILE%"[\s\S]*--app=/i, 'Windows launcher should open the app in an isolated Edge app window with a quoted profile path');
assert.match(launcher, /EDGE_PROFILE=%~dp0\.winmap-edge-profile[\s\S]*--user-data-dir="%EDGE_PROFILE%"[\s\S]*--no-first-run\s+--new-window/i, 'Windows launcher should use a persistent per-installation Edge profile and force a new app window');
assert.match(launcher, /else\s*\([\s\S]*start\s+""\s+"%~dp0index\.html"/i, 'Windows launcher should fall back to the default browser');
assert.doesNotMatch(launcher, /\btaskkill\b|\breg\s+add\b|\bSet-ItemProperty\b|\bshutdown\b/i, 'Windows launcher must not alter the desktop shell or stop other apps');
for (const match of html.matchAll(/(?:src|href)="(?!https?:|#)([^"?]+)"/g)) {
  const path = match[1].replace(/^\.\//, '');
  if (/\.(?:js|css|svg|webmanifest)$/.test(path)) assert.ok(fs.existsSync(path), `local asset ${path} should exist`);
}
const projectBase = 'https://example.github.io/winmap-spacial-takeover/';
for (const match of html.matchAll(/(?:src|href)="(?!https?:|#)([^"?]+)"/g)) {
  const asset = match[1];
  assert.ok(!asset.startsWith('/'), `asset ${asset} must stay relative for repository subpath hosting`);
  assert.ok(new URL(asset, projectBase).pathname.startsWith('/winmap-spacial-takeover/'), `asset ${asset} must resolve inside the GitHub Pages project path`);
}
assert.equal(manifest.start_url, './', 'web app start URL should be relative to the deployed project path');
assert.equal(manifest.scope, './', 'web app scope should be relative to the deployed project path');
for (const match of serviceWorker.matchAll(/['"](\.\/[^'"]+)['"]/g)) {
  assert.ok(new URL(match[1], `${projectBase}sw.js`).pathname.startsWith('/winmap-spacial-takeover/'), `service worker asset ${match[1]} must resolve inside the GitHub Pages project path`);
}
assert.match(app, /serviceWorker\.register\('\.\/sw\.js'\)/, 'service worker registration should be relative to the project path');
console.log(`Markup, deployment-path, and launcher checks passed: ${ids.length} unique ids, ${referenced.length} app references, local assets, relative GitHub Pages URLs, dialog controls, file permission boundaries, and non-invasive Windows launch.`);

