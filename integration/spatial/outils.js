/* Outils locaux intégrés au cockpit. Aucune connexion ni lecture de fichiers. */
(function (root) {
  'use strict';
  function calculate(a, operator, b) {
    if (String(a).trim() === '' || String(b).trim() === '') return 'Entre deux nombres.';
    const x = Number(a), y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'Entre deux nombres valides.';
    if (operator === '/' && y === 0) return 'Division par zéro impossible.';
    let result;
    switch (operator) {
      case '+': result = x + y; break;
      case '-': result = x - y; break;
      case '*': result = x * y; break;
      case '/': result = x / y; break;
      default: return 'Opération inconnue.';
    }
    return Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Résultat trop grand.';
  }

  function setup(document, storage) {
    const el = id => document.getElementById(id);
    const dialog = el('toolsDialog'), note = el('toolNote'), noteStatus = el('toolNoteStatus');
    const canvas = el('toolCanvas'), drawStatus = el('toolDrawStatus');
    const ctx = canvas.getContext('2d');
    let strokes = [], current = null, drawingWritable = true;
    try { note.value = storage.getItem('orbit.notes.v1') || ''; }
    catch { note.readOnly = true; noteStatus.textContent = 'Notes indisponibles : données conservées.'; }
    try {
      const stored = JSON.parse(storage.getItem('orbit.dessin.v1') || '[]');
      if (Array.isArray(stored)) strokes = stored;
      else { drawingWritable = false; drawStatus.textContent = 'Dessin illisible : données conservées, demande de l’aide.'; }
    } catch { drawingWritable = false; drawStatus.textContent = 'Impossible de relire le dessin : données conservées.'; }

    function render() {
      if (!ctx) { drawStatus.textContent = 'Dessin indisponible dans ce navigateur.'; return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#f5fbff';
      for (const stroke of strokes) {
        if (!Array.isArray(stroke) || !stroke.length) continue;
        ctx.beginPath();
        for (let i = 0; i < stroke.length; i++) {
          const point = stroke[i];
          if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
          if (i === 0) ctx.moveTo(point[0] * canvas.width, point[1] * canvas.height);
          else ctx.lineTo(point[0] * canvas.width, point[1] * canvas.height);
        }
        if (stroke.length === 1) ctx.lineTo(stroke[0][0] * canvas.width + .1, stroke[0][1] * canvas.height);
        ctx.stroke();
      }
    }
    function persistDrawing() {
      try { storage.setItem('orbit.dessin.v1', JSON.stringify(strokes)); drawStatus.textContent = 'Dessin sauvegardé localement.'; }
      catch { drawStatus.textContent = 'Sauvegarde impossible : garde cette fenêtre ouverte.'; }
    }
    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
    }
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !ctx || !drawingWritable) return;
      event.preventDefault(); current = [point(event)]; strokes.push(current);
      canvas.setPointerCapture?.(event.pointerId); render();
    });
    canvas.addEventListener('pointermove', event => { if (!current) return; current.push(point(event)); render(); });
    function finish() { if (current) { current = null; persistDrawing(); } }
    canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
    note.addEventListener('input', () => {
      try { storage.setItem('orbit.notes.v1', note.value); noteStatus.textContent = 'Notes sauvegardées localement.'; }
      catch { noteStatus.textContent = 'Sauvegarde impossible : garde cette fenêtre ouverte.'; }
    });
    el('toolCalculate').addEventListener('click', () => {
      el('toolCalcResult').textContent = calculate(el('toolA').value, el('toolOperator').value, el('toolB').value);
    });
    el('toolsButton').addEventListener('click', () => { render(); dialog.showModal(); });
    render();
  }
  root.OrbitTools = { calculate, setup };
  if (typeof module !== 'undefined') module.exports = root.OrbitTools;
})(typeof window !== 'undefined' ? window : globalThis);

