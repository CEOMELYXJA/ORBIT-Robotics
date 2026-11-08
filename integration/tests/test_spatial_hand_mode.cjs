const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'spatial', 'app.js'), 'utf8');
function excerpt(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
}
const code = [
  excerpt('  function onAtomPointerDown(', '  function findDropTarget('),
  excerpt('  function cancelGesture()', '  function placeOnOrbit(')
].join('\n');
const classes = {add(){}, remove(){}, toggle(){}};
const element = {classList:classes, dataset:{}};
const ctx = {
  handMode:true, gesture:null, cameraYawGoal:null, cameraPitchGoal:null,
  engine:{camera:{yaw:0,pitch:0},rayPlane:()=>[1,2,3]}, walkMode:false,
  node:()=>({kind:'folder'}), positions:new Map([['p',[0,0,0]]]),
  el:()=>element, nodeLayer:{querySelectorAll:()=>[]}, labelNodes:new Map(),
  canvas:{getBoundingClientRect:()=>({left:0,top:0})},
  findDropTarget:()=>'', wakeFrame:()=>{}, scheduleCameraSave:()=>{},
  prepareMove:()=>{}, placeOnOrbit:()=>{throw Error('unexpected move')}
};
vm.createContext(ctx); vm.runInContext(code, ctx);
let prevented = false;
const event = {button:0, clientX:0, clientY:0, target:{closest:()=>null},
  preventDefault:()=>{prevented=true}, stopPropagation:()=>{}, currentTarget:{setPointerCapture:()=>{}}};
ctx.onAtomPointerDown(event, 'p');
assert.equal(ctx.gesture, null, 'hand mode does not grab planets');
assert.equal(prevented, false, 'ordinary click is preserved');
ctx.handMode = false; ctx.onAtomPointerDown(event, 'p');
assert.equal(ctx.gesture.kind, 'atom', 'mouse mode keeps deliberate dragging');
ctx.cancelGesture(); assert.equal(ctx.gesture, null);
ctx.handMode = true;
ctx.gesture = {kind:'camera', startX:0,startY:0,lastX:0,lastY:0,moved:false};
ctx.onPointerMove({clientX:100,clientY:20});
assert.equal(ctx.engine.camera.yaw, 0, 'rotation is animated rather than jumping');
assert.ok(Math.abs(ctx.cameraYawGoal + .3) < 1e-9);
assert.ok(Math.abs(ctx.cameraPitchGoal - .044) < 1e-9);
ctx.cancelGesture(); assert.equal(ctx.cameraYawGoal, null);
console.log('Hand mode: click protection, opt-in dragging, smooth camera target, and cancellation passed.');

