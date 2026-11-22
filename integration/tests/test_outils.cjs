const assert = require('node:assert/strict');
const {calculate, setup} = require('../spatial/outils.js');
assert.equal(calculate('12','*','3'),'36');
assert.equal(calculate('1','/','0'),'Division par zéro impossible.');
const ids=['calcDialog','notesDialog','drawDialog','calcButton','notesButton','drawButton','calcDisplay','calcKeys','clearDrawing','toolNote','toolNoteStatus','toolCanvas','toolDrawStatus'];
function element(){return {value:'',textContent:'',events:{},addEventListener(name,fn){this.events[name]=fn},show(){this.open=true}}}
const e=Object.fromEntries(ids.map(id=>[id,element()]));
const canvas=e.toolCanvas; canvas.width=640; canvas.height=240;
canvas.getContext=()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
canvas.getBoundingClientRect=()=>({left:0,top:0,width:640,height:240});
const data=new Map(); const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
setup({getElementById:id=>e[id]},storage);
function press(key){e.calcKeys.events.click({target:{closest:()=>({dataset:{key}})}})}
press('8');press('/');press('2');press('=');assert.equal(e.calcDisplay.textContent,'4');
press('C');press('1');press('/');press('0');press('=');assert.equal(e.calcDisplay.textContent,'Division par zéro impossible.');
e.toolNote.value='exemple synthétique'; e.toolNote.events.input(); assert.equal(data.get('orbit.notes.v1'),'exemple synthétique');
canvas.events.pointerdown({button:0,clientX:64,clientY:24,pointerId:1,preventDefault(){}});
canvas.events.pointermove({clientX:128,clientY:48});canvas.events.pointerup();
const drawing=data.get('orbit.dessin.v1');assert.deepEqual(JSON.parse(drawing),[[[.1,.1],[.2,.2]]]);
e.clearDrawing.events.click();assert.equal(data.get('orbit.dessin.v1'),'[]');assert.ok([...data.entries()].some(([k,v])=>k.startsWith('orbit.dessin.archive.')&&v===drawing));
for(const [button,dialog] of [['calcButton','calcDialog'],['notesButton','notesDialog'],['drawButton','drawDialog']]){e[button].events.click();assert.equal(e[dialog].open,true)}
console.log('Outils séparés, calcul, notes et effacement avec copie locale : OK.');
