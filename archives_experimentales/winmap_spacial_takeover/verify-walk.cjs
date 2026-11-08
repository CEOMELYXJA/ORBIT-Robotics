const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
function excerpt(startMarker, endMarker) {
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `expected app code between ${startMarker} and ${endMarker}`);
  return source.slice(start, end);
}

const listeners = new Map(), windowListeners = new Map();
const classes = () => {
  const values = new Set();
  return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
};
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    classList: classes(), attributes: {}, span: { textContent: '' },
    querySelector: () => elements.get(id).span,
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  return elements.get(id);
}

const focus = { id: 'docs', name: 'Documents' };
const camera = { mode: 'orbit', yaw: .2, pitch: .1, position: [0, 0, 0], targetGoal: [0, 0, 0], distanceGoal: 13.3 };
let menuClosed = 0, saveScheduled = 0, statusRendered = 0;
const sandbox = {
  state: { focusId: focus.id }, walkMode: false, walkKeys: new Set(), gesture: null,
  positions: new Map([[focus.id, [2, 3, 4]]]),
  engine: { camera, cameraBasis: () => ({ forward: [0, 0, 1], right: [1, 0, 0] }) },
  node: id => id === focus.id ? focus : null, cameraAnchor: value => value, scopeDistance: () => 8.2,
  closeSpaceMenu: () => { menuClosed++; }, renderStatus: () => { statusRendered++; },
  scheduleCameraSave: () => { saveScheduled++; }, showToast: () => {},
  el: element, document: { activeElement: { tagName: 'BODY' }, addEventListener: (name, handler) => listeners.set(name, handler) },
  window: { addEventListener: (name, handler) => windowListeners.set(name, handler) }
};

const walkFunctions = excerpt('  function enterWalkMode() {', '  function canDrop(');
const lookFunction = excerpt('  function onPointerMove(event) {', '  function findDropTarget(');
const keyStart = source.indexOf("    document.addEventListener('keydown', event => {\n      if (!walkMode");
const blurMarker = "    window.addEventListener('blur', () => walkKeys.clear());";
const keyEnd = source.indexOf(blurMarker, keyStart) + blurMarker.length;
assert.ok(keyStart >= 0 && keyEnd > keyStart, 'walk keyboard listeners must remain available in app.js');
vm.runInNewContext(`${walkFunctions}\n${lookFunction}\nglobalThis.api = { enterWalkMode, exitWalkMode, updateWalkMovement, onPointerMove };\n${source.slice(keyStart, keyEnd)}`, sandbox, { filename: 'app-walk-mode.js' });

const keydown = listeners.get('keydown'), keyup = listeners.get('keyup'), blur = windowListeners.get('blur');
assert.equal(typeof keydown, 'function', 'walk mode should register keyboard movement');
assert.equal(typeof keyup, 'function', 'walk mode should release movement keys');
assert.equal(typeof blur, 'function', 'leaving the window should stop held movement keys');

sandbox.api.enterWalkMode();
assert.equal(camera.mode, 'walk', 'entering sleep mode should switch to first-person camera');
assert.deepEqual(Array.from(camera.position), [2, 3, 4], 'first-person camera should begin inside the focused space');
assert.equal(menuClosed, 1, 'entering first person should close the space menu');
assert.equal(statusRendered, 1, 'entering first person should refresh the mode status');

function key(name) {
  let prevented = false;
  keydown({ key: name, preventDefault() { prevented = true; } });
  return () => prevented;
}
function release(name) { keyup({ key: name }); }

let prevented = key('w');
assert.equal(prevented(), true, 'movement keys should not scroll the page');
sandbox.api.updateWalkMovement(.06);
assert.ok(Math.abs(camera.position[2] - 4.192) < 1e-9, 'W should move forward');
release('w');

key('d'); sandbox.api.updateWalkMovement(.06);
assert.ok(camera.position[0] > 2 && camera.position[1] === 3, 'D should strafe to the right'); release('d');
const beforeLeft = camera.position[0];
key('a'); sandbox.api.updateWalkMovement(.06);
assert.ok(camera.position[0] < beforeLeft, 'A should strafe to the left'); release('a');
key('s'); sandbox.api.updateWalkMovement(.06);
assert.ok(camera.position[2] < 4.192, 'S should move backward'); release('s');
key('q'); sandbox.api.updateWalkMovement(.06);
assert.ok(camera.position[1] < 3, 'Q should descend'); release('q');
const beforeAscend = camera.position[1];
key('e'); sandbox.api.updateWalkMovement(.06);
assert.ok(camera.position[1] > beforeAscend, 'E should ascend'); release('e');

key('w'); key('d');
const beforeDiagonal = [...camera.position]; sandbox.api.updateWalkMovement(.06);
assert.ok(Math.abs(camera.position[0] - beforeDiagonal[0] - .192 / Math.sqrt(2)) < 1e-9, 'diagonal movement should be normalized');
assert.ok(Math.abs(camera.position[2] - beforeDiagonal[2] - .192 / Math.sqrt(2)) < 1e-9, 'diagonal movement should not be faster');
blur(); assert.equal(sandbox.walkKeys.size, 0, 'window blur should clear held movement keys');

const yaw = camera.yaw, pitch = camera.pitch;
sandbox.walkMode = true;
sandbox.gesture = { kind: 'camera', startX: 10, startY: 10, lastX: 10, lastY: 10, moved: false };
sandbox.api.onPointerMove({ clientX: 30, clientY: 20 });
assert.ok(camera.yaw < yaw && camera.pitch > pitch, 'dragging should rotate the first-person view');

const heldBeforeInput = sandbox.walkKeys.size;
sandbox.document.activeElement = { tagName: 'INPUT' };
prevented = key('a');
assert.equal(prevented(), false, 'typing into a text field should remain available');
assert.equal(sandbox.walkKeys.size, heldBeforeInput, 'typing should not move the camera');
sandbox.document.activeElement = { tagName: 'BODY' };
key('x'); assert.equal(sandbox.walkKeys.size, heldBeforeInput, 'unmapped keys should not move the camera');

sandbox.api.exitWalkMode();
assert.equal(camera.mode, 'orbit', 'leaving sleep mode should restore orbit camera');
assert.deepEqual(Array.from(camera.targetGoal), [2, 3, 4], 'orbit should return to the focused space');
assert.equal(camera.distanceGoal, 8.2, 'orbit distance should return to the focused scale');
assert.equal(saveScheduled, 1, 'returning to orbit should persist the camera');
assert.equal(element('walkHud').classList.contains('hidden'), true, 'the walk HUD should close on exit');
assert.equal(element('universe').classList.contains('is-walking'), false, 'first-person styling should be removed on exit');

console.log('Walk-mode checks passed: first-person entry, WASD/QE movement, normalized diagonals, input focus, blur safety, mouse look, orbit return, and camera save.');

