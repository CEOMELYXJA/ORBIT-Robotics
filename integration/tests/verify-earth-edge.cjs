// Test opt-in du cockpit local dans une instance Edge de test, sans caméra.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');

const integration = path.resolve(__dirname, '..');
const edge = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA]
  .filter(Boolean).map(dir => path.join(dir, 'Microsoft', 'Edge', 'Application', 'msedge.exe')).find(fs.existsSync);
const pageUrl = pathToFileURL(path.join(integration, 'spatial', 'index.html')).href + '#terre';

async function until(probe, label) {
  for (let i = 0; i < 160; i++) {
    const value = await probe();
    if (value) return value;
    await delay(125);
  }
  throw new Error('Délai dépassé : ' + label);
}

async function test() {
  assert.ok(edge, 'Microsoft Edge est requis pour ce test graphique.');
  const reports = path.join(integration, 'rapports');
  fs.mkdirSync(reports, { recursive: true });
  const profile = fs.mkdtempSync(path.join(reports, 'profil-test-terre-'));
  const browser = spawn(edge, ['--headless', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--window-size=1200,800', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, pageUrl], { stdio: 'ignore', windowsHide: true });
  let socket;
  let send;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    const port = await until(() => fs.existsSync(portFile) && Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]), 'port de test');
    const target = await until(async () => {
      const result = await fetch('http://127.0.0.1:' + port + '/json/list');
      return (await result.json()).find(t => t.type === 'page' && t.url === pageUrl);
    }, 'page du projet');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map();
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      const callback = pending.get(message.id);
      if (callback) { pending.delete(message.id); callback(message); }
    };
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method)); }, 10000);
      pending.set(id, msg => {
        clearTimeout(timeout);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
    async function read(expression) {
      const reply = await send('Runtime.evaluate', { expression, returnByValue: true });
      assert.ok(!reply.exceptionDetails, reply.exceptionDetails?.exception?.description || expression);
      return reply.result.value;
    }
    await until(() => read('document.querySelector("#earth-view")?.open && !!document.querySelector("[data-stat=altitude]")?.textContent'), 'vue Terre');
    assert.match(await read('document.querySelector("[data-stat=altitude]").textContent'), /400\s*km/);
    const pixels = () => read('document.querySelector("#earth-view canvas").toDataURL()');
    const initial = await pixels();
    await read('document.querySelector("#earth-view canvas").dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowRight",bubbles:true}))');
    assert.ok(await pixels() !== initial, 'rotation du globe dans le canevas');
    await read('document.querySelector("[data-earth-play]").click()');
    await until(() => read('Number(document.querySelector("#earth-view input").value) > 0'), 'lecture du temps simulé');
    await read('document.querySelector("[data-earth-play]").click()');
    assert.equal(await read('document.querySelector("[data-earth-play]").textContent'), 'Lecture');
    await read('document.querySelector("[data-earth-close]").click()');
    await until(() => read('!document.querySelector("#earth-view").open && !!document.querySelector("#nodeLayer .atom-label")'), 'retour à la carte Winmap');
    const clickable = await read('(() => {const b=document.querySelector("#earthButton"), r=b.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;})()');
    assert.equal(clickable, true, 'bouton Terre accessible sur la carte');
    await read('document.querySelector("#earthButton").click()');
    await until(() => read('document.querySelector("#earth-view").open && document.querySelector("[data-stat=altitude]")?.textContent.includes("400")'), 'réouverture depuis la carte');
    await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 680, deviceScaleFactor: 1, mobile: false});
    assert.equal(await read('(() => {const d=document.querySelector("#earth-view"); return d.clientWidth<=innerWidth && d.scrollWidth<=d.clientWidth+1;})()'), true, 'lecture sur écran étroit');
    console.log('PASS Edge · globe dessiné et tourné, altitude, lecture/pause, retour carte 3D, réouverture, largeur 375 px.');
  } finally {
    if (send) await send('Browser.close').catch(() => {});
    if (socket) socket.close();
    if (!send && browser.exitCode === null) browser.kill();
  }
}
test().catch(error => { console.error(error.message); process.exitCode = 1; });
