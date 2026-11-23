/* ORBIT · vue locale de l'orbite d'essai. Axes terrestres du modèle :
   x à 0° de longitude, y à 90° E, z au pôle Nord. Unité : rayon terrestre. */
(() => {
  'use strict';
  const rad = Math.PI / 180;
  const turn = 2 * Math.PI;
  const decimal = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 });
  const speedFormat = new Intl.NumberFormat('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let current = null;

  function point(longitude, latitude) {
    const lon = longitude * rad;
    const lat = latitude * rad;
    return { x: Math.cos(lat) * Math.cos(lon), y: Math.cos(lat) * Math.sin(lon), z: Math.sin(lat) };
  }

  function makeProjection(centerLon, centerLat) {
    const lon = centerLon * rad, lat = centerLat * rad;
    const sinLon = Math.sin(lon), cosLon = Math.cos(lon);
    const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
    return ({ x, y, z }) => {
      const near = x * cosLon + y * sinLon;
      return { u: y * cosLon - x * sinLon, v: near * sinLat - z * cosLat, depth: near * cosLat + z * sinLat };
    };
  }

  function sampleCurve(count, getPoint) {
    return Array.from({ length: count + 1 }, (_, i) => getPoint(i / count));
  }

  function buildGraticule() {
    const lines = [];
    for (let lon = -180; lon < 180; lon += 15) {
      lines.push({ principal: lon === 0, points: sampleCurve(48, t => point(lon, 180 * t - 90)) });
    }
    for (let lat = -75; lat < 90; lat += 15) {
      lines.push({ principal: lat === 0, points: sampleCurve(96, t => point(360 * t, lat)) });
    }
    return lines;
  }

  function visibleAboveGlobe(p) {
    return p.depth >= 0 || p.u * p.u + p.v * p.v >= 1;
  }

  function curve(ctx, layout, points, isVisible) {
    let drawing = false;
    ctx.beginPath();
    for (const point3D of points) {
      const p = layout.project(point3D);
      if (isVisible(p)) {
        const x = layout.cx + p.u * layout.r, y = layout.cy + p.v * layout.r;
        if (drawing) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        drawing = true;
      } else {
        drawing = false;
      }
    }
    ctx.stroke();
  }

  function globeBackground(ctx, layout, graticule) {
    const { cx, cy, r, width, height, project } = layout;
    ctx.clearRect(0, 0, width, height);
    const ocean = ctx.createRadialGradient(cx - .42 * r, cy - .5 * r, .08 * r, cx, cy, r);
    ocean.addColorStop(0, '#29616a');
    ocean.addColorStop(.62, '#153e4d');
    ocean.addColorStop(.95, '#0b2535');
    ocean.addColorStop(1, '#215164');
    ctx.fillStyle = ocean;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, turn);
    ctx.fill();
    ctx.strokeStyle = '#6ca7a5';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    for (const line of graticule) {
      ctx.strokeStyle = line.principal ? '#86c9bb' : '#558e915e';
      ctx.lineWidth = line.principal ? 1.25 : .8;
      curve(ctx, layout, line.points, p => p.depth >= 0);
    }
    // Selected geographic references always project with the rest of the globe.
    ctx.font = '11px "Cascadia Code", Consolas, monospace';
    ctx.fillStyle = '#c9e6e0';
    for (const [anchor, label] of [[point(0, 90), 'N'], [point(0, -90), 'S'], [point(0, 0), '0°, 0°']]) {
      const p = project(anchor);
      if (p.depth < -.001) continue;
      const x = cx + r * p.u, y = cy + r * p.v;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, turn);
      ctx.fill();
      ctx.fillText(label, x + 6, y + 13);
    }
  }

  function drawOrbit(ctx, layout, model, time, state) {
    const points = sampleCurve(180, t => model.orbitPointAt(turn * t, time));
    ctx.strokeStyle = '#bba6ff';
    ctx.lineWidth = 2;
    curve(ctx, layout, points, visibleAboveGlobe);
    const p = layout.project(state);
    if (!visibleAboveGlobe(p)) return false;
    const x = layout.cx + p.u * layout.r, y = layout.cy + p.v * layout.r;
    ctx.strokeStyle = '#ffd695ad';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, turn);
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4.7, 0, turn);
    ctx.fillStyle = '#ffd48d';
    ctx.fill();
    return true;
  }

  function direction(degrees, negative, positive) {
    return decimal.format(Math.abs(degrees)) + '°' + (Math.abs(degrees) < .05 ? '' : ' ' + (degrees < 0 ? negative : positive));
  }

  function duration(seconds) {
    const n = Math.floor(seconds);
    return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(v => String(v).padStart(2, '0')).join(':');
  }

  function run(dialog, signal) {
    const model = window.OrbitEarthModel;
    const find = s => dialog.querySelector(s);
    dialog.innerHTML = `
      <header><h2 id="earth-title">Terre et orbite</h2><button type="button" data-earth-close>Retour au cockpit</button></header>
      <div class="earth-content">
        <div class="earth-stage"><canvas tabindex="0" aria-label="Globe terrestre en trois dimensions" aria-describedby="earth-controls"></canvas></div>
        <section class="earth-facts">
          <h3>Satellite d’essai</h3>
          <p>Orbite circulaire simulée. Les coordonnées situent le point à la verticale du satellite.</p>
          <dl>
            <div><dt>Latitude</dt><dd data-stat="latitude"></dd></div>
            <div><dt>Longitude</dt><dd data-stat="longitude"></dd></div>
            <div><dt>Altitude</dt><dd data-stat="altitude"></dd></div>
            <div><dt>Vitesse inertielle</dt><dd data-stat="speed"></dd></div>
          </dl>
          <button type="button" data-earth-center>Centrer sur le satellite</button>
          <p data-earth-sight></p>
        </section>
      </div>
      <div class="earth-guide">
        <div class="earth-legend"><span><i class="earth-dot" aria-hidden="true"></i>Satellite fictif</span><span><i aria-hidden="true"></i>Orbite à l’instant affiché</span></div>
        <div id="earth-controls">Glisse sur le globe ou utilise les flèches pour le tourner. Grille de 15°. Terre et altitude à la même échelle, point satellite agrandi.</div>
      </div>
      <footer>
        <button class="earth-play" type="button" data-earth-play>Lecture</button>
        <label class="earth-timeline"><span>Temps simulé · <span data-earth-time></span></span><input type="range" min="0" max="1000" value="0" step="1" aria-label="Temps simulé sur une révolution"></label>
        <label class="earth-speed">Vitesse <select aria-label="Vitesse de lecture"><option value="1">×1</option><option value="30">×30</option><option value="120" selected>×120</option></select></label>
      </footer>`;
    dialog.setAttribute('aria-labelledby', 'earth-title');
    const listen = (element, name, fn) => element.addEventListener(name, fn, { signal });
    listen(find('[data-earth-close]'), 'click', () => dialog.close());
    // The underlying cockpit also handles shortcuts at document level.
    listen(dialog, 'keydown', e => e.stopPropagation());
    listen(dialog, 'keyup', e => e.stopPropagation());
    const canvas = find('canvas');
    const ctx = canvas.getContext('2d');
    const background = document.createElement('canvas');
    const base = background.getContext('2d');
    if (!ctx || !base || !model || typeof model.orbitPointAt !== 'function' ||
        typeof model.stateAt !== 'function' || !(model.periodSeconds > 0) || !Number.isFinite(model.periodSeconds)) {
      find('.earth-content').innerHTML = '<p class="earth-unavailable" role="status">La vue Terre est indisponible. Vérifie que le modèle orbital local est présent et que le navigateur prend en charge Canvas.</p>';
      find('.earth-guide').hidden = true;
      find('footer').hidden = true;
      return;
    }
    const play = find('[data-earth-play]'), slider = find('input'), speed = find('select');
    const timeLabel = find('[data-earth-time]'), sight = find('[data-earth-sight]');
    const stats = Object.fromEntries(Array.from(dialog.querySelectorAll('[data-stat]'), el => [el.dataset.stat, el]));
    const graticule = buildGraticule();
    let centerLon = -22, centerLat = 25, time = 0, playing = false;
    let layout, stale = true, frame = 0, lastFrame = 0, pointer = null;

    function render() {
      if (!layout) return;
      if (stale) {
        layout.project = makeProjection(centerLon, centerLat);
        globeBackground(base, layout, graticule);
        stale = false;
      }
      ctx.clearRect(0, 0, layout.width, layout.height);
      ctx.drawImage(background, 0, 0, layout.width, layout.height);
      const position = model.stateAt(time);
      const visible = drawOrbit(ctx, layout, model, time, position);
      sight.textContent = visible ? '' : 'Le satellite passe derrière la Terre.';
      stats.latitude.textContent = direction(position.latitudeDeg, 'S', 'N');
      stats.longitude.textContent = direction(position.longitudeDeg, 'O', 'E');
      stats.altitude.textContent = decimal.format(position.altitudeKm) + ' km';
      stats.speed.textContent = speedFormat.format(position.speedKmS) + ' km/s';
      slider.value = Math.round(time / model.periodSeconds * 1000);
      const clock = duration(time);
      slider.setAttribute('aria-valuetext', clock);
      timeLabel.textContent = clock;
    }

    function resize() {
      if (signal.aborted || !dialog.open) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.round(width * dpr), h = Math.round(height * dpr);
      if (layout && w === canvas.width && h === canvas.height) return;
      canvas.width = background.width = w;
      canvas.height = background.height = h;
      for (const c of [ctx, base]) c.setTransform(w / width, 0, 0, h / height, 0, 0);
      layout = { width, height, cx: width / 2, cy: height / 2, r: Math.min(width, height) * .405 };
      stale = true;
      render();
    }

    function stopPlayback() {
      playing = false;
      cancelAnimationFrame(frame);
      frame = 0;
      play.textContent = 'Lecture';
    }

    function tick(now) {
      if (!playing) return;
      if (!dialog.open || document.hidden) { stopPlayback(); return; }
      if (now - lastFrame >= 50) {
        time = Math.min(model.periodSeconds, time + (now - lastFrame) / 1000 * Number(speed.value));
        lastFrame = now;
        render();
        if (time >= model.periodSeconds) { stopPlayback(); return; }
      }
      frame = requestAnimationFrame(tick);
    }

    function orient(lon, lat) {
      centerLon = ((lon + 180) % 360 + 360) % 360 - 180;
      centerLat = Math.max(-90, Math.min(90, lat));
      stale = true;
      render();
    }

    listen(play, 'click', () => {
      if (playing) { stopPlayback(); return; }
      if (time >= model.periodSeconds) time = 0;
      playing = true;
      lastFrame = performance.now();
      play.textContent = 'Pause';
      render();
      frame = requestAnimationFrame(tick);
    });
    listen(slider, 'input', () => {
      stopPlayback();
      time = Number(slider.value) / 1000 * model.periodSeconds;
      render();
    });
    listen(find('[data-earth-center]'), 'click', () => {
      const position = model.stateAt(time);
      orient(position.longitudeDeg, position.latitudeDeg);
    });
    listen(canvas, 'keydown', e => {
      const step = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
      if (step) { e.preventDefault(); orient(centerLon + step[0], centerLat + step[1]); }
    });
    listen(canvas, 'pointerdown', e => {
      if (!e.isPrimary || e.button !== 0 || !layout) return;
      canvas.setPointerCapture(e.pointerId);
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, lon: centerLon, lat: centerLat };
    });
    listen(canvas, 'pointermove', e => {
      if (!pointer || pointer.id !== e.pointerId) return;
      const factor = 60 / layout.r;
      orient(pointer.lon - (e.clientX - pointer.x) * factor, pointer.lat + (e.clientY - pointer.y) * factor);
    });
    listen(canvas, 'lostpointercapture', () => { pointer = null; });
    listen(document, 'visibilitychange', () => { if (document.hidden) stopPlayback(); });
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    signal.addEventListener('abort', () => {
      stopPlayback();
      observer.disconnect();
      background.width = background.height = 1;
    }, { once: true });
    resize();
  }

  function open() {
    const dialog = document.getElementById('earth-view');
    if (!dialog || dialog.open) return;
    // A close event may still be queued if callers reopen in the same event loop turn.
    if (current) current.abort();
    const controller = new AbortController();
    current = controller;
    const trigger = document.activeElement;
    dialog.showModal();
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      controller.abort();
      current = null;
      dialog.replaceChildren();
      if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    }, { signal: controller.signal });
    run(dialog, controller.signal);
    dialog.querySelector('[data-earth-close]').focus({ preventScroll: true });
  }

  function close() {
    const dialog = document.getElementById('earth-view');
    if (dialog && dialog.open) dialog.close();
  }
  window.OrbitEarthView = Object.freeze({ open, close });
})();
