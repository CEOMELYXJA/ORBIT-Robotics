const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const app = fs.readFileSync('app.js', 'utf8');
const intervalSource = app.match(/function frameIntervalFor\(\{ resting, interactive, motion \}\) \{[^}]+\}/)?.[0];
assert.ok(intervalSource, 'the app should define one testable frame pacing policy');
const frameIntervalFor = vm.runInNewContext(`(${intervalSource})`);

assert.equal(frameIntervalFor({ resting: true, interactive: false, motion: 0 }), 250, 'an idle scene should render four times per second');
assert.equal(frameIntervalFor({ resting: false, interactive: false, motion: .085 }), 1000 / 30, 'calm orbit mode should stay at 30 fps');
assert.equal(frameIntervalFor({ resting: false, interactive: false, motion: .16 }), 1000 / 45, 'lively orbit mode should use 45 fps');
assert.equal(frameIntervalFor({ resting: false, interactive: true, motion: 0 }), 1000 / 45, 'camera and pointer interaction should stay responsive while motion is paused');

assert.match(app, /function queueFrame\(delay = 0\)[\s\S]*document\.hidden \|\| frameTimer \|\| animationFramePending[\s\S]*window\.setTimeout/, 'the frame loop should sleep between idle frames and avoid duplicate scheduling');
assert.match(app, /function wakeFrame\(\)[\s\S]*clearTimeout\(frameTimer\)[\s\S]*queueFrame\(\)/, 'a user gesture should wake a resting renderer immediately');
assert.match(app, /function frame\(now\)[\s\S]*const list = visibleNodes\(\)[\s\S]*for \(const n of list\) worldPosition\(n\.id, seconds, cache\)[\s\S]*renderLabels\(seconds, list, menuSphere\)/, 'each frame should reuse one visible list and calculate only relevant world positions');
assert.match(app, /let childIndex = new Map\(\)[\s\S]*let appsByLink = new Map\(\)/, 'the app should keep parent and relation indexes outside the frame loop');
assert.match(app, /function childrenOf\(id\) \{ return childIndex\.get\(id\) \|\| \[\]; \}/, 'child lookup should use the precomputed hierarchy index');
assert.match(app, /for \(const id of renderedLabelIds\) if \(!alive\.has\(id\)\)[\s\S]*labelNodes\.delete\(id\)[\s\S]*renderedLabelIds = alive/, 'labels outside the current ecosystem should be released instead of accumulated');
assert.doesNotMatch(app, /for \(const \[id, atom\] of labelNodes\)/, 'the frame loop should not scan labels from every previously visited ecosystem');
assert.match(app, /atomParts\.set\(value[\s\S]*widgetValue:[\s\S]*widgetSub:[\s\S]*widgetButton:/, 'atom label sub-elements should be captured once when the label is created');
assert.match(app, /const parts = atomParts\.get\(atom\)[\s\S]*parts\.widgetName[\s\S]*parts\.name/, 'the render loop should reuse cached label elements and refresh renamed labels');
assert.doesNotMatch(app, /atom\.querySelector/, 'the render loop should not run DOM queries for every atom on every frame');
assert.match(app, /function updateWidget\(atom, n, seconds, parts\)[\s\S]*parts\.widgetValue[\s\S]*parts\.widgetSub[\s\S]*parts\.widgetButton/, 'widgets should reuse their cached value, caption and action elements');
assert.match(app, /visibilitychange[\s\S]*clearTimeout\(frameTimer\)[\s\S]*cancelAnimationFrame\(animationFrameId\)[\s\S]*lastFrameTime = 0[\s\S]*queueFrame\(\)/, 'hidden pages should stop timers and frames, then restart cleanly without a large time delta');

console.log('Frame pacing checks passed: calm 30 fps, interactive 45 fps, idle 4 fps, immediate gesture wake, one visible list per frame, and hidden-page pause.');

