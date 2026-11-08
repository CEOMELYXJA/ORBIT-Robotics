const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

let nextBuffer = 0;
const stats = { draws: 0, innerShellAlpha: false, menuShellAlpha: false, pointBufferResized: false, batchLineVertices: 0, sphereInstanceCounts: [] };
let boundBuffer = null, pointBuffer = null;
const gl = new Proxy({
  VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
  ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 6, STATIC_DRAW: 7, DYNAMIC_DRAW: 8,
  DEPTH_TEST: 9, LEQUAL: 10, BLEND: 11, SRC_ALPHA: 12, ONE_MINUS_SRC_ALPHA: 13,
  COLOR_BUFFER_BIT: 1, DEPTH_BUFFER_BIT: 2, TRIANGLES: 14, UNSIGNED_SHORT: 15,
  LINE_LOOP: 16, LINE_STRIP: 17, FLOAT: 18, POINTS: 19, LINES: 20,
  createShader: () => ({}), shaderSource() {}, compileShader() {}, getShaderParameter: () => true, getShaderInfoLog: () => '',
  createProgram: () => ({}), attachShader() {}, linkProgram() {}, getProgramParameter: () => true, getProgramInfoLog: () => '',
  getAttribLocation: (_program, name) => ({ aPosition: 0, aNormal: 1, aPhase: 2 })[name] ?? 3,
  getUniformLocation: (_program, name) => name,
  createBuffer: () => ({ id: ++nextBuffer }),
  createVertexArray: () => ({}), bindVertexArray() {}, vertexAttribDivisor() {},
  drawElements() { stats.draws++; },
  drawElementsInstanced(_mode, _count, _type, _offset, instanceCount) { stats.draws++; stats.sphereInstanceCounts.push(instanceCount); },
  drawArrays(mode, _first, count) { stats.draws++; if (mode === 20) stats.batchLineVertices += count; },
  uniform1f(location, value) {
    if (location !== 'uAlpha') return;
    if (Math.abs(value - 0.075) < 1e-6) stats.innerShellAlpha = true;
    if (Math.abs(value - 0.045) < 1e-6) stats.menuShellAlpha = true;
  },
  viewport() {},
  bufferData(_target, size, usage) { if (boundBuffer === pointBuffer && usage === 8 && typeof size === 'number' && size > 16384) stats.pointBufferResized = true; },
  bufferSubData() {}, bindBuffer(_target, buffer) { boundBuffer = buffer; }, enableVertexAttribArray() {}, vertexAttribPointer() {},
  enable() {}, depthFunc() {}, blendFunc() {}, clearColor() {}, clear() {}, depthMask() {},
  uniformMatrix4fv() {}, uniform3fv() {}, uniform3f() {}
}, { get(target, key) { return key in target ? target[key] : () => {}; } });

const canvas = { clientWidth: 800, clientHeight: 600, width: 0, height: 0, getContext: () => gl };
global.window = { devicePixelRatio: 1 };
vm.runInThisContext(fs.readFileSync('space-engine.js', 'utf8'), { filename: 'space-engine.js' });
const engine = new window.MolecularSpace(canvas);
assert.equal(window.MolecularSpace.pixelRatioFor(1920, 1080, 1), 1, 'ordinary 1080p displays should retain native CSS-pixel rendering');
assert.equal(window.MolecularSpace.pixelRatioFor(1920, 1080, 2), 1.25, 'high-DPI desktop rendering should retain its existing 1.25 density cap');
const fourKRatio = window.MolecularSpace.pixelRatioFor(3840, 2160, 1);
assert.ok(fourKRatio < 1 && 3840 * 2160 * fourKRatio * fourKRatio <= 6_000_000.01, 'large 4K viewports should keep the WebGL drawing surface within the six-megapixel budget');
assert.equal(window.MolecularSpace.pixelRatioFor(800, 600, 2), 1.25, 'smaller windows should not lose pixels to the area budget');
pointBuffer = engine.pointBuffer;
const orbitAlphas = [];
const appendBatchPath = engine.appendBatchPath.bind(engine), submitBatchLines = engine.submitBatchLines.bind(engine);
engine.appendBatchPath = (_vertices, _count, _color, alpha) => orbitAlphas.push(alpha);
engine.submitBatchLines = () => {};
const nodes = [
  { id: 'root', kind: 'root', radius: .58, color: '#edbd75', parentId: null, mass: 3, charge: 1, phase: 0 },
  { id: 'docs', kind: 'folder', radius: .36, color: '#87d4c2', parentId: 'root', orbit: 4, inclination: .2, mass: 2, charge: 1, phase: .2 },
  { id: 'app', kind: 'app', radius: .25, color: '#76cce3', parentId: 'root', orbit: 2, links: ['docs'], phase: .4, charge: -1 },
  { id: 'widget', kind: 'widget', radius: .25, color: '#e6c990', parentId: 'root', orbit: 5, phase: 1, charge: 1 },
  { id: 'peer-a', kind: 'folder', radius: .25, color: '#88cfbd', parentId: 'root', orbit: 5.2, phase: 0, speed: .012, peerLevel: true, scaleDepth: 6 },
  { id: 'peer-b', kind: 'folder', radius: .25, color: '#a99bff', parentId: 'root', orbit: 5.2, phase: Math.PI * 2 / 3, speed: .012, peerLevel: true, scaleDepth: 6 },
  { id: 'peer-c', kind: 'folder', radius: .25, color: '#e8b68c', parentId: 'root', orbit: 5.2, phase: Math.PI * 4 / 3, speed: .012, peerLevel: true, scaleDepth: 6 }
];
const positions = new Map([['root', [0, 0, 0]], ['docs', [4, 0, 0]], ['app', [0, 2, 0]], ['widget', [-5, 0, 0]], ['peer-a', [5.2, 0, 0]], ['peer-b', [-2.6, 0, 4.5]], ['peer-c', [-2.6, 0, -4.5]]]);
engine.drawOrbits(nodes, positions, new Float32Array(16), 'magnetic');
assert.equal(orbitAlphas.length, 4, 'deep peer universes should share one guide while ordinary folders, apps, and widgets retain their individual orbits');
assert.ok(Math.max(...orbitAlphas) <= .026, 'orbital guide alpha should remain subdued in magnetic mode');
engine.appendBatchPath = appendBatchPath;
engine.submitBatchLines = submitBatchLines;

for (const mode of ['magnetic', 'gravity', 'electric']) {
  const before = stats.draws;
  engine.render({ visible: nodes, allNodes: nodes, positions, mode, selectedId: 'root', focusId: 'root', seconds: 3, motion: .34 });
  const frameDraws = stats.draws - before;
  assert.ok(frameDraws > 0, `${mode} mode should submit WebGL draw calls`);
  assert.ok(frameDraws < 12, `${mode} mode should keep a small scene within a bounded draw count`);
}

const menuAtoms = [
  { id: 'menu-core', kind: 'menu', menuCore: true, radius: .62, color: '#b9e3d8' },
  { id: 'menu-a', kind: 'menu', radius: .34, color: '#8bd8c5' },
  { id: 'menu-b', kind: 'menu', radius: .34, color: '#a99bff' }
];
const menuPositions = new Map(positions);
menuPositions.set('menu-core', [0, 0, 0]); menuPositions.set('menu-a', [2, 2, 0]); menuPositions.set('menu-b', [-2, -2, 0]);
const baselineLines = stats.batchLineVertices;
engine.render({ visible: nodes, allNodes: nodes, positions, mode: 'electric', selectedId: 'root', focusId: 'root', seconds: 3.5, motion: 0 });
const linesWithoutMenu = stats.batchLineVertices - baselineLines;
const menuLinesStart = stats.batchLineVertices;
engine.render({ visible: [...nodes, ...menuAtoms], allNodes: nodes, positions: menuPositions, mode: 'electric', selectedId: 'root', focusId: 'root', seconds: 3.5, motion: 0, menuSphere: { center: [0, 0, 0], radius: 2.5 } });
assert.equal(stats.batchLineVertices - menuLinesStart - linesWithoutMenu, 480, 'the command globe should render five subtle 48-segment spherical guides through one batched draw');
assert.equal(stats.menuShellAlpha, true, 'the command globe should include a translucent 3D sphere rendered by the workspace sphere shader');
assert.equal(stats.sphereInstanceCounts.at(-1), nodes.length + menuAtoms.length, 'the nucleus and command atoms should use the same instanced 3D sphere renderer as the workspace');

engine.camera.mode = 'walk';
engine.camera.position = [0, 0, 0];
engine.render({ visible: nodes, allNodes: nodes, positions, mode: 'magnetic', selectedId: 'root', focusId: 'root', walkMode: true, seconds: 4, motion: .34 });
assert.ok(stats.draws > 0, 'walk mode should submit WebGL draw calls');
assert.equal(stats.innerShellAlpha, true, 'walk mode should render the translucent inner shell');

const denseNodes = [nodes[0]], densePositions = new Map([['root', [0, 0, 0]]]);
for (let i = 0; i < 220; i++) {
  const id = `folder-${i}`;
  denseNodes.push({ id, kind: 'folder', radius: .2, color: '#87d4c2', parentId: 'root', orbit: 1 + i * .01, phase: i * .1, charge: -1 });
  densePositions.set(id, [Math.cos(i) * (1 + i * .01), 0, Math.sin(i) * (1 + i * .01)]);
}
const denseDrawStart = stats.draws, lineVertexStart = stats.batchLineVertices;
engine.camera.mode = 'orbit';
engine.render({ visible: denseNodes, allNodes: denseNodes, positions: densePositions, mode: 'electric', selectedId: 'root', focusId: 'root', seconds: 5, motion: .34 });
const denseElectricDraws = stats.draws - denseDrawStart;
assert.equal(stats.pointBufferResized, true, 'dense electric field should grow the electron buffer safely');
assert.equal(stats.sphereInstanceCounts.at(-1), denseNodes.length, 'dense folders should render as one instanced sphere batch');
for (let i = 0; i < denseNodes.length; i++) assert.equal(engine.sphereInstanceScratch[i * 9 + 8], 1, 'ordinary space atoms should remain opaque');
assert.equal(stats.batchLineVertices - lineVertexStart, 221 * 32 * 2, 'dense orbital rings and the selected-object ring should render through batched line calls');
assert.ok(stats.draws - denseDrawStart < 12, 'a dense frame should use a bounded number of GPU draw calls');
const magneticDrawStart = stats.draws;
engine.render({ visible: denseNodes, allNodes: denseNodes, positions: densePositions, mode: 'magnetic', selectedId: 'root', focusId: 'root', seconds: 6, motion: .34 });
assert.ok(stats.draws - magneticDrawStart < 12, 'a dense magnetic frame should batch links and electron pulses');
console.log(`Renderer smoke passed: ${stats.draws} draw calls total; dense electric frame uses ${denseElectricDraws}, magnetic frame ${stats.draws - magneticDrawStart}; 220 orbital rings and 221 spheres batch correctly.`);

