const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
const declarationsStart = source.indexOf('  const STORAGE_KEY =');
const declarationsEnd = source.indexOf('  const el = id =>', declarationsStart);
const copyStart = source.indexOf('  function copy(value)');
const saveEnd = source.indexOf('  function scheduleCameraSave(', copyStart);
assert.ok(declarationsStart >= 0 && declarationsEnd > declarationsStart && copyStart >= 0 && saveEnd > copyStart, 'persistence code should remain available in app.js');

const values = new Map();
const localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value))
};
const badge = { classList: { remove() {}, add() {} }, innerHTML: '' };
let sandbox;
sandbox = { localStorage, el: () => badge, node: id => sandbox.state?.nodes.find(item => item.id === id) };
const persistenceCode = [
  source.slice(declarationsStart, declarationsEnd),
  source.slice(copyStart, saveEnd),
  'globalThis.api = { loadState, saveState, sampleNodes };'
].join('\n');
vm.runInNewContext(persistenceCode, sandbox, { filename: 'app-persistence.js' });

const defaults = sandbox.api.loadState();
assert.equal(defaults.focusId, 'root');
assert.equal(defaults.field, 'magnetic');
assert.equal(defaults.timer.remaining, 25 * 60);
defaults.nodes.find(node => node.id === 'root').name = 'modifié';
assert.equal(sandbox.api.sampleNodes.find(node => node.id === 'root').name, 'Bureau', 'defaults should be copied before mutation');

values.set('winmap-spacial-takeover-v2', '{invalid json');
assert.equal(sandbox.api.loadState().focusId, 'root', 'malformed local data should fall back to defaults');

values.set('winmap-spacial-takeover-v2', JSON.stringify({
  version: 2,
  focusId: 'missing', selectedId: 'missing', field: 'unknown', motion: .11,
  nodes: [{ id: 'root', name: 'Bureau', kind: 'root', parentId: null, orbit: 8, phase: 1.3 }],
  timer: { remaining: 'bad', running: 'yes', endsAt: 'bad' },
  camera: { yaw: 'bad', pitch: 80, distance: 80 }
}));
const migrated = sandbox.api.loadState();
assert.equal(migrated.focusId, 'root', 'missing focus should recover to the desktop');
assert.equal(migrated.selectedId, '', 'missing selection should be cleared');
assert.equal(migrated.field, 'magnetic', 'unknown visual mode should recover to its default');
assert.equal(migrated.motion, .085, 'unknown movement speed should recover to its default');
assert.ok(migrated.nodes.some(node => node.id === 'environment'), 'older state should receive the environment shell');
assert.equal(migrated.nodes.find(node => node.id === 'root').parentId, 'environment', 'legacy desktop should attach to the environment shell');
assert.equal(migrated.timer.remaining, 25 * 60);
assert.equal(migrated.timer.running, false);
assert.equal(migrated.camera.yaw, -.24);
assert.equal(migrated.camera.pitch, 1.08);
assert.equal(migrated.camera.distance, 25);

const persisted = {
  version: 2, focusId: 'outer', selectedId: 'sample-file', field: 'electric', motion: 0,
  nodes: [
    { id: 'environment', name: 'Écosystème', kind: 'folder', parentId: null },
    { id: 'root', name: 'Bureau', kind: 'root', parentId: 'environment', orbit: 4, phase: .2 },
    { id: 'outer', name: 'Coquille', kind: 'folder', parentId: null, scaleShell: true, scaleDepth: 8, orbit: 5.2, phase: 2.1 },
    { id: 'peer-a', name: 'Univers A', kind: 'folder', parentId: 'outer', generatedScope: true, scaleDepth: 9, peerLevel: true, orbit: 5.2, phase: .3 },
    { id: 'peer-b', name: 'Univers B', kind: 'folder', parentId: 'outer', generatedScope: true, scaleDepth: 9, peerLevel: true, orbit: 5.2, phase: .3 + Math.PI * 2 / 3 },
    { id: 'peer-c', name: 'Univers C', kind: 'folder', parentId: 'outer', generatedScope: true, scaleDepth: 9, peerLevel: true, orbit: 5.2, phase: .3 + Math.PI * 4 / 3 },
    { id: 'sample-file', name: 'noyau.dat', kind: 'file', parentId: 'outer', orbit: 1.4, phase: 4.2 },
    { id: 'task-progress', name: 'Équilibrer les liens', kind: 'task', parentId: 'outer', taskStatus: 'running', taskProgress: 43.6 },
    { id: 'task-invalid', name: 'Tâche à réparer', kind: 'task', parentId: 'outer', taskStatus: 'unknown', taskProgress: 'oops' },
    { id: 'peer-invalid', name: 'Atome libre', kind: 'file', parentId: 'outer', peerLevel: true, generatedScope: true, scaleDepth: 9 },
    { id: 'orphan', name: 'isolé', kind: 'file', parentId: 'missing-parent' },
    { id: 'sample-file', name: 'doublon', kind: 'file', parentId: 'outer' }
  ],
  connectedRoots: [{ id: 'drive', name: 'Dossier relié' }, { id: 5, name: 'invalide' }],
  timer: { remaining: 120, running: true, endsAt: 123456789 },
  camera: { yaw: .7, pitch: -.6, distance: 18 }
};
values.set('winmap-spacial-takeover-v2', JSON.stringify(persisted));
const restored = sandbox.api.loadState();
assert.equal(restored.focusId, 'outer');
assert.equal(restored.selectedId, 'sample-file');
assert.equal(restored.field, 'electric');
assert.equal(restored.motion, 0);
assert.equal(restored.camera.distance, 18);
assert.equal(restored.timer.remaining, 120);
assert.equal(restored.timer.running, true);
assert.deepEqual([...restored.connectedRoots].map(root => root.id), ['drive']);
assert.equal(restored.nodes.filter(node => node.id === 'sample-file').length, 1, 'duplicate saved ids should be removed');
assert.equal(restored.nodes.find(node => node.id === 'orphan').parentId, 'root', 'orphaned entries should reattach to the desktop');
assert.equal(restored.nodes.find(node => node.id === 'task-progress').taskProgress, 44, 'task progress should be rounded on restore');
assert.equal(restored.nodes.find(node => node.id === 'task-progress').taskStatus, 'running', 'valid task states should survive restore');
assert.equal(restored.nodes.find(node => node.id === 'task-invalid').taskStatus, 'queued', 'invalid task state should recover to queued');
assert.equal(restored.nodes.find(node => node.id === 'task-invalid').taskProgress, 0, 'invalid task progress should recover to zero');
assert.ok(['peer-a', 'peer-b', 'peer-c'].every(id => restored.nodes.find(node => node.id === id)?.peerLevel === true), 'same-plane peer layout should survive reload');
assert.equal(restored.nodes.find(node => node.id === 'peer-invalid').peerLevel, undefined, 'only generated folders at deep scales may keep the peer-plane flag');

sandbox.state = restored;
sandbox.state.nodes.push({ id: 'native-window-1', name: 'Titre privé', kind: 'app', ephemeral: true });
sandbox.state.selectedId = 'native-window-1';
sandbox.engine = { camera: { yaw: 1.1, pitch: .3, distanceGoal: 21 } };
sandbox.api.saveState();
const savedJson = values.get('winmap-spacial-takeover-v2');
assert.doesNotMatch(savedJson, /Titre privé|native-window-1/, 'window titles and native handles should not leak into local storage');
const roundTrip = sandbox.api.loadState();
assert.equal(roundTrip.focusId, 'outer');
assert.equal(roundTrip.nodes.find(node => node.id === 'sample-file').phase, 4.2);
assert.ok(['peer-a', 'peer-b', 'peer-c'].every(id => roundTrip.nodes.find(node => node.id === id)?.peerLevel === true), 'the shared orbital plane should survive a save/load round trip');
assert.equal(roundTrip.nodes.some(node => node.ephemeral), false, 'temporary native windows should never survive reload');
assert.equal(roundTrip.selectedId, '', 'a selected temporary window should not be persisted');
assert.equal(roundTrip.camera.yaw, 1.1, 'save should persist the live camera orientation');
assert.equal(roundTrip.camera.distance, 21, 'save should persist the live camera zoom');
console.log('Persistence checks passed: defaults, legacy migration, malformed recovery, state normalization, and save/restore round trip.');

