const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
const start = source.indexOf('  async function sameFileContents(');
const end = source.indexOf('  async function moveOnDisk(', start);
assert.ok(start >= 0 && end > start, 'file verification functions must remain available in app.js');
const sandbox = {};
vm.runInNewContext(`${source.slice(start, end)}\nglobalThis.verifyTree = sameEntryTree;`, sandbox, { filename: 'app-file-verification.js' });

function file(name, bytes) {
  const data = Uint8Array.from(bytes);
  return {
    kind: 'file', name,
    async getFile() {
      return {
        size: data.length,
        slice(begin, finish) {
          const part = data.slice(begin, finish);
          return { arrayBuffer: async () => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) };
        }
      };
    }
  };
}
function directory(name, children) {
  return { kind: 'directory', name, async *values() { yield* children; } };
}

(async () => {
  const sourceTree = directory('Photos', [file('a.bin', [0, 1, 2, 255]), directory('nested', [file('empty', [])])]);
  const matchingTree = directory('Photos', [directory('nested', [file('empty', [])]), file('a.bin', [0, 1, 2, 255])]);
  assert.equal(await sandbox.verifyTree(sourceTree, matchingTree), true, 'matching trees should pass regardless of enumeration order');
  assert.equal(await sandbox.verifyTree(sourceTree, directory('Photos', [file('a.bin', [0, 1, 3, 255]), directory('nested', [file('empty', [])])])), false, 'changed file bytes should fail');
  assert.equal(await sandbox.verifyTree(sourceTree, directory('Photos', [file('a.bin', [0, 1, 2, 255]), directory('nested', [file('empty', []), file('extra', [9])])])), false, 'extra destination entries should fail');
  console.log('File-tree verification passed: matching tree, changed bytes, and extra destination entry.');
})().catch(error => { console.error(error); process.exitCode = 1; });

