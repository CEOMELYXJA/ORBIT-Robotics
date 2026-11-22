// Exercise the map's real rendering and event handlers with a synthetic tree.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../spatial/app.js'), 'utf8');
function extract(a,b) { const x=source.indexOf(a), y=source.indexOf(b,x); assert.ok(x>=0 && y>x); return source.slice(x,y); }
const mapCode = extract('  function renderLocationMap(focus) {', '  function updateBreadcrumb(focus) {');
const controls = extract('    const goHistory = direction => {', "    el('agentsButton').addEventListener");
const objects = [{id:'root', name:'Bureau', kind:'root'}, ...Array.from({length:6},(_,i)=>({id:`child${i}`,name:`Planète ${i}`,kind:'folder',parentId:'root'}))];
objects.push({id:'leaf',name:'Sous-espace',kind:'folder',parentId:'child0'});
const items = new Map();
function el(id){ if(!items.has(id)) items.set(id,{dataset:{}, innerHTML:'',textContent:'',disabled:false,events:{},addEventListener(name,fn){this.events[name]=fn}}); return items.get(id); }
const ctx = {el, node:id=>objects.find(n=>n.id===id), childrenOf:id=>objects.filter(n=>n.parentId===id), esc:x=>String(x), state:{focusId:'root'}, showToast(){}};
ctx.enterNode=id=>{ctx.state.focusId=id;};
vm.createContext(ctx);
vm.runInContext("let locationHistory=['root'], locationHistoryIndex=0, locationChildPage=0, locationPeerPage=0, locationMapFocus='root';\n"+mapCode+'\n'+controls,ctx);
vm.runInContext("renderLocationMap(node('root'))",ctx);
assert.match(el('locationCurrent').innerHTML,/Niveau 0/);
assert.match(el('locationChildrenPage').textContent,/1–4\/6/);
assert.match(el('locationGraph').innerHTML,/Planète 0/);
assert.doesNotMatch(el('locationGraph').innerHTML,/Planète 5/);
el('locationNextChildren').events.click();
assert.match(el('locationChildrenPage').textContent,/5–6\/6/);
assert.match(el('locationGraph').innerHTML,/Planète 5/);
ctx.state.focusId='child0'; vm.runInContext("renderLocationMap(node('child0'))",ctx);
assert.match(el('locationPath').innerHTML,/Bureau/); assert.match(el('locationPath').innerHTML,/Planète 0/);
ctx.state.focusId='leaf'; vm.runInContext("renderLocationMap(node('leaf'))",ctx);
el('locationBack').events.click(); assert.equal(ctx.state.focusId,'child0');
el('locationForward').events.click(); assert.equal(ctx.state.focusId,'leaf');
console.log('Carte : repère, branche, pagination et retour/avancer vérifiés.');
