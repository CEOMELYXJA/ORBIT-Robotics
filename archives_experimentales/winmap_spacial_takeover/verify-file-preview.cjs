const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function main() {
  const source = fs.readFileSync('app.js', 'utf8');
  const start = source.indexOf('  function clearFilePreview()');
  const end = source.indexOf('  function createNode(', start);
  assert.ok(start >= 0 && end > start, 'file preview functions should be present');
  const code = source.slice(start, end);
  const elements = {
    filePreviewImage: imageElement(), filePreviewText: textElement(), filePreviewState: textElement(),
    filePreviewTitle: textElement(), filePreviewMeta: textElement(),
    filePreviewDialog: { open: false, showModal() { this.open = true; } }
  };
  const revoked = [], files = new Map();
  let objectId = 0, resolveCalls = 0;
  const rootHandle = {
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; }
  };
  const sandbox = {
    URL: { createObjectURL() { return `blob:preview-${++objectId}`; }, revokeObjectURL(value) { revoked.push(value); } },
    Blob, Set, String, Math,
    filePreviewGeneration: 0, filePreviewObjectUrl: '',
    MAX_FILE_PREVIEW_BYTES: 512 * 1024, MAX_IMAGE_PREVIEW_BYTES: 24 * 1024 * 1024,
    TEXT_PREVIEW_EXTENSIONS: new Set(['txt', 'md', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'ini', 'log', 'html', 'css', 'js', 'ts', 'py', 'cs', 'ps1', 'sh']),
    IMAGE_PREVIEW_TYPES: new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']),
    el: id => elements[id], rootHandles: new Map([['root', rootHandle]]),
    resolvePath: async (_root, path) => { resolveCalls++; return { entry: files.get(path) }; },
    sizeLabel: size => `${size} octets`, console: { error() {} }
  };
  vm.runInNewContext(`${code}\nglobalThis.api = { openFilePreview, clearFilePreview };`, sandbox, { filename: 'app-file-preview.js' });

  const hostileName = '<script>alert(1)</script>.txt';
  files.set('notes.txt', fileHandle('file', 'texte <img src=x onerror=alert(1)>', 'text/plain'));
  await sandbox.api.openFilePreview({ kind: 'file', name: hostileName, extension: 'TXT', size: 41, sourceRootId: 'root', relativePath: 'notes.txt' });
  assert.equal(elements.filePreviewDialog.open, true, 'opening an item should show the preview dialog');
  assert.equal(elements.filePreviewTitle.textContent, hostileName, 'an untrusted file name should be displayed as text');
  assert.equal(elements.filePreviewText.textContent, 'texte <img src=x onerror=alert(1)>', 'file contents should remain text and never execute as markup');
  assert.equal(elements.filePreviewText.classList.contains('hidden'), false);
  assert.equal(elements.filePreviewState.classList.contains('hidden'), true, 'a complete text preview should clear its loading state');

  const largeContent = 'x'.repeat(512 * 1024 + 10);
  files.set('large.md', fileHandle('file', largeContent, 'text/markdown'));
  await sandbox.api.openFilePreview({ kind: 'file', name: 'large.md', extension: 'MD', size: largeContent.length, sourceRootId: 'root', relativePath: 'large.md' });
  assert.equal(elements.filePreviewText.textContent.length, 512 * 1024, 'large text files should be capped at 512 KiB');
  assert.match(elements.filePreviewState.textContent, /512 premiers KO/);
  assert.equal(revoked.length, 0, 'text previews should not retain blob URLs');

  files.set('photo.png', fileHandle('file', new Uint8Array([137, 80, 78, 71]), 'image/png'));
  await sandbox.api.openFilePreview({ kind: 'file', name: 'photo.png', extension: 'PNG', size: 4, sourceRootId: 'root', relativePath: 'photo.png' });
  assert.equal(elements.filePreviewImage.src, 'blob:preview-1', 'supported images should use a temporary object URL');
  assert.equal(elements.filePreviewImage.classList.contains('hidden'), false);
  elements.filePreviewImage.onload();
  assert.equal(elements.filePreviewState.classList.contains('hidden'), true, 'a decoded image should replace its loading state');
  sandbox.api.clearFilePreview();
  assert.deepEqual(revoked, ['blob:preview-1'], 'closing a preview should release the temporary object URL');
  assert.equal(elements.filePreviewImage.src, '', 'closing a preview should clear the local image source');

  files.set('archive.bin', fileHandle('file', new Uint8Array([1, 2, 3]), 'application/octet-stream'));
  await sandbox.api.openFilePreview({ kind: 'file', name: 'archive.bin', extension: 'BIN', size: 3, sourceRootId: 'root', relativePath: 'archive.bin' });
  assert.match(elements.filePreviewState.textContent, /Aperçu intégré disponible/);
  assert.equal(elements.filePreviewText.classList.contains('hidden'), true);
  assert.equal(elements.filePreviewImage.classList.contains('hidden'), true);

  const readsBeforeDenied = resolveCalls;
  sandbox.rootHandles.set('denied', {
    async queryPermission() { return 'prompt'; },
    async requestPermission() { return 'denied'; }
  });
  await sandbox.api.openFilePreview({ kind: 'file', name: 'private.txt', extension: 'TXT', size: 1, sourceRootId: 'denied', relativePath: 'private.txt' });
  assert.match(elements.filePreviewState.textContent, /Permission de lecture refusée/);
  assert.equal(resolveCalls, readsBeforeDenied, 'a refused read permission should stop before resolving a path');

  await sandbox.api.openFilePreview({ kind: 'file', name: 'demo.txt', extension: 'TXT', size: 10 });
  assert.match(elements.filePreviewState.textContent, /Aucun fichier physique/);
  console.log(`File preview checks passed: safe text rendering, ${512 * 1024}-byte cap, image URL cleanup, unsupported file handling, demo-only atoms, and read-permission denial.`);
}

function textElement() {
  const classes = classSet();
  return { textContent: '', classList: classes };
}
function imageElement() {
  const classes = classSet();
  return { src: '', onload: null, onerror: null, classList: classes, removeAttribute(name) { if (name === 'src') this.src = ''; } };
}
function classSet() {
  const values = new Set();
  return { add(value) { values.add(value); }, remove(value) { values.delete(value); }, contains(value) { return values.has(value); }, toggle(value, force) { if (force === undefined ? !values.has(value) : force) values.add(value); else values.delete(value); } };
}
function fileHandle(kind, content, type = '') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  return { kind, async getFile() { return blob; } };
}

main().catch(error => { console.error(error); process.exitCode = 1; });

