// Browser API doubles to exercise the dialog lifecycle and projected marker.
// Real DOM layout, GPU/browser rendering and assistive technology need separate checks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../spatial/earth-model.js');
const source = fs.readFileSync(path.join(__dirname, '../spatial/earth-view.js'), 'utf8');

function harness(earthModel) {
  const document = new EventTarget();
  let lastArc;
  const ctx = {
    createRadialGradient: () => ({ addColorStop() {} }),
    clearRect() {}, beginPath() {}, lineTo() {}, moveTo() {}, stroke() {},
    fill() {}, fillText() {}, setTransform() {}, drawImage() {},
    arc(x, y, radius) { lastArc = { x, y, radius }; },
  };
  class Element extends EventTarget {
    constructor() { super(); this.isConnected = true; this.attrs = {}; }
    focus() { document.activeElement = this; }
    getContext() { return ctx; }
    getBoundingClientRect() { return { width: 320, height: 240 }; }
    setAttribute(name, value) { this.attrs[name] = value; }
  }
  const dialog = new Element();
  const trigger = new Element();
  trigger.focus();
  const elements = new Map();
  const elem = key => {
    if (!elements.has(key)) elements.set(key, new Element());
    return elements.get(key);
  };
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; trigger.focus(); };
  const closeEvent = () => dialog.dispatchEvent(new Event('close'));
  dialog.replaceChildren = () => elements.clear();
  dialog.querySelector = elem;
  dialog.querySelectorAll = () => ['latitude', 'longitude', 'altitude', 'speed'].map(stat => {
    const element = elem(stat);
    element.dataset = { stat };
    return element;
  });
  document.getElementById = id => id === 'earth-view' ? dialog : null;
  document.createElement = () => new Element();
  const observers = new Set();
  class ResizeObserver {
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  let frameId = 0;
  const frames = new Map();
  const window = { OrbitEarthModel: earthModel };
  vm.runInNewContext(source, {
    window, document, performance: { now: () => 0 }, AbortController, ResizeObserver,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  return { document, dialog, trigger, elem, frames, observers, closeEvent, lastArc: () => lastArc, view: window.OrbitEarthView };
}

test('temps, latitude et marqueur centré suivent le même satellite', () => {
  const h = harness(model);
  h.view.open();
  assert.equal(h.frames.size, 0);
  assert.equal(h.elem('altitude').textContent, '400 km');
  h.elem('input').value = 250;
  h.elem('input').dispatchEvent(new Event('input'));
  assert.match(h.elem('latitude').textContent, /^52° N$/);
  h.elem('[data-earth-center]').dispatchEvent(new Event('click'));
  const marker = h.lastArc();
  assert.equal(marker.radius, 4.7);
  assert.ok(Math.abs(marker.x - 160) < 1e-7 && Math.abs(marker.y - 120) < 1e-7);
});

test('lecture suspendue hors écran et observation libérée à la fermeture', () => {
  const h = harness(model);
  h.view.open();
  h.elem('select').value = '120';
  h.elem('[data-earth-play]').dispatchEvent(new Event('click'));
  assert.equal(h.frames.size, 1);
  h.document.hidden = true;
  h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.frames.size, 0);
  assert.equal(h.elem('[data-earth-play]').textContent, 'Lecture');
  h.view.close();
  h.closeEvent();
  assert.equal(h.observers.size, 0);
  assert.equal(h.document.activeElement, h.trigger);
});

test('une réouverture immédiate ignore la notification de fermeture périmée', () => {
  const h = harness(model);
  h.view.open();
  h.view.close();
  h.view.open();
  h.closeEvent();
  assert.equal(h.dialog.open, true);
  assert.equal(h.observers.size, 1);
  h.view.close();
  h.closeEvent();
  assert.equal(h.observers.size, 0);
});

test('modèle absent : message, retour au cockpit et aucune boucle', () => {
  const h = harness(undefined);
  h.view.open();
  assert.match(h.elem('.earth-content').innerHTML, /indisponible/);
  assert.equal(h.elem('footer').hidden, true);
  assert.equal(h.observers.size + h.frames.size, 0);
  h.elem('[data-earth-close]').dispatchEvent(new Event('click'));
  assert.equal(h.dialog.open, false);
});
