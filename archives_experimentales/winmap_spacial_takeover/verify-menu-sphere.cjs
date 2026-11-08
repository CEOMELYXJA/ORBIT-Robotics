const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
function extractObject(name, endMarker) {
  const start = source.indexOf(`  const ${name} = `);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${name} source should be available`);
  return vm.runInNewContext(`(${source.slice(start + `  const ${name} = `.length, end).trim().replace(/;$/, '')})`);
}
function extractFunctions(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `source block ${startMarker} should be available`);
  return source.slice(start, end);
}

const fields = extractObject('FIELDS', '\n  const FIELD_EXPLANATIONS');
const explanations = extractObject('FIELD_EXPLANATIONS', '\n  const SPACE_MENU_VIEWS');
const views = extractObject('SPACE_MENU_VIEWS', '\n\n  const sampleNodes');
const menuFunctions = extractFunctions('  function spaceMenuOpen()', '  function worldPosition(');
const facingFunction = extractFunctions('  function sphericalMenuPointIsBehind(', '  function renderLabels(');
const classList = () => {
  const values = new Set(['hidden']);
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value),
    toggle(value, force = !values.has(value)) { force ? values.add(value) : values.delete(value); return force; }
  };
};
const elements = new Map();
const focusCallbacks = [];
const labelNodes = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { classList: classList(), attributes: {}, textContent: '', showModal() { this.open = true; }, setAttribute(key, value) { this.attributes[key] = value; }, focus(options) { this.focusOptions = options; } });
  return elements.get(id);
}

const state = { focusId: 'root', selectedId: '', field: 'magnetic', motion: .085 };
let walkMode = false, createParentId = '', sphericalMenuView = 'main', sphericalMenuNodes = [], sphericalMenuRestoreDistance = null;
let saved = 0, cameraSaves = 0, wakeCount = 0, openedCreate = null, searchOpened = 0, windowsRequested = 0, walked = 0, zoomedOut = 0, rooted = 0, toast = '', posted = [];
const engine = { camera: { mode: 'orbit', distance: 13.3, distanceGoal: 13.3, targetGoal: [0, 0, 0], fov: 48 } };
const sandbox = {
  state, engine, canvas: { clientWidth: 1280, clientHeight: 720 }, labelNodes,
  inspector: { classList: classList() },
  el: element,
  node: id => ({ id, kind: 'root' }),
  worldPosition: () => [1, 2, 3],
  performance: { now: () => 1000 },
  requestAnimationFrame: callback => { focusCallbacks.push(callback); return focusCallbacks.length; },
  wakeFrame: () => { wakeCount++; },
  scheduleCameraSave: () => { cameraSaves++; },
  saveState: () => { saved++; },
  showToast: message => { toast = message; },
  showSearch: () => { searchOpened++; },
  openCreate: (kind, parentId) => { openedCreate = { kind, parentId }; },
  enterWalkMode: () => { walked++; walkMode = true; },
  exitWalkMode: () => { walkMode = false; },
  zoomOutScope: () => { zoomedOut++; },
  goRoot: () => { rooted++; },
  requestNativeWindows: () => { windowsRequested++; },
  window: { chrome: undefined }
};
const setup = `
  const SPACE_MENU_VIEWS = ${JSON.stringify(views)};
  const FIELDS = ${JSON.stringify(fields)};
  const FIELD_EXPLANATIONS = ${JSON.stringify(explanations)};
  let walkMode = false, createParentId = '', sphericalMenuView = 'main', sphericalMenuNodes = [], sphericalMenuNodeIndex = new Map(), sphericalMenuRestoreDistance = null, sphericalMenuTriggerId = 'menuButton';
  ${menuFunctions}
  ${facingFunction}
  globalThis.api = { setSphericalMenuView, openSpaceMenu, closeSpaceMenu, toggleSphericalMenu, sphericalMenuRadius, sphericalMenuPosition, sphericalMenuPointIsBehind, activateSphericalMenuAction, getState: () => ({ walkMode, createParentId, sphericalMenuView, sphericalMenuNodes, sphericalMenuRestoreDistance, sphericalMenuTriggerId }) };
`;
vm.runInNewContext(setup, sandbox, { filename: 'spherical-menu-runtime.js' });

sandbox.api.setSphericalMenuView('main');
let current = sandbox.api.getState();
assert.equal(current.sphericalMenuNodes.length, 7, 'web mode should include six focused commands and a spherical close core');
assert.ok(current.sphericalMenuNodes.every(item => item.kind === 'menu' && item.menuAction), 'each visible command should be represented by a menu atom');
const core = current.sphericalMenuNodes.find(item => item.menuCore);
assert.equal(core.name, 'Espace', 'the menu title should be a central 3D command atom');
assert.equal(core.menuAction, 'menu-close', 'the central sphere should close the command globe');
assert.equal(core.radius, .72, 'the medium-large spherical nucleus should be larger than individual menu atoms');
assert.equal(current.sphericalMenuNodes.filter(item => !item.menuCore).length, 6, 'the six web commands should occupy the 360-degree shell');
assert.equal(current.sphericalMenuNodes.filter(item => !item.menuCore).map(item => item.menuAction).join(','), 'explore,settings,walk,zoom-out,home,create', 'the main command globe should lead with the two organized spatial menus');
assert.match(source, /cache\.set\(item\.id, item\.menuCore \? center : sphericalMenuPosition/, 'the nucleus should be placed at the live 3D center while commands use the spherical surface');
assert.equal(new Set(current.sphericalMenuNodes.map(item => item.id)).size, current.sphericalMenuNodes.length, 'each menu atom should have a unique live id');
assert.match(source, /const compact = canvas\.clientWidth <= 760;\s*return n\.menuCore \? \(compact \? 66 : 78\) : \(compact \? 50 : 58\);/, 'menu labels should use medium-large desktop spheres and scale down on compact screens');
assert.match(styles, /\.menu-trigger \{ width: 64px; height: 64px;/, 'the Espace launcher should be visibly spherical and medium-large');
assert.match(styles, /\.settings-trigger \{ width: 60px; height: 60px;/, 'the Réglages launcher should match the spherical Espace control');
assert.match(styles, /\.atom-label\.kind-menu\.menu-core \.atom-cap \{ --node-size: 78px;/, 'the main command atom should read as a substantial sphere');

const radius = sandbox.api.sphericalMenuRadius();
assert.ok(radius > 3 && radius <= 3.35, 'desktop menu globe should occupy a medium-large spherical area');
const center = [1, 2, 3], first = sandbox.api.sphericalMenuPosition(0, 8, center, radius, 0, .03), moved = sandbox.api.sphericalMenuPosition(0, 8, center, radius, 8, .03);
assert.ok(Math.abs(Math.hypot(first[0] - center[0], first[1] - center[1], first[2] - center[2]) - radius) < 1e-9, 'every menu command should lie on the same spherical surface');
assert.notDeepEqual(first, moved, 'the menu globe should have a slow spatial drift when motion is enabled');
assert.equal(sandbox.api.sphericalMenuPointIsBehind([0, 0, -1], [0, 0, 0], [0, 0, 10], 1), true, 'commands on the far hemisphere should be hidden from view');
assert.equal(sandbox.api.sphericalMenuPointIsBehind([0, 0, 1], [0, 0, 0], [0, 0, 10], 1), false, 'commands on the near hemisphere should remain interactive');

sandbox.api.openSpaceMenu();
assert.equal(element('spaceMenu').classList.contains('hidden'), false, 'opening the menu should expose its command globe');
assert.equal(element('universe').classList.contains('is-menu-open'), true, 'opening the menu should focus the scene on the command globe');
assert.equal(engine.camera.targetGoal.join(','), '1,2,3', 'the globe should be centered on the current ecosystem');
assert.equal(engine.camera.distanceGoal, 14.5, 'the camera should pull back enough to see the command globe');
let focusOptions = null;
labelNodes.set('menu-main-core', { focus: options => { focusOptions = options; } });
assert.ok(focusCallbacks.length, 'opening the globe should schedule spatial keyboard focus');
focusCallbacks.shift()();
assert.equal(focusOptions?.preventScroll, true, 'the center sphere should receive focus without moving the page');
sandbox.api.activateSphericalMenuAction('menu-close', { keyboard: true });
assert.equal(element('spaceMenu').classList.contains('hidden'), true, 'closing the menu should remove the globe');
assert.equal(engine.camera.distanceGoal, 13.3, 'closing the menu should restore the previous camera distance');
assert.equal(cameraSaves, 1, 'restored camera distance should persist');
focusCallbacks.shift()();
assert.equal(element('menuButton').focusOptions?.preventScroll, true, 'keyboard closure should return focus to the round launcher');

sandbox.api.openSpaceMenu('settings', 'settingsButton');
current = sandbox.api.getState();
assert.equal(current.sphericalMenuView, 'settings', 'the corner settings sphere should open its spatial settings view directly');
assert.equal(current.sphericalMenuNodes.length, 5, 'settings should present four controls on the same spherical surface and a return core');
assert.equal(current.sphericalMenuNodes.filter(item => !item.menuCore).map(item => item.menuAction).join(','), 'field-magnetic,field-gravity,field-electric,motion', 'the settings globe should expose the three physical fields and motion control');
assert.equal(element('settingsButton').attributes['aria-expanded'], 'true', 'the settings launcher should report its own expanded globe');
assert.equal(element('menuButton').attributes['aria-expanded'], 'false', 'the unrelated space launcher should remain collapsed');
sandbox.api.closeSpaceMenu({ focusTrigger: true });
focusCallbacks.shift()();
focusCallbacks.shift()();
assert.equal(element('settingsButton').focusOptions?.preventScroll, true, 'keyboard closure should restore focus to the settings launcher that opened the globe');

sandbox.api.toggleSphericalMenu('main', 'menuButton');
assert.equal(sandbox.api.getState().sphericalMenuView, 'main', 'the space launcher should open the main globe');
sandbox.api.toggleSphericalMenu('settings', 'settingsButton');
assert.equal(sandbox.api.getState().sphericalMenuView, 'settings', 'clicking the other corner sphere should switch directly to its settings globe');
assert.equal(sandbox.api.getState().sphericalMenuTriggerId, 'settingsButton', 'switching corner spheres should update the active launcher');
sandbox.api.toggleSphericalMenu('main', 'menuButton');
assert.equal(sandbox.api.getState().sphericalMenuView, 'main', 'clicking the space sphere from settings should switch back without closing the globe');
sandbox.api.toggleSphericalMenu('main', 'menuButton');
assert.equal(element('spaceMenu').classList.contains('hidden'), true, 'clicking the already active corner sphere should close the globe');

sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('explore');
current = sandbox.api.getState();
assert.equal(current.sphericalMenuView, 'explore', 'the Explorer atom should open a second spherical menu view');
assert.equal(current.sphericalMenuNodes.filter(item => !item.menuCore).map(item => item.menuAction).join(','), 'search,connect', 'Explorer should keep search and local folders inside its spherical menu');
sandbox.api.activateSphericalMenuAction('menu-main');
assert.equal(sandbox.api.getState().sphericalMenuView, 'main', 'the Explorer core should return to the Espace globe');

sandbox.api.openSpaceMenu();
sandbox.api.closeSpaceMenu();
engine.camera.distanceGoal = 21;
sandbox.api.openSpaceMenu();
assert.equal(engine.camera.distanceGoal, 14.5, 'opening the globe from a distant camera should restore its consistent medium-large framing');
sandbox.api.closeSpaceMenu();
assert.equal(engine.camera.distanceGoal, 21, 'closing the globe should restore a previously distant camera');
engine.camera.distanceGoal = 13.3;

sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('fields');
assert.equal(sandbox.api.getState().sphericalMenuView, 'fields', 'the physical-field submenu should replace the main globe');
assert.equal(sandbox.api.getState().sphericalMenuNodes.length, 4, 'the field globe should expose three phenomena and a central return sphere');
sandbox.api.activateSphericalMenuAction('menu-main');
assert.equal(sandbox.api.getState().sphericalMenuView, 'main', 'the return atom should restore the main command globe');
sandbox.api.activateSphericalMenuAction('fields');
for (const [field, explanation] of [
  ['magnetic', /lignes montrent les liens.*analogie visuelle/],
  ['gravity', /espaces riches en objets.*métaphore visuelle/],
  ['electric', /polarités fictives.*charge électrique/]
]) {
  sandbox.api.activateSphericalMenuAction(`field-${field}`);
  assert.equal(state.field, field, `the ${field} atom should switch the active field`);
  assert.match(toast, explanation, `the ${field} atom should explain its visual analogy`);
  assert.equal(element('spaceMenu').classList.contains('hidden'), true, 'choosing a field should return to the scene');
  if (field !== 'electric') { sandbox.api.openSpaceMenu(); sandbox.api.activateSphericalMenuAction('fields'); }
}
assert.equal(saved, 3);

sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('create');
assert.equal(sandbox.api.getState().createParentId, 'root', 'the create globe should remember the focused parent');
assert.equal(sandbox.api.getState().sphericalMenuNodes.length, 6, 'the creation globe should expose five atom types and a central return sphere');
sandbox.api.activateSphericalMenuAction('create-task');
assert.deepEqual(openedCreate, { kind: 'task', parentId: 'root' }, 'the task atom should open creation in the focused ecosystem');
assert.equal(element('spaceMenu').classList.contains('hidden'), true, 'choosing an atom type should close the command globe');

sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('motion');
assert.equal(state.motion, .16, 'the motion atom should cycle the scene rhythm');
assert.equal(saved, 4);
assert.match(toast, /vivant/);
sandbox.api.closeSpaceMenu({ restoreCamera: false });
sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('search');
assert.equal(searchOpened, 1, 'the search atom should open instant search');
assert.equal(element('spaceMenu').classList.contains('hidden'), true, 'opening search should close the command globe');
sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('connect');
assert.equal(element('connectDialog').open, true, 'the connect atom should open the local-folder permission explanation');
assert.equal(element('spaceMenu').classList.contains('hidden'), true, 'opening folder connection should close the command globe');
sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('walk');
assert.equal(walked, 1, 'the sleep atom should enter first-person exploration');
assert.equal(element('spaceMenu').classList.contains('hidden'), true, 'first-person exploration should close the command globe');
sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('zoom-out');
assert.equal(zoomedOut, 1, 'the outer-ecosystem atom should zoom outward');
sandbox.api.openSpaceMenu();
sandbox.api.activateSphericalMenuAction('home');
assert.equal(rooted, 1, 'the Bureau atom should return to the root');
sandbox.window.chrome = { webview: { postMessage: message => posted.push(message) } };
sandbox.api.setSphericalMenuView('main');
assert.equal(sandbox.api.getState().sphericalMenuNodes.length, 9, 'native mode should reveal eight commands around the same central sphere');
sandbox.api.activateSphericalMenuAction('windows');
assert.equal(windowsRequested, 1, 'native window snapshots should stay reachable from the globe');
sandbox.api.activateSphericalMenuAction('close');
assert.deepEqual(posted, ['close'], 'the native close atom should send one ordinary close request');

console.log('Spherical menu runtime checks passed: Espace, Explorer, direct settings launch, keyboard focus restore, physical controls, creation, camera restore, 3D positions, back-face hiding, motion, and native host messages.');

