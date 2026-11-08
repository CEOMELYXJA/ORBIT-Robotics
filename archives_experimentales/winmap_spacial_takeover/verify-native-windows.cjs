const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('app.js', 'utf8');
const host = fs.readFileSync('windows/Winmap.DesktopHost/MainForm.cs', 'utf8');
const launchStart = host.indexOf('private void LaunchRegisteredApplication(');
const launchEnd = host.indexOf('private static string? ValidateExecutablePath', launchStart);
assert.ok(launchStart >= 0 && launchEnd > launchStart, 'registered application launch code should be available');
const registeredAppLaunch = host.slice(launchStart, launchEnd);
const functionStart = source.indexOf('  function onNativeWindowMessage(');
const functionEnd = source.indexOf('  function createNode(', functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart, 'native window functions should be present');
const nativeFunctions = source.slice(functionStart, functionEnd);
const saveStart = source.indexOf('  function saveState()');
const saveEnd = source.indexOf('  function scheduleCameraSave(', saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart, 'state persistence should be present');
const saveFunction = source.slice(saveStart, saveEnd);

assert.match(host, /type == "list-windows"[\s\S]*ReadVisibleApplicationWindows\(out var handles\)/, 'the native host should return visible application windows on request');
assert.match(host, /JsonSerializerDefaults\.Web/, 'native response properties should use the camel-case shape expected by WebView2');
assert.match(host, /titleLength <= 0[\s\S]*processId == 0 \|\| processId == ownProcessId[\s\S]*windows\.Count < 32/, 'the native snapshot should omit untitled/system-self windows and cap the response');
assert.match(host, /IsWindowVisible\(window\)[\s\S]*GetWindowText\(window[\s\S]*process\.ProcessName/, 'the snapshot should include only visible titled windows and process names');
assert.match(host, /_knownWindows\.TryGetValue\(handle, out var expectedProcessId\)[\s\S]*currentProcessId == expectedProcessId[\s\S]*SetForegroundWindow\(handle\)/, 'focus requests must target only a window returned in the latest snapshot and still owned by its original process');
assert.match(host, /type is "choose-app" or "launch-app"[\s\S]*ChooseApplication\(core, appId\)[\s\S]*LaunchRegisteredApplication\(core, appId\)/, 'app nodes should use an explicit host message for choosing or launching a linked application');
assert.match(host, /new OpenFileDialog[\s\S]*Filter = "Applications Windows \(\*\.exe\)\|\*\.exe"/, 'application paths should be selected by the user through an executable-only picker');
assert.match(host, /registered-applications\.json[\s\S]*LoadRegisteredApplications\(\)[\s\S]*SaveRegisteredApplications\(\)/, 'app associations should persist in the local native profile');
assert.match(host, /Path\.GetExtension\(fullPath\)\.Equals\("\.exe"[\s\S]*File\.Exists\(fullPath\)/, 'registered application paths should be existing executable files');
assert.match(registeredAppLaunch, /new ProcessStartInfo[\s\S]*FileName = executable[\s\S]*WorkingDirectory = Path\.GetDirectoryName\(executable\)[\s\S]*UseShellExecute = true/, 'the native host should launch only a previously registered executable path');
assert.doesNotMatch(registeredAppLaunch, /Arguments\s*=/, 'the native host must not pass arguments to a selected executable');
assert.match(host, /new \{ nodeId = entry.Key, name = Path\.GetFileNameWithoutExtension\(entry.Value\) \}/, 'the native host should send app names to the page without exposing executable paths');
assert.match(saveFunction, /nodes:\s*state\.nodes\.filter\(item => !item\.ephemeral\)/, 'temporary native windows must not be saved');
assert.match(saveFunction, /selectedId:\s*selectedNode\?\.ephemeral\s*\?\s*''\s*:/, 'a temporary window selection must not survive reload');
assert.match(source, /n\.kind === 'app' && n\.nativeWindowHandle[\s\S]*action: 'focus-window'[\s\S]*handleInspectorAction[\s\S]*action === 'focus-window'[\s\S]*requestNativeWindowFocus\(n\)/, 'the inspector should expose a real focus action for native app windows');
assert.match(source, /action: 'windows'[\s\S]*nativeOnly: true/);
assert.match(source, /action === 'windows'[\s\S]*requestNativeWindows\(\)/, 'the native window snapshot should remain reachable from the spherical menu');
assert.match(source, /n\.nativeAppName \? 'launch-app' : 'choose-app'/, 'an app atom should offer registration first and then launch the linked program');
assert.match(source, /action === 'choose-app'[\s\S]*requestNativeAppChoice\(n\)[\s\S]*action === 'launch-app'[\s\S]*requestNativeAppLaunch\(n\)/, 'app inspector actions should use the native registration and launch protocol');

const state = { nodes: [
  { id: 'root', name: 'Bureau', kind: 'root', parentId: null },
  { id: 'documents', name: 'Documents', kind: 'folder', parentId: 'root' },
  { id: 'sample', name: 'Navigateur modèle', kind: 'app', parentId: 'root' }
], focusId: 'documents', selectedId: '' };
let index = new Map(state.nodes.map(item => [item.id, item]));
let saveCount = 0, persistedIds = [], inspectorOpened = '', toast = '';
const posted = [];
const inspector = { classList: { add() {} } };
const sandbox = {
  state, index, MAX_NATIVE_WINDOWS: 32,
  nativeWindowRequestSequence: 0, nativeWindowLatestRequestId: 'req-2',
  window: { chrome: { webview: { postMessage(message) { posted.push(message); } } } },
  node: id => index.get(id), stableNumber,
  rebuildIndex() { index = new Map(state.nodes.map(item => [item.id, item])); },
  renderInspector(id) { inspectorOpened = id; }, saveState() { saveCount++; persistedIds = state.nodes.filter(item => !item.ephemeral).map(item => item.id); },
  renderLabels() {}, inspector, showToast(message) { toast = message; }, performance: { now: () => 0 }
};
vm.runInNewContext(`${nativeFunctions}\nglobalThis.api = { onNativeWindowMessage, requestNativeWindows, requestNativeWindowFocus, requestNativeAppChoice, requestNativeAppLaunch };`, sandbox, { filename: 'app-native-windows.js' });

const beforeStaleReply = state.nodes.length;
sandbox.api.onNativeWindowMessage({ data: { type: 'windows', requestId: 'req-1', windows: [{ windowHandle: '5', title: 'Stale' }] } });
assert.equal(state.nodes.length, beforeStaleReply, 'late replies to an older window query should be ignored');

const windows = [
  { windowHandle: '101', processId: 42, application: 'chrome', title: 'Notes\u0000 · Plan' },
  { windowHandle: '101', processId: 42, application: 'chrome', title: 'Duplicate handle' },
  { windowHandle: 'bad', processId: 42, application: 'chrome', title: 'Invalid handle' }
];
for (let i = 0; i < 40; i++) windows.push({ windowHandle: String(200 + i), processId: 100 + i, application: `app-${i}`, title: `Window ${i}` });
sandbox.api.onNativeWindowMessage({ data: { type: 'windows', requestId: 'req-2', windows } });
const live = state.nodes.filter(item => item.ephemeral);
assert.equal(live.length, 32, 'native windows should be capped to 32 atoms');
assert.equal(live[0].name, 'Notes · Plan', 'control characters from window titles should be removed');
assert.equal(live[0].application, 'chrome');
assert.equal(live[0].parentId, 'root');
assert.equal(live[0].links.length, 1);
assert.equal(live[0].links[0], 'documents', 'live apps should link to the folder focused when the user requested the snapshot');
assert.equal(saveCount, 1);
assert.ok(live.every(item => !persistedIds.includes(item.id)), 'window handles and titles should stay out of persisted model nodes');
assert.equal(toast.includes('32 fenêtres'), true);

sandbox.nativeWindowLatestRequestId = '';
sandbox.api.requestNativeWindows();
assert.equal(sandbox.nativeWindowLatestRequestId, 'windows-1');
assert.equal(JSON.stringify(posted.pop()), JSON.stringify({ type: 'list-windows', requestId: 'windows-1' }));
sandbox.api.requestNativeWindowFocus(live[0]);
assert.equal(JSON.stringify(posted.pop()), JSON.stringify({ type: 'focus-window', windowHandle: '101' }));
sandbox.api.onNativeWindowMessage({ data: { type: 'focus-result', success: false } });
assert.match(toast, /Actualise la liste/);

const app = index.get('sample');
state.selectedId = 'sample';
sandbox.api.onNativeWindowMessage({ data: { type: 'registered-apps', apps: [{ nodeId: 'sample', name: 'Bloc-notes', path: 'C:\\secret\\notepad.exe' }, { nodeId: 'unknown', name: 'Unknown' }] } });
assert.equal(app.nativeAppName, 'Bloc-notes', 'the local registry should hydrate only matching app atoms');
assert.equal(Object.hasOwn(app, 'path'), false, 'an executable path should never be copied into the spatial model');
assert.equal(inspectorOpened, 'sample', 'the selected app panel should refresh after registry hydration');
sandbox.api.requestNativeAppChoice(app);
assert.equal(JSON.stringify(posted.pop()), JSON.stringify({ type: 'choose-app', nodeId: 'sample' }), 'choosing a program should send only its spatial node id');
sandbox.api.requestNativeAppLaunch(app);
assert.equal(JSON.stringify(posted.pop()), JSON.stringify({ type: 'launch-app', nodeId: 'sample' }), 'launch requests should send only a registered app node id');
sandbox.api.onNativeWindowMessage({ data: { type: 'app-choice-result', nodeId: 'sample', success: true, name: 'Paint' } });
assert.equal(app.nativeAppName, 'Paint');
assert.match(toast, /lié à « Paint »/);
sandbox.api.onNativeWindowMessage({ data: { type: 'app-launch-result', nodeId: 'sample', success: true, name: 'Paint' } });
assert.match(toast, /Paint.*lancé dans Windows/);
const postCount = posted.length;
sandbox.api.requestNativeAppLaunch(live[0]);
assert.equal(posted.length, postCount, 'temporary native-window atoms cannot be used as executable launch registrations');

console.log('Native app/window checks passed: request freshness, 32-window cap, ephemeral focus, local executable registry, path-free page messages, and explicit launch results.');

function stableNumber(text) {
  let hash = 2166136261;
  for (const character of text) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967295;
}

