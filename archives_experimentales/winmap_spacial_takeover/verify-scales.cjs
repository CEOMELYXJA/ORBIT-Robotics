const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
function excerpt(startMarker, endMarker) {
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `expected app code between ${startMarker} and ${endMarker}`);
  return source.slice(start, end);
}
const code = [
  excerpt('  function addScalePattern(parent) {', '  function ensureScaleChildren('),
  excerpt('  function ensureScaleChildren(parent) {', '  function createOuterShell('),
  excerpt('  function createOuterShell(current) {', '  function nextImportedOrbit('),
  excerpt('  function enterNode(id) {', '  function goRoot()'),
  excerpt('  function scopeDistance(n) {', '  function goRoot()'),
  excerpt('  function zoomOutScope() {', '  function activateNode('),
  excerpt('  function activateNode(id) {', '  function enterWalkMode(')
].join('\n');

let nextId = 0, saves = 0;
let index = new Map();
const state = { nodes: [{ id: 'root', name: 'Bureau', kind: 'root', parentId: null, scaleDepth: 1 }], focusId: 'root', selectedId: '' };
const sandbox = {
  state, walkMode: false, canvas: { clientWidth: 1600, clientHeight: 900 },
  slugId: prefix => `${prefix}-${++nextId}`,
  stableNumber(text) { let hash = 2166136261; for (const char of text) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0) / 4294967295; },
  rebuildIndex() { index = new Map(state.nodes.map(node => [node.id, node])); },
  node: id => index.get(id),
  childrenOf: id => state.nodes.filter(node => node.parentId === id),
  engine: { camera: { mode: 'orbit', targetGoal: [0, 0, 0], distanceGoal: 13.3 } },
  inspector: { classList: { add() {} } },
  cameraAnchor: focus => focus, sameLevelEcosystems: () => [],
  worldPosition: () => [1, 2, 3], performance: { now: () => 0 },
  exitWalkMode() {}, renderInspector() {}, showToast() {},
  saveState() { saves++; }
};
vm.runInNewContext(`${code}\nglobalThis.api = { makeOuter: createOuterShell, addPattern: addScalePattern, zoomOutScope, activateNode };`, sandbox, { filename: 'app-scale-generation.js' });

let current = state.nodes[0];
for (let level = 2; level <= 14; level++) {
  const outer = sandbox.api.makeOuter(current);
  assert.equal(outer.scaleDepth, level, `outer shell should advance to scale ${level}`);
  assert.equal(outer.parentId, null, 'new outer shell should become the root of the visible scale chain');
  const children = state.nodes.filter(node => node.parentId === outer.id);
  assert.equal(children.length, 7, `scale ${level} should contain its inner space and six generated atoms`);
  assert.ok(children.some(node => node.id === current.id), 'the previous scale should remain linked inside its new outer shell');
  assert.equal(children.filter(node => node.kind === 'folder').length, 3 + (current.kind === 'folder' ? 1 : 0), 'each scale should reveal three related folder atoms');
  assert.equal(children.filter(node => node.kind === 'app').length, 1, 'each scale should reveal one linked application');
  assert.equal(children.filter(node => node.kind === 'file').length, 1, 'each scale should reveal one file atom');
  assert.equal(children.filter(node => node.kind === 'widget').length, 1, 'each scale should reveal one widget');
  const peers = children.filter(node => node.kind === 'folder' && node.generatedScope && node.scaleDepth === level + 1);
  if (level >= 5) {
    assert.equal(peers.length, 3, 'deep generated scopes should create three neighboring universes on the same level');
    assert.ok(peers.every(peer => peer.orbit === 5.2), 'desktop peer universes should be spaced across a medium-large orbital band');
    assert.ok(peers.every(peer => peer.peerLevel && peer.inclination === 0), 'deep peers should share one orbital plane for a readable world level');
    assert.ok(peers.every(peer => peer.speed === .012), 'same-level universes should keep a calm shared drift instead of constantly reshuffling');
    assert.ok(Math.abs((peers[1].phase - peers[0].phase) - Math.PI * 2 / 3) < 1e-9 && Math.abs((peers[2].phase - peers[1].phase) - Math.PI * 2 / 3) < 1e-9, 'deep universes should begin evenly spaced around their shared 360-degree orbit');
  }
  current = outer;
}
assert.equal(new Set(state.nodes.map(node => node.id)).size, state.nodes.length, 'generated atoms should keep unique ids');
assert.equal(saves, 0, 'shell generation should defer persistence until the focus transition is committed');

state.focusId = current.id;
const beforeClickCount = state.nodes.length;
sandbox.api.activateNode(current.id);
const clickedShell = state.nodes.find(node => node.id === state.focusId);
assert.equal(clickedShell.kind, 'folder', 'clicking the focused outer space should create a new enclosing shell');
assert.equal(clickedShell.parentId, null, 'the generated enclosure should become the new outer root');
assert.equal(current.parentId, clickedShell.id, 'the previously focused world should orbit inside the new shell');
assert.equal(state.nodes.length, beforeClickCount + 7, 'clicking outward should preserve the old world and add a six-atom shell');
assert.equal(saves, 1, 'one outward click should persist its new focus once');
assert.equal(sandbox.engine.camera.distanceGoal, 15.5, 'entering a generated outer shell should fit its larger scale');
assert.equal(state.selectedId, clickedShell.id, 'the newly entered shell should become the focus and selection');

const beforeScrollCount = state.nodes.length;
sandbox.api.zoomOutScope();
const scrolledShell = state.nodes.find(node => node.id === state.focusId);
assert.notEqual(scrolledShell.id, clickedShell.id, 'the next outward step should add another enclosing space');
assert.equal(clickedShell.parentId, scrolledShell.id, 'the previous outer space should remain nested inside it');
assert.equal(state.nodes.length, beforeScrollCount + 7, 'each additional outward step should retain its inner graph');
assert.equal(saves, 2, 'each outward transition should persist once, without duplicate serialization');

sandbox.canvas.clientWidth = 400; sandbox.canvas.clientHeight = 800;
const compactParent = { id: 'compact-shell', name: 'Mobile', kind: 'folder', scaleDepth: 5, parentId: null };
state.nodes.push(compactParent); sandbox.rebuildIndex(); sandbox.api.addPattern(compactParent);
const compactPeers = state.nodes.filter(node => node.parentId === compactParent.id && node.kind === 'folder' && node.scaleDepth === 6);
assert.equal(compactPeers.length, 3);
assert.ok(compactPeers.every(peer => peer.orbit === 2.4), 'same-level universes should fit the narrower mobile viewport');
console.log(`Scale navigation passed: 13 generated levels, spaced 3D peer universes, responsive peer framing, and click/zoom-out nesting; ${state.nodes.length} persistent atoms.`);

