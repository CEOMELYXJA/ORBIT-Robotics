const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
function excerpt(startMarker, endMarker) {
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `expected app code between ${startMarker} and ${endMarker}`);
  return source.slice(start, end);
}

const code = [
  excerpt('  function taskProgress(task) {', '  function esc(text) {'),
  excerpt('  function actionsFor(n) {', '  function clearFilePreview() {')
].join('\n');
const sandbox = { state: { timer: { running: false } } };
vm.runInNewContext(`${code}\nglobalThis.api = { taskProgress, taskStatusText, toggleTask, advanceTask, actionsFor };`, sandbox, { filename: 'app-tasks.js' });

const task = { id: 'task-1', kind: 'task', name: 'Équilibrer les liens', taskStatus: 'queued', taskProgress: 0 };
assert.equal(sandbox.api.taskProgress(task), 0);
assert.equal(sandbox.api.taskStatusText(task), 'À VENIR');
assert.ok(sandbox.api.actionsFor(task).find(action => action.action === 'advance-task').disabled, 'queued work should not claim progress');
assert.equal(sandbox.api.toggleTask(task), true);
assert.equal(task.taskStatus, 'running', 'queued work should start');
assert.equal(sandbox.api.actionsFor(task).find(action => action.action === 'advance-task').disabled, '', 'running work should allow manual progress');
for (let i = 0; i < 9; i++) assert.equal(sandbox.api.advanceTask(task), true);
assert.equal(task.taskProgress, 90, 'manual progress should advance in bounded ten-percent steps');
assert.equal(task.taskStatus, 'running', 'work should remain active below 100%');
assert.equal(sandbox.api.toggleTask(task), true);
assert.equal(task.taskStatus, 'paused', 'running work should pause without losing progress');
assert.equal(sandbox.api.advanceTask(task), false, 'paused work must not advance');
assert.equal(task.taskProgress, 90, 'paused work should retain its progress');
assert.equal(sandbox.api.toggleTask(task), true);
assert.equal(task.taskStatus, 'running', 'paused work should resume');
assert.equal(sandbox.api.advanceTask(task), true);
assert.equal(task.taskProgress, 100);
assert.equal(task.taskStatus, 'completed', '100% should complete the task');
assert.equal(sandbox.api.advanceTask(task), false, 'completed work must not exceed 100%');
assert.equal(sandbox.api.toggleTask(task), true);
assert.equal(task.taskStatus, 'running', 'completed work should be restartable');
assert.equal(task.taskProgress, 0, 'restarting should clear its progress');
assert.equal(sandbox.api.taskProgress({ taskProgress: 400 }), 100, 'progress should clamp at 100%');
assert.equal(sandbox.api.taskProgress({ taskProgress: -7 }), 0, 'progress should clamp at zero');
assert.equal(sandbox.api.toggleTask({ kind: 'file' }), false, 'task controls must reject unrelated atoms');

console.log('Task checks passed: create-state actions, manual ten-percent progress, pause/resume, completion, restart, and bounds.');

