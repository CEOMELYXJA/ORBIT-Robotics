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
  excerpt('  function worldPosition(', '  function visibleNodes('),
  excerpt('  function descendantsOf(id) {', '  function kindLabel('),
  excerpt('  function visibleNodes() {', '  function kindSize('),
  excerpt('  function activateNode(id) {', '  function enterWalkMode('),
  excerpt('  function onAtomClick(event, id) {', '  function onAtomPointerDown('),
  excerpt('  function onPointerMove(event) {', '  function findDropTarget('),
  excerpt('  function placeOnOrbit(id, world) {', '  function onWheel(event) {'),
  excerpt('  function canDrop(source, target) {', '  function prepareMove('),
  excerpt('  function moveInModel(sourceId, targetId) {', '  async function confirmMove() {'),
  excerpt('  function searchFold(value) {', '  function chooseSearch(id) {'),
  excerpt('  function onWheel(event) {', '  function toggleTimer('),
  excerpt('  function updateBreadcrumb(focus) {', '  function renderInspector(')
].join('\n');

const nodes = [
  { id: 'root', name: 'Bureau', kind: 'root', parentId: null },
  { id: 'docs', name: 'Documents', kind: 'folder', parentId: 'root' },
  { id: 'note', name: 'Plan', extension: 'md', kind: 'file', parentId: 'docs' },
  { id: 'downloads', name: 'Téléchargements', kind: 'folder', parentId: 'root' },
  { id: 'second-plan', name: 'Plan', extension: 'md', kind: 'file', parentId: 'downloads' },
  { id: 'projects', name: 'Projets', kind: 'folder', parentId: 'root' },
  { id: 'linked-app', name: 'Application liée', kind: 'app', parentId: 'projects', links: ['docs', 'projects'] },
  { id: 'other-app', name: 'Autre application', kind: 'app', parentId: 'root', links: ['projects'] },
  { id: 'deep-parent', name: 'Échelle 5', kind: 'folder', parentId: 'root', generatedScope: true, scaleDepth: 5 },
  { id: 'deep-a', name: 'Univers A', kind: 'folder', parentId: 'deep-parent', generatedScope: true, scaleDepth: 6, peerLevel: true, orbit: 5.2, phase: .3, speed: .012, inclination: 0 },
  { id: 'deep-b', name: 'Univers B', kind: 'folder', parentId: 'deep-parent', generatedScope: true, scaleDepth: 6, peerLevel: true, orbit: 5.2, phase: .3 + Math.PI * 2 / 3, speed: .012, inclination: 0 },
  { id: 'deep-c', name: 'Univers C', kind: 'folder', parentId: 'deep-parent', generatedScope: true, scaleDepth: 6, peerLevel: true, orbit: 5.2, phase: .3 + Math.PI * 4 / 3, speed: .012, inclination: 0 },
  { id: 'deep-child', name: 'Matière', kind: 'folder', parentId: 'deep-a', generatedScope: true, scaleDepth: 7 },
  { id: 'peer-app', name: 'Résonance', kind: 'app', parentId: 'deep-parent', generatedScope: true, links: ['deep-a', 'deep-b', 'deep-c'] }
];
const index = new Map(nodes.map(item => [item.id, item]));
const appsByLink = new Map();
const generatedPeersByLevel = new Map();
for (const item of nodes) if (item.kind === 'app') for (const linkId of item.links || []) {
  if (!appsByLink.has(linkId)) appsByLink.set(linkId, []);
  appsByLink.get(linkId).push(item);
}
for (const item of nodes) if (item.kind === 'folder' && item.generatedScope && item.parentId && Number(item.scaleDepth) >= 5) {
  const key = `${item.parentId}\u0000${item.scaleDepth}`;
  if (!generatedPeersByLevel.has(key)) generatedPeersByLevel.set(key, []);
  generatedPeersByLevel.get(key).push(item);
}
const actions = [];
const state = { nodes, focusId: 'root', selectedId: '', motion: .085 };
const breadcrumb = { dataset: {}, innerHTML: '' };
const camera = { distanceGoal: 13.3, yaw: 0, pitch: 0 };
let now = 0, cameraSaves = 0;
const sandbox = {
  state, walkMode: false, gesture: null, appsByLink, generatedPeersByLevel, labelNodes: new Map(), positions: new Map([['deep-parent', [0, 0, 0]]]), el: () => breadcrumb, esc: value => String(value),
  engine: { camera }, performance: { now: () => now }, lastShellZoomAt: 0,
  reduceMotion: { matches: false },
  node: id => index.get(id),
  childrenOf: id => nodes.filter(item => item.parentId === id),
  rebuildIndex() { index.clear(); for (const item of nodes) index.set(item.id, item); },
  enterNode: id => actions.push(['enter', id]),
  zoomOutScope: () => actions.push(['out']),
  scheduleCameraSave: () => { cameraSaves++; },
  saveState() {}, showToast() {},
  selectNode: id => actions.push(['select', id]),
  exitWalkMode: () => actions.push(['exit-walk'])
};
vm.runInNewContext(`${code}\nglobalThis.api = { worldPosition, sameLevelEcosystems, cameraAnchor, visibleNodes, activateNode, onAtomClick, onPointerMove, placeOnOrbit, moveInModel, updateBreadcrumb, searchMatches, nodePath, onWheel };`, sandbox, { filename: 'app-navigation.js' });

state.focusId = 'docs';
const visibleIds = [...sandbox.api.visibleNodes()].map(item => item.id);
assert.deepEqual(visibleIds, ['docs', 'note', 'linked-app', 'projects'], 'folder view should include direct children, related apps, and their linked targets');

state.focusId = 'deep-a';
const peerIds = [...sandbox.api.visibleNodes()].map(item => item.id);
assert.deepEqual(peerIds, ['deep-a', 'deep-parent', 'deep-b', 'deep-c', 'deep-child', 'peer-app'], 'deep views should show neighboring same-level ecosystems, the focused interior, and their shared app');
assert.deepEqual(Array.from(sandbox.api.sameLevelEcosystems(index.get('deep-a')), item => item.id), ['deep-a', 'deep-b', 'deep-c'], 'deep views should group only same-depth generated folder siblings');
assert.equal(sandbox.api.cameraAnchor(index.get('deep-a')).id, 'deep-parent', 'the deep peer view should orbit around its shared parent');
const sharedCenter = sandbox.api.worldPosition('deep-parent', 0, new Map());
const peerPositions = ['deep-a', 'deep-b', 'deep-c'].map(id => sandbox.api.worldPosition(id, 0, new Map()));
assert.ok(peerPositions.every(point => point.every(Number.isFinite)), 'each neighboring ecosystem should have a stable 3D position');
assert.ok(peerPositions.every((point, i) => Math.hypot(point[0] - sharedCenter[0], point[1] - sharedCenter[1], point[2] - sharedCenter[2]) > .9), 'neighboring ecosystems should orbit around their shared center instead of collapsing into one point');
assert.ok(peerPositions.some((point, i) => Math.hypot(point[0] - peerPositions[(i + 1) % peerPositions.length][0], point[1] - peerPositions[(i + 1) % peerPositions.length][1], point[2] - peerPositions[(i + 1) % peerPositions.length][2]) > 1), 'the deep view should expose distinct neighboring worlds across the same orbital level');
assert.ok(peerPositions.every(point => Math.abs(point[1] - sharedCenter[1]) < 1e-9), 'same-level universes should remain in one readable orbital plane');

camera.yaw = 0; camera.pitch = 0;
sandbox.gesture = { kind: 'camera', startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false };
sandbox.api.onPointerMove({ clientX: 1500, clientY: 0 });
assert.ok(camera.yaw < -Math.PI * 2, 'dragging the shared view should allow a complete 360-degree turn without a yaw clamp');
sandbox.gesture = null;

state.focusId = 'root';
sandbox.api.onAtomClick({ detail: 1, target: { closest: () => null } }, 'docs');
assert.deepEqual(actions.pop(), ['enter', 'docs'], 'single click on a folder should enter it');

state.focusId = 'docs';
sandbox.api.onAtomClick({ detail: 1, target: { closest: () => null } }, 'docs');
assert.deepEqual(actions.pop(), ['out'], 'single click on the focused center should zoom outward');

state.focusId = 'root';
sandbox.api.onAtomClick({ detail: 1, target: { closest: () => null } }, 'linked-app');
assert.deepEqual(actions.pop(), ['select', 'linked-app'], 'clicking an application should select its panel');

sandbox.api.onAtomClick({ detail: 2, target: { closest: () => null } }, 'docs');
assert.equal(actions.length, 0, 'the second click of a double click should not activate twice');

function wheel(deltaY) { let prevented = false; sandbox.api.onWheel({ deltaY, preventDefault() { prevented = true; } }); return prevented; }
state.focusId = 'root'; state.selectedId = ''; camera.distanceGoal = 19.3; now = 1000;
assert.equal(wheel(100), true, 'zoom gestures should not scroll the page');
assert.deepEqual(actions.pop(), ['out'], 'reaching the outer zoom boundary should create another scale');
assert.equal(camera.distanceGoal, 19.3, 'the shell transition should take over the boundary gesture');
now = 1001; camera.distanceGoal = 19.3;
assert.equal(wheel(100), true);
assert.equal(actions.length, 0, 'a wheel gesture should not create repeated shells during the cooldown');
assert.equal(camera.distanceGoal, 20, 'zoom should remain clamped during the shell cooldown');
now = 1702; camera.distanceGoal = 19.3;
wheel(100);
assert.deepEqual(actions.pop(), ['out'], 'the next shell should become available after the cooldown');
camera.distanceGoal = 6.3; state.selectedId = 'docs';
wheel(-100);
assert.deepEqual(actions.pop(), ['enter', 'docs'], 'zooming inward on a selected folder should enter it');
camera.distanceGoal = 6.5; state.selectedId = 'root';
wheel(-100);
assert.equal(camera.distanceGoal, 6.2, 'ordinary zoom should stop at its minimum distance');
assert.equal(cameraSaves, 2, 'each ordinary zoom should schedule persistence');
sandbox.walkMode = true; camera.distanceGoal = 10;
wheel(100);
assert.equal(camera.distanceGoal, 10, 'wheel zoom should stay disabled during first-person movement');
sandbox.walkMode = false;

index.get('root').parentId = 'docs';
sandbox.api.updateBreadcrumb(index.get('docs'));
assert.equal((breadcrumb.innerHTML.match(/data-breadcrumb=/g) || []).length, 2, 'cyclic stored parents should render a bounded breadcrumb');
index.get('root').parentId = null;

let search = sandbox.api.searchMatches('plan');
assert.equal(search.total, 2, 'search should report both objects that share a name');
assert.deepEqual(Array.from(search.results, item => item.id), ['note', 'second-plan'], 'duplicate names should remain separately searchable');
assert.deepEqual(Array.from(search.results, item => sandbox.api.nodePath(item)), ['Bureau › Documents', 'Bureau › Téléchargements'], 'duplicate names should show their distinct folder paths');
assert.equal(sandbox.api.searchMatches('documents').total, 2, 'search should match descendants through their parent path');
assert.equal(sandbox.api.searchMatches('telechargements').total, 2, 'search should ignore accents in folder paths');

for (let i = 0; i < 30; i++) {
  const item = { id: `archive-${i}`, name: `Archive ${i}`, kind: 'folder', parentId: 'root' };
  nodes.push(item); index.set(item.id, item);
}
search = sandbox.api.searchMatches('archive');
assert.equal(search.total, 30, 'search result count should include every match beyond the display limit');
assert.equal(search.results.length, 24, 'search should keep rendering bounded for large result sets');
const deepRoot = { id: 'deep-root', name: 'Écosystème 0', kind: 'folder', parentId: null, orbit: 0, phase: 0, speed: 0 };
nodes.push(deepRoot); index.set(deepRoot.id, deepRoot);
for (let i = 1; i <= 12000; i++) {
  const item = { id: `ecosystem-${i}`, name: `Écosystème ${i}`, kind: 'folder', parentId: i === 1 ? deepRoot.id : `ecosystem-${i - 1}`, orbit: 1, phase: 0, speed: 0, inclination: 0 };
  nodes.push(item); index.set(item.id, item);
}
const deepPosition = sandbox.api.worldPosition('ecosystem-12000', 0, new Map());
assert.equal(deepPosition[0], 12000, 'deep ecosystem paths should resolve iteratively without losing their nested position');
assert.equal(deepPosition[1], 0, 'deep ecosystem layers should remain stable on the vertical axis');
assert.equal(deepPosition[2], 0, 'deep ecosystem layers should remain stable on the depth axis');
const draggedPeer = index.get('deep-c');
sandbox.api.placeOnOrbit(draggedPeer.id, [2, 1, 0]);
assert.equal(draggedPeer.peerLevel, undefined, 'manually placing a peer universe should detach it from the shared orbital plane');
const reparentedPeer = index.get('deep-b');
assert.equal(sandbox.api.moveInModel(reparentedPeer.id, 'projects'), true, 'same-level peer universes should remain movable into another folder');
assert.equal(reparentedPeer.peerLevel, undefined, 'moving a peer universe to a different parent should remove the old shared-orbit grouping');
assert.equal(reparentedPeer.parentId, 'projects');
console.log('Navigation, scale controls, and search checks passed: separated 3D peer ecosystems, independent orbit edits, 360-degree drag, peer reparenting, click entry/exit, nested zoom thresholds, shell cooldown, first-person zoom lock, cyclic breadcrumbs, and path-aware duplicate search.');

