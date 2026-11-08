const assert = require('node:assert/strict');
const {agents, runAgent} = require('../spatial/agents.js');
const context = {nodes:[{id:'root'},{id:'task',parentId:'root',kind:'task'}],sceneReady:true,pointerSeen:true,handMode:true,networkBlocked:true};
assert.equal(agents.length,8);
assert.equal(new Set(agents.map(a=>a.id)).size,8);
for (const agent of agents) {
  const result=runAgent(agent.id, context);
  assert.ok(result.detail && ['OK','À vérifier'].includes(result.status));
}
assert.equal(runAgent('hands', context).status,'À vérifier');
assert.equal(runAgent('pointer', {...context,pointerSeen:false}).status,'À vérifier');
assert.equal(runAgent('privacy', {...context,networkBlocked:false}).status,'À vérifier');
assert.equal(runAgent('safety', {...context,handMode:false}).status,'À vérifier');
assert.equal(runAgent('quality', {...context,nodes:[{id:'a'},{id:'a'}]}).status,'À vérifier');
assert.equal(runAgent('structure', {...context,nodes:[{id:'a',parentId:'missing'}]}).status,'À vérifier');
assert.throws(()=>runAgent('inconnu', context));
console.log('Eight local controls execute and report both success and unverified conditions.');

