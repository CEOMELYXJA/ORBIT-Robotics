const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const stats = { fills: 0, strokes: 0, arcs: 0, gradients: 0 };
const context = new Proxy({
  createRadialGradient() { stats.gradients++; return { addColorStop() {} }; },
  beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {}, clip() {},
  setTransform() {}, clearRect() {}, fillRect() {}, setLineDash() {}, ellipse() {},
  fill() { stats.fills++; }, stroke() { stats.strokes++; }, arc() { stats.arcs++; }
}, { get(target, key) { return key in target ? target[key] : undefined; }, set(target, key, value) { target[key] = value; return true; } });

const canvas = {
  clientWidth: 800, clientHeight: 600, width: 0, height: 0,
  getContext(type) { return type === 'webgl2' ? null : type === '2d' ? context : null; },
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
};
global.window = { devicePixelRatio: 1 };
vm.runInThisContext(fs.readFileSync('space-engine.js', 'utf8'), { filename: 'space-engine.js' });

const engine = new window.MolecularSpace(canvas);
assert.equal(engine.fallback, true, 'the engine should switch to Canvas 2D when WebGL2 cannot initialize');
engine.camera.target = [0, 0, 0]; engine.camera.targetGoal = [0, 0, 0]; engine.camera.distanceGoal = engine.camera.distance; engine.prepareMatrices();
const center = engine.project([0, 0, 0]);
assert.ok(Math.abs(center.x - 400) < .01 && Math.abs(center.y - 300) < .01, 'the fallback should preserve center perspective projection');
const picked = engine.rayPlane(400, 300, [0, 0, 0]);
assert.ok(Math.hypot(...picked) < .001, 'the fallback camera ray should preserve drag-plane picking geometry');

const nodes = [
  { id: 'root', kind: 'root', radius: .58, color: '#edbd75', mass: 3, charge: 1, phase: 0 },
  { id: 'docs', kind: 'folder', radius: .36, color: '#87d4c2', parentId: 'root', orbit: 4.2, inclination: .3, mass: 2, charge: -1, phase: 1 },
  { id: 'app', kind: 'app', radius: .24, color: '#91b9eb', parentId: 'root', orbit: 2.5, links: ['docs'], charge: 1 }
];
const positions = new Map([['root', [0, 0, 0]], ['docs', [3.5, .4, 0]], ['app', [-2, .1, .5]]]);
engine.render({ visible: nodes, positions, mode: 'electric', selectedId: 'root', focusId: 'root', seconds: 2, motion: .7, menuSphere: { center: [0, 0, 0], radius: 2.4, color: '#93c9bc' } });
assert.ok(stats.gradients >= 4 && stats.fills >= 3 && stats.strokes > 3 && stats.arcs > 3, 'the fallback should draw a lit molecular scene, orbital paths, electrons, and the spherical menu');
const gravityStrokeCount = stats.strokes;
engine.render({ visible: nodes, positions, mode: 'gravity', selectedId: 'root', focusId: 'root', seconds: 3, motion: 0 });
assert.ok(stats.strokes >= gravityStrokeCount + 10, 'the gravity field should add a projected well and curved space grid');
const magneticStrokeCount = stats.strokes;
engine.render({ visible: nodes, positions, mode: 'magnetic', selectedId: 'root', focusId: 'root', seconds: 4, motion: .4 });
assert.ok(stats.strokes > magneticStrokeCount, 'the magnetic field should draw visible connections between linked atoms');
engine.camera.mode = 'orbit'; engine.camera.yaw = 0; engine.prepareMatrices(); const atZero = engine.project([3.5, .4, 0]);
engine.camera.yaw = Math.PI * 2; engine.prepareMatrices(); const afterFullTurn = engine.project([3.5, .4, 0]);
assert.ok(Math.abs(atZero.x - afterFullTurn.x) < .001 && Math.abs(atZero.y - afterFullTurn.y) < .001, 'one full camera turn should return to the same spatial projection');
engine.camera.mode = 'walk'; engine.camera.position = [0, 0, 0]; engine.camera.yaw = 0; engine.camera.pitch = 0; engine.prepareMatrices();
const forward = engine.project([0, 0, 3]);
assert.ok(Math.abs(forward.x - 400) < .01 && Math.abs(forward.y - 300) < .01, 'the first-person camera should project its forward axis to the viewport center');
assert.equal(canvas.width, 800, 'the software renderer should retain its CSS-pixel backing surface');
console.log('Canvas fallback checks passed: perspective camera, drag-plane picking, full 360-degree orbit, first-person projection, shaded atoms, electric/gravity/magnetic fields, and spherical menu render without WebGL2.');

