const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function main() {
const source = fs.readFileSync('app.js', 'utf8');
const hostSource = fs.readFileSync('windows/Winmap.DesktopHost/MainForm.cs', 'utf8');
function excerpt(startMarker, endMarker) {
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `expected app code between ${startMarker} and ${endMarker}`);
  return source.slice(start, end);
}
const eventWiring = excerpt("    el('universe').addEventListener('dragover', updateExternalDrop);", "    document.addEventListener('pointermove', onPointerMove);");
assert.match(eventWiring, /document\.addEventListener\('dragover',[\s\S]*?event\.preventDefault\(\)/, 'external drags should not navigate the page away');
assert.match(eventWiring, /document\.addEventListener\('drop',[\s\S]*?event\.preventDefault\(\)/, 'the OS drop should be handled within Winmap');
assert.ok(eventWiring.indexOf('collectExternalHandles(event.dataTransfer)') < eventWiring.indexOf('finishExternalDrop(handlesPromise, targetId)'), 'drag item handles should be acquired synchronously before asynchronous processing');
assert.match(hostSource, /AllowExternalDrop = true/, 'the Windows host must permit shell file and folder drops into WebView2');
const code = [
  excerpt('  async function getDirectoryAt(', '  async function resolvePath('),
  excerpt('  async function entryExists(', '  async function moveOnDisk('),
  excerpt('  function canExternalDrop(', '  async function refreshImportedRoot(')
].join('\n');

const nodes = [
  { id: 'connected', name: 'Documents', kind: 'folder', sourceRootId: 'root-handle', relativePath: '', readOnlyPreview: false },
  { id: 'inbox', name: 'Entrée', kind: 'folder', sourceRootId: 'root-handle', relativePath: 'Entrée', readOnlyPreview: false },
  { id: 'preview', name: 'Aperçu', kind: 'folder', sourceRootId: 'preview', readOnlyPreview: true },
  { id: 'virtual', name: 'Virtuel', kind: 'folder' },
  { id: 'not-folder', name: 'Application', kind: 'app', sourceRootId: 'root-handle' }
];
const index = new Map(nodes.map(node => [node.id, node]));
const rootHandle = memoryDirectory('Documents');
rootHandle.requestPermission = async () => 'granted';
const inbox = memoryDirectory('Entrée');
rootHandle.entries.set('Entrée', inbox);
const rootHandles = new Map([['root-handle', rootHandle]]);
const positionById = new Map([['connected', { x: 10, y: 10 }], ['inbox', { x: 100, y: 10 }]]);
let modalShown = false, pendingExternalDrop = null, pendingMove = null, saveStateCalls = 0, refreshCalls = 0;
const toasts = [], saveStatusClasses = new Set();
const elements = {
  dropPrompt: { classList: classList() }, dropPromptText: { textContent: '' },
  moveSourceGlyph: { textContent: '' }, moveTargetGlyph: { textContent: '' },
  moveTitle: { textContent: '' }, moveDescription: { textContent: '' }, moveModeNote: { innerHTML: '' },
  confirmMoveButton: { innerHTML: '' }, moveDialog: { showModal() { modalShown = true; }, close() {} },
  saveStatus: { classList: { add(value) { saveStatusClasses.add(value); }, remove(value) { saveStatusClasses.delete(value); } }, innerHTML: '' }
};
const sandbox = {
  console: { error() {} }, Blob, Promise, Map, Set, Math, Array, Uint8Array,
  visible: nodes, nodeLayer: { querySelectorAll: () => [] }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
  engine: { project: position => position }, positions: new Map(nodes.map(node => [node.id, positionById.get(node.id) || { x: 900, y: 900 }])),
  node: id => index.get(id), rootHandles, el: id => elements[id], pendingExternalDrop, pendingMove,
  glyphFor: node => node.kind === 'folder' ? '◈' : '·', showToast: message => toasts.push(message),
  setSaveBusy: text => { elements.saveStatus.classList.add('saving'); elements.saveStatus.innerHTML = text; },
  refreshImportedRoot: async () => { refreshCalls++; }, saveState: () => { saveStateCalls++; },
  requestAnimationFrame: callback => callback()
};
vm.runInNewContext(`${code}\nglobalThis.api = { canExternalDrop, findExternalDropTarget, hasExternalFiles, droppedEntryHandle, collectExternalHandles, finishExternalDrop, copyExternalDropToDestination, sameEntryTree };`, sandbox, { filename: 'app-external-drop.js' });

assert.equal(sandbox.api.canExternalDrop(nodes[0]), true, 'connected writable root should accept an external drop');
assert.equal(sandbox.api.canExternalDrop(nodes[1]), true, 'connected writable folder should accept an external drop');
assert.equal(sandbox.api.canExternalDrop(nodes[2]), false, 'read-only preview must reject external drops');
assert.equal(sandbox.api.canExternalDrop(nodes[3]), false, 'virtual folder must reject external drops');
assert.equal(sandbox.api.canExternalDrop(nodes[4]), false, 'applications must reject external drops');
assert.equal(sandbox.api.findExternalDropTarget(103, 12), 'inbox', 'nearest eligible visible directory should be selected');
assert.equal(sandbox.api.hasExternalFiles({ items: [{ kind: 'file' }] }), true);
assert.equal(sandbox.api.hasExternalFiles({ types: ['Files'] }), true);
assert.equal(sandbox.api.hasExternalFiles({ items: [{ kind: 'string' }], types: ['text/plain'] }), false);

const order = [];
const sourceFile = memoryFile('note.txt', 'spatial note');
const nativeHandle = { kind: 'file', name: 'note.txt', getFile: async () => sourceFile };
const nativeItem = {
  kind: 'file',
  getAsFileSystemHandle() { order.push('handle-called-synchronously'); return Promise.resolve(nativeHandle); },
  webkitGetAsEntry() { order.push('legacy-called-synchronously'); return null; },
  getAsFile() { order.push('file-called-synchronously'); return sourceFile; }
};
const nativeHandlesPromise = sandbox.api.collectExternalHandles({ items: [nativeItem] });
assert.deepEqual(order, ['handle-called-synchronously', 'legacy-called-synchronously', 'file-called-synchronously'], 'all drag item accessors must run synchronously inside drop');
assert.equal((await nativeHandlesPromise)[0], nativeHandle, 'File System Access handle should be preferred');

const legacyFile = memoryFile('legacy.txt', 'fallback');
const legacyEntry = {
  isFile: false, isDirectory: true, name: 'legacy-folder',
  createReader() {
    let read = false;
    return { readEntries(resolve) { if (read) resolve([]); else { read = true; resolve([{ isFile: true, isDirectory: false, name: 'legacy.txt', file(resolveFile) { resolveFile(legacyFile); } }]); } } };
  }
};
const wrappedLegacy = sandbox.api.droppedEntryHandle(legacyEntry);
const nestedLegacy = [];
for await (const child of wrappedLegacy.values()) nestedLegacy.push(child);
assert.equal(nestedLegacy[0].name, 'legacy.txt', 'legacy directory entries should be recursively readable');
assert.equal((await nestedLegacy[0].getFile()).size, legacyFile.size);

const hostileName = '<img src=x onerror=alert(1)>.txt';
await sandbox.api.finishExternalDrop(Promise.resolve([{ kind: 'file', name: hostileName }]), 'inbox');
assert.equal(modalShown, true, 'dropping onto a connected directory should ask for confirmation');
assert.equal(elements.moveTitle.textContent, `Copier « ${hostileName} » ?`, 'external names should be inserted as text, not HTML');
assert.match(elements.moveDescription.textContent, /restera à sa place/);
assert.match(elements.moveModeNote.innerHTML, /Les originaux restent intacts/);

const copiedTree = memoryDirectory('Archive');
copiedTree.entries.set('hello.txt', memoryFile('hello.txt', 'bonjour'));
copiedTree.entries.set('nested', memoryDirectory('nested'));
copiedTree.entries.get('nested').entries.set('bytes.bin', memoryFile('bytes.bin', new Uint8Array([0, 7, 255])));
await sandbox.api.copyExternalDropToDestination({ targetId: 'inbox', handles: [copiedTree] });
const copied = inbox.entries.get('Archive');
assert.ok(copied, 'external directory should be copied into the chosen folder');
assert.equal(await sandbox.api.sameEntryTree(copiedTree, copied), true, 'the destination tree should match source names, kinds, counts, and file bytes');
assert.equal((await copied.entries.get('nested').entries.get('bytes.bin').getFile()).size, 3, 'nested file bytes should be copied');
assert.equal(copiedTree.entries.get('nested').entries.has('bytes.bin'), true, 'original external directory remains untouched');
assert.equal(refreshCalls, 1, 'successful copy refreshes the connected spatial tree');
assert.equal(saveStateCalls, 1, 'successful copy persists refreshed state');
assert.match(toasts.at(-1), /originaux sont conservés/);
assert.equal(saveStatusClasses.has('saving'), false, 'save indicator is reset after copy');

const collisionSource = memoryFile('existing.txt', 'new bytes');
inbox.entries.set('existing.txt', memoryFile('existing.txt', 'old bytes'));
await sandbox.api.copyExternalDropToDestination({ targetId: 'inbox', handles: [collisionSource] });
assert.equal(await (await inbox.entries.get('existing.txt').getFile()).text(), 'old bytes', 'collisions must not overwrite existing content');
assert.match(toasts.at(-1), /existe déjà/);

let deniedCopies = 0;
rootHandle.requestPermission = async () => 'denied';
const originalGetFileHandle = inbox.getFileHandle.bind(inbox);
inbox.getFileHandle = async (...args) => { deniedCopies++; return originalGetFileHandle(...args); };
await sandbox.api.copyExternalDropToDestination({ targetId: 'inbox', handles: [memoryFile('denied.txt', 'no')] });
assert.equal(deniedCopies, 0, 'denied write permission must stop before checking or writing the destination');
assert.match(toasts.at(-1), /Permission d’écriture refusée/);
assert.equal(saveStatusClasses.has('saving'), false, 'permission rejection must not leave the save indicator busy');

console.log('External drop checks passed: connected-target filtering, synchronous drag handle capture, legacy directory fallback, safe confirmation text, recursive verified copy, collision protection, original preservation, and denied-permission handling.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });

function classList() {
  const values = new Set();
  return { add(value) { values.add(value); }, remove(value) { values.delete(value); }, toggle(value, force) { if (force === undefined ? !values.has(value) : force) values.add(value); else values.delete(value); }, contains(value) { return values.has(value); } };
}
function notFound() { const error = new Error('Not found'); error.name = 'NotFoundError'; return error; }
function memoryFile(name, content) {
  const blob = content instanceof Blob ? content : new Blob([content]);
  return { kind: 'file', name, async getFile() { return blob; } };
}
function memoryDirectory(name) {
  return {
    kind: 'directory', name, entries: new Map(), async *values() { for (const entry of this.entries.values()) yield entry; },
    async getFileHandle(childName, options = {}) {
      const existing = this.entries.get(childName);
      if (existing?.kind === 'file') return writableView(existing, this);
      if (existing) { const error = new Error('Different kind'); error.name = 'TypeMismatchError'; throw error; }
      if (options.create) { const created = memoryFile(childName, ''); this.entries.set(childName, created); return writableView(created, this); }
      throw notFound();
    },
    async getDirectoryHandle(childName, options = {}) {
      const existing = this.entries.get(childName);
      if (existing?.kind === 'directory') return existing;
      if (existing) { const error = new Error('Different kind'); error.name = 'TypeMismatchError'; throw error; }
      if (options.create) { const created = memoryDirectory(childName); this.entries.set(childName, created); return created; }
      throw notFound();
    }
  };
}
function writableView(fileHandle, parent) {
  return {
    kind: 'file', name: fileHandle.name, getFile: () => fileHandle.getFile(),
    async createWritable() {
      let contents;
      return {
        async write(blob) { contents = blob; },
        async close() { parent.entries.set(fileHandle.name, memoryFile(fileHandle.name, contents)); },
        async abort() {}
      };
    }
  };
}

