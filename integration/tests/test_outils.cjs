const assert = require('node:assert/strict');
const {calculate, setup} = require('../spatial/outils.js');
assert.equal(calculate('12', '*', '3'), '36');
assert.equal(calculate('1', '/', '0'), 'Division par zéro impossible.');
assert.equal(calculate('', '+', '5'), 'Entre deux nombres.');
assert.equal(calculate('1', 'autre', '2'), 'Opération inconnue.');
const ids=['toolsDialog','toolNote','toolNoteStatus','toolCanvas','toolDrawStatus','toolCalculate','toolCalcResult','toolA','toolB','toolOperator','toolsButton'];
function element(){return {value:'',textContent:'',events:{},addEventListener(name,fn){this.events[name]=fn},showModal(){this.open=true}}}
const elements=Object.fromEntries(ids.map(id=>[id,element()]));
const canvas=elements.toolCanvas;
canvas.width=640; canvas.height=240;
canvas.getContext=()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
canvas.getBoundingClientRect=()=>({left:0,top:0,width:640,height:240});
const data=new Map();
const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
setup({getElementById:id=>elements[id]},storage);
elements.toolA.value='8'; elements.toolB.value='2'; elements.toolOperator.value='/';
elements.toolCalculate.events.click(); assert.equal(elements.toolCalcResult.textContent,'4');
elements.toolNote.value='exemple synthétique'; elements.toolNote.events.input();
assert.equal(data.get('orbit.notes.v1'),'exemple synthétique');
canvas.events.pointerdown({button:0,clientX:64,clientY:24,pointerId:1,preventDefault(){}});
canvas.events.pointermove({clientX:128,clientY:48}); canvas.events.pointerup();
assert.deepEqual(JSON.parse(data.get('orbit.dessin.v1')),[[[.1,.1],[.2,.2]]]);
elements.toolsButton.events.click(); assert.equal(elements.toolsDialog.open,true);
console.log('Outils intégrés : calcul, notes et dessin local vérifiés avec données synthétiques.');

