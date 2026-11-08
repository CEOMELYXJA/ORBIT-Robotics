const assert = require('node:assert/strict');
const {supported, makeBinding} = require('../preparation/bindings.js');
assert.deepEqual(supported, ['calculatrice', 'bloc_notes']);
assert.deepEqual(makeBinding('carbone', 'calculatrice'), {nodeId:'carbone', applicationId:'calculatrice'});
assert.throws(() => makeBinding('carbone', 'C:\\arbitrary.exe'));
assert.throws(() => makeBinding('', 'calculatrice'));
console.log('Association spatiale : applications autorisées et entrées invalides vérifiées.');

