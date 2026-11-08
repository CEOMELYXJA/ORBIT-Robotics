const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
function excerpt(startMarker, endMarker) {
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `expected app code between ${startMarker} and ${endMarker}`);
  return source.slice(start, end);
}

const nodes = [
  { id: 'root', name: 'Bureau', kind: 'root', parentId: null },
  { id: 'drive', name: 'Documents', kind: 'folder', parentId: 'root', sourceRootId: 'drive' },
  { id: 'drive::folder', name: 'Notes', kind: 'folder', parentId: 'drive', sourceRootId: 'drive' },
  { id: 'drive::folder/kept.txt', name: 'kept.txt', kind: 'file', parentId: 'drive::folder', sourceRootId: 'drive' },
  { id: 'other', name: 'Autre', kind: 'folder', parentId: 'root' }
];
const state = { nodes, focusId: 'drive::folder', selectedId: 'drive::folder/kept.txt', connectedRoots: [{ id: 'drive' }] };
const nodeIndex = new Map();
let inspectorHidden = false;
let scanRound = 0;
let permissionRequest = 'denied', permissionQuery = 'prompt', saves = 0, syncHandle = null;
const rendered = [];
const toasts = [];
const engine = { camera: { targetGoal: [8, 8, 8], distanceGoal: 6.7 } };
const sandbox = {
  state, nodeIndex, sampleNodes: [{ id: 'environment', name: 'Écosystème', kind: 'folder', parentId: null }, ...nodes.slice(0, 2)], copy: value => JSON.parse(JSON.stringify(value)),
  rootHandles: new Map([['drive', {}]]), engine,
  saveState: () => { saves++; }, showToast: message => toasts.push(message),
  retrieveRootHandle: async id => id === 'drive' ? syncHandle : null,
  storeRootHandle: async () => {}, slugId: () => 'local-duplicate-attempt',
  inspector: { classList: {
    contains: name => name === 'hidden' && inspectorHidden,
    add: name => { if (name === 'hidden') inspectorHidden = true; },
    remove: name => { if (name === 'hidden') inspectorHidden = false; }
  } },
  performance: { now: () => 1000 },
  worldPosition: id => [id === 'drive::folder' ? 2 : 1, 0, 0],
  scopeDistance: () => 8.2,
  renderInspector: id => { rendered.push(id); inspectorHidden = false; },
  scanDirectory: async (_handle, rootId) => {
    state.nodes = state.nodes.filter(item => item.id === 'root' || item.id === rootId || item.sourceRootId !== rootId);
    state.focusId = rootId; state.selectedId = rootId;
    engine.camera.targetGoal = [1, 0, 0]; engine.camera.distanceGoal = 8.2;
    if (scanRound++ === 0) state.nodes.push(
      { id: 'drive::folder', name: 'Notes', kind: 'folder', parentId: rootId, sourceRootId: rootId },
      { id: 'drive::folder/kept.txt', name: 'kept.txt', kind: 'file', parentId: 'drive::folder', sourceRootId: rootId }
    );
  }
};
const code = [
  excerpt('  function rebuildIndex() {', '  function childrenOf('),
  excerpt('  async function refreshImportedRoot(rootId) {', '  function openCreate('),
  excerpt('  async function restoreConnectedHandles() {', '  async function getDirectoryAt('),
  excerpt('  async function importDirectoryHandle(handle) {', '  async function scanDirectory('),
  'globalThis.api = { rebuildIndex, refreshImportedRoot, refreshConnectedRoot, restoreConnectedHandles, importDirectoryHandle, node };'
].join('\n');
vm.runInNewContext(code, sandbox, { filename: 'app-refresh.js' });
sandbox.api.rebuildIndex();

(async () => {
  await sandbox.api.refreshImportedRoot('drive');
  assert.equal(state.focusId, 'drive::folder', 'a folder focus that remains after refresh should be restored');
  assert.equal(state.selectedId, 'drive::folder/kept.txt', 'a selection that remains after refresh should be restored');
  assert.deepEqual(rendered, ['drive::folder/kept.txt'], 'an open inspector should return to the selected item');
  assert.deepEqual(engine.camera.targetGoal, [2, 0, 0], 'camera targeting should return to the restored folder');
  assert.equal(engine.camera.distanceGoal, 6.7, 'camera zoom should survive a refresh');

  state.focusId = 'drive::removed-folder';
  state.selectedId = 'drive::removed-folder/gone.txt';
  inspectorHidden = false;
  engine.camera.distanceGoal = 7.1;
  await sandbox.api.refreshImportedRoot('drive');
  assert.equal(state.focusId, 'drive', 'a focus removed from disk should fall back to its connected root');
  assert.equal(state.selectedId, '', 'a selection removed from disk should be cleared');
  assert.equal(inspectorHidden, true, 'the inspector should close when its item no longer exists');
  assert.deepEqual(engine.camera.targetGoal, [1, 0, 0], 'camera targeting should follow the fallback root');
  assert.equal(engine.camera.distanceGoal, 8.2, 'fallback root should receive its default viewing distance');

  const handle = { requestPermission: async ({ mode }) => { assert.equal(mode, 'read'); return permissionRequest; } };
  sandbox.rootHandles.set('drive', handle);
  const deniedRound = scanRound;
  await sandbox.api.refreshConnectedRoot('drive');
  assert.equal(scanRound, deniedRound, 'a denied read permission should not scan or change the model');
  assert.match(toasts.at(-1), /Permission de lecture refusée/);
  permissionRequest = 'granted';
  await sandbox.api.refreshConnectedRoot('drive');
  assert.equal(scanRound, deniedRound + 1, 'a granted read permission should refresh the connected root');
  assert.equal(saves, 1, 'a successful refresh should persist the updated map');
  assert.match(toasts.at(-1), /actualisé/);

  syncHandle = {
    queryPermission: async ({ mode }) => { assert.equal(mode, 'read'); return permissionQuery; },
    requestPermission: async ({ mode }) => { assert.equal(mode, 'read'); return permissionRequest; }
  };
  sandbox.rootHandles.clear();
  const promptRound = scanRound;
  await sandbox.api.restoreConnectedHandles();
  assert.equal(sandbox.rootHandles.get('drive'), syncHandle, 'stored handles should be restored even when permission needs renewed');
  assert.equal(scanRound, promptRound, 'startup should not prompt for access without a user gesture');
  permissionQuery = 'granted';
  await sandbox.api.restoreConnectedHandles();
  assert.equal(scanRound, promptRound + 1, 'startup should silently synchronize a handle with a remembered read grant');
  assert.equal(saves, 2, 'startup synchronization should persist refreshed data');

  const storedRoots = [];
  sandbox.storeRootHandle = async id => { storedRoots.push(id); };
  const sameDirectory = { name: 'Documents renommé', isSameEntry: async other => other === syncHandle };
  await sandbox.api.importDirectoryHandle(sameDirectory);
  assert.equal(state.connectedRoots.length, 1, 'reselecting a connected directory should not add a second map root');
  assert.equal(state.nodes.filter(item => item.id === 'drive').length, 1, 'reselecting should reuse the existing spatial wrapper');
  assert.equal(state.nodes.find(item => item.id === 'drive').name, 'Documents renommé', 'the existing wrapper should adopt the current directory name');
  assert.deepEqual(storedRoots, ['drive'], 'the refreshed handle should replace the stored reference under its existing id');
  assert.equal(state.focusId, 'drive', 'reselecting a directory should enter its existing spatial root');
  assert.equal(saves, 3, 'reselecting a directory should persist its refreshed map');
  console.log('Refresh checks passed: navigation survives; removed items clear; read permission gates sync; startup refreshes remembered grants; reselecting a directory avoids duplicates.');
})().catch(error => { console.error(error); process.exitCode = 1; });

