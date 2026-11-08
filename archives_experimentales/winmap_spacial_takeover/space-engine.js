(() => {
  const VERTEX = `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    uniform mat4 uMvp;
    uniform mat4 uModel;
    out vec3 vNormal;
    out vec3 vWorld;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorld = world.xyz;
      vNormal = mat3(uModel) * aNormal;
      gl_Position = uMvp * vec4(aPosition, 1.0);
    }`;
  const FRAGMENT = `#version 300 es
    precision highp float;
    in vec3 vNormal;
    in vec3 vWorld;
    uniform vec3 uColor;
    uniform vec3 uLight;
    uniform vec3 uEye;
    uniform float uGlow;
    uniform float uAlpha;
    out vec4 color;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 lightDir = normalize(uLight - vWorld);
      vec3 viewDir = normalize(uEye - vWorld);
      float diffuse = max(dot(n, lightDir), 0.0);
      float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.4);
      float spec = pow(max(dot(reflect(-lightDir, n), viewDir), 0.0), 24.0);
      vec3 lit = uColor * (0.2 + diffuse * 0.86 + rim * uGlow * 0.82);
      lit += vec3(0.84, 0.94, 0.91) * spec * 0.3;
      color = vec4(lit, uAlpha);
    }`;
  const BATCH_LINE_VERTEX = `#version 300 es
    in vec3 aPosition;
    in vec4 aColor;
    uniform mat4 uMvp;
    out vec4 vColor;
    void main() { vColor = aColor; gl_Position = uMvp * vec4(aPosition, 1.0); }`;
  const BATCH_LINE_FRAGMENT = `#version 300 es
    precision highp float;
    in vec4 vColor;
    out vec4 color;
    void main() { color = vColor; }`;
  const INSTANCE_VERTEX = `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    in vec3 aInstanceOffset;
    in vec3 aInstanceColor;
    in float aInstanceRadius;
    in float aInstanceGlow;
    in float aInstanceAlpha;
    uniform mat4 uViewProjection;
    out vec3 vNormal;
    out vec3 vWorld;
    out vec3 vColor;
    out float vGlow;
    out float vAlpha;
    void main() {
      vWorld = aInstanceOffset + aPosition * aInstanceRadius;
      vNormal = aNormal;
      vColor = aInstanceColor;
      vGlow = aInstanceGlow;
      vAlpha = aInstanceAlpha;
      gl_Position = uViewProjection * vec4(vWorld, 1.0);
    }`;
  const INSTANCE_FRAGMENT = `#version 300 es
    precision highp float;
    in vec3 vNormal;
    in vec3 vWorld;
    in vec3 vColor;
    in float vGlow;
    in float vAlpha;
    uniform vec3 uLight;
    uniform vec3 uEye;
    out vec4 color;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 lightDir = normalize(uLight - vWorld);
      vec3 viewDir = normalize(uEye - vWorld);
      float diffuse = max(dot(n, lightDir), 0.0);
      float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.4);
      float spec = pow(max(dot(reflect(-lightDir, n), viewDir), 0.0), 24.0);
      vec3 lit = vColor * (0.2 + diffuse * 0.86 + rim * vGlow * 0.82);
      lit += vec3(0.84, 0.94, 0.91) * spec * 0.3;
      color = vec4(lit, vAlpha);
    }`;
  const POINT_VERTEX = `#version 300 es
    in vec3 aPosition;
    in float aPhase;
    uniform mat4 uMvp;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uSize;
    out float vTwinkle;
    void main() {
      gl_Position = uMvp * vec4(aPosition, 1.0);
      float depthScale = clamp(13.0 / max(1.0, gl_Position.w), 0.35, 2.1);
      vTwinkle = 0.52 + 0.48 * sin(uTime * 0.72 + aPhase);
      gl_PointSize = uPixelRatio * uSize * depthScale * (0.82 + vTwinkle * 0.36);
    }`;
  const POINT_FRAGMENT = `#version 300 es
    precision highp float;
    uniform vec3 uColor;
    uniform float uAlpha;
    in float vTwinkle;
    out vec4 color;
    void main() {
      vec2 p = gl_PointCoord - vec2(0.5);
      float d = length(p);
      float glow = smoothstep(0.5, 0.03, d);
      float core = smoothstep(0.19, 0.0, d);
      color = vec4(uColor, uAlpha * glow * (0.55 + vTwinkle * 0.28 + core * 0.42));
    }`;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: a => { const d = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / d, a[1] / d, a[2] / d]; }
  };
  const colorCache = new Map();
  function identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function multiply(a, b) {
    const out = new Float32Array(16);
    return multiplyInto(out, a, b);
  }
  function multiplyInto(out, a, b) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return out;
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far), out = new Float32Array(16);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
    return out;
  }
  function lookAt(eye, target, worldUp) {
    const z = v3.norm(v3.sub(eye, target));
    const x = v3.norm(v3.cross(worldUp, z));
    const y = v3.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3.dot(x, eye), -v3.dot(y, eye), -v3.dot(z, eye), 1]);
  }
  function shader(gl, type, source) {
    const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value) || 'Erreur de shader WebGL');
    return value;
  }
  function program(gl, vertex, fragment) {
    const value = gl.createProgram(); gl.attachShader(value, shader(gl, gl.VERTEX_SHADER, vertex)); gl.attachShader(value, shader(gl, gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(value);
    if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(value) || 'Erreur de programme WebGL');
    return value;
  }
  function color3(hex) {
    const raw = String(hex || '#81d8c4').replace('#', '');
    if (colorCache.has(raw)) return colorCache.get(raw);
    const n = parseInt(raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw, 16) || 0x81d8c4;
    const color = new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
    colorCache.set(raw, color);
    return color;
  }

  class MolecularSpace {
    static pixelRatioFor(width, height, devicePixelRatio = 1) {
      const cssWidth = Number.isFinite(Number(width)) ? Math.max(1, Number(width)) : 1;
      const cssHeight = Number.isFinite(Number(height)) ? Math.max(1, Number(height)) : 1;
      const requested = Number.isFinite(Number(devicePixelRatio)) && Number(devicePixelRatio) > 0 ? Number(devicePixelRatio) : 1;
      const pixelBudgetRatio = Math.sqrt(6_000_000 / (cssWidth * cssHeight));
      return Math.min(requested, 1.25, pixelBudgetRatio);
    }
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'high-performance' });
      if (!this.gl) return new CanvasSpaceFallback(canvas);
      this.camera = { mode: 'orbit', yaw: -0.24, pitch: 0.25, distance: 13.3, position: [0, 0, 0], target: [0, 0, 0], targetGoal: [0, 0, 0], fov: 48 };
      this.pixelRatio = 1;
      this.time = 0;
      this.matrices = null;
      this.modelScratch = identity();
      this.mvpScratch = new Float32Array(16);
      this.sphere = program(this.gl, VERTEX, FRAGMENT);
      this.batchLine = program(this.gl, BATCH_LINE_VERTEX, BATCH_LINE_FRAGMENT);
      this.instanceSphere = program(this.gl, INSTANCE_VERTEX, INSTANCE_FRAGMENT);
      this.points = program(this.gl, POINT_VERTEX, POINT_FRAGMENT);
      this.sphereLocations = this.locations(this.sphere, ['aPosition', 'aNormal', 'uMvp', 'uModel', 'uColor', 'uLight', 'uEye', 'uGlow', 'uAlpha']);
      this.batchLineLocations = this.locations(this.batchLine, ['aPosition', 'aColor', 'uMvp']);
      this.instanceSphereLocations = this.locations(this.instanceSphere, ['aPosition', 'aNormal', 'aInstanceOffset', 'aInstanceColor', 'aInstanceRadius', 'aInstanceGlow', 'aInstanceAlpha', 'uViewProjection', 'uLight', 'uEye']);
      this.pointLocations = this.locations(this.points, ['aPosition', 'aPhase', 'uMvp', 'uTime', 'uPixelRatio', 'uSize', 'uColor', 'uAlpha']);
      this.sphereGeometry = this.makeSphere(14, 18);
      this.sphereBuffer = this.gl.createBuffer();
      this.sphereIndexBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.sphereGeometry.vertices, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.sphereGeometry.indices, this.gl.STATIC_DRAW);
      this.lineScratch = new Float32Array(512 * 3);
      this.batchLineBuffer = this.gl.createBuffer();
      this.batchLineScratch = new Float32Array(7 * 1024);
      this.batchLineFloatCount = 0;
      this.batchLineVao = this.gl.createVertexArray();
      this.gl.bindVertexArray(this.batchLineVao);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.batchLineBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.batchLineScratch.byteLength, this.gl.DYNAMIC_DRAW);
      this.gl.enableVertexAttribArray(this.batchLineLocations.aPosition);
      this.gl.vertexAttribPointer(this.batchLineLocations.aPosition, 3, this.gl.FLOAT, false, 28, 0);
      this.gl.enableVertexAttribArray(this.batchLineLocations.aColor);
      this.gl.vertexAttribPointer(this.batchLineLocations.aColor, 4, this.gl.FLOAT, false, 28, 12);
      this.gl.bindVertexArray(null);
      this.sphereInstanceBuffer = this.gl.createBuffer();
      this.sphereInstanceScratch = new Float32Array(9 * 64);
      this.sphereInstanceCapacity = 64;
      this.sphereInstanceVao = this.gl.createVertexArray();
      this.gl.bindVertexArray(this.sphereInstanceVao);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereBuffer);
      this.gl.enableVertexAttribArray(this.instanceSphereLocations.aPosition);
      this.gl.vertexAttribPointer(this.instanceSphereLocations.aPosition, 3, this.gl.FLOAT, false, 24, 0);
      this.gl.enableVertexAttribArray(this.instanceSphereLocations.aNormal);
      this.gl.vertexAttribPointer(this.instanceSphereLocations.aNormal, 3, this.gl.FLOAT, false, 24, 12);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereInstanceBuffer);
      const instanceStride = 9 * 4;
      for (const [name, size, offset] of [['aInstanceOffset', 3, 0], ['aInstanceColor', 3, 12], ['aInstanceRadius', 1, 24], ['aInstanceGlow', 1, 28], ['aInstanceAlpha', 1, 32]]) {
        const location = this.instanceSphereLocations[name];
        this.gl.enableVertexAttribArray(location);
        this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, instanceStride, offset);
        this.gl.vertexAttribDivisor(location, 1);
      }
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.sphereInstanceScratch.byteLength, this.gl.DYNAMIC_DRAW);
      this.gl.bindVertexArray(null);
      this.pointBuffer = this.gl.createBuffer();
      this.pointScratch = new Float32Array(4096);
      this.magneticPointScratch = new Float32Array(2048);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.pointScratch.byteLength, this.gl.DYNAMIC_DRAW);
      this.starBuffer = this.gl.createBuffer();
      this.starData = this.makeStars(150);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.starBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.starData, this.gl.STATIC_DRAW);
      this.resize();
    }
    locations(prog, names) { return Object.fromEntries(names.map(name => [name, name.startsWith('a') ? this.gl.getAttribLocation(prog, name) : this.gl.getUniformLocation(prog, name)])); }
    makeSphere(latitudes, longitudes) {
      const vertices = [], indices = [];
      for (let lat = 0; lat <= latitudes; lat++) {
        const theta = lat * Math.PI / latitudes, sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
        for (let lon = 0; lon <= longitudes; lon++) {
          const phi = lon * Math.PI * 2 / longitudes, x = Math.cos(phi) * sinTheta, y = cosTheta, z = Math.sin(phi) * sinTheta;
          vertices.push(x, y, z, x, y, z);
        }
      }
      for (let lat = 0; lat < latitudes; lat++) for (let lon = 0; lon < longitudes; lon++) {
        const a = lat * (longitudes + 1) + lon, b = a + longitudes + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
      return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
    }
    makeStars(count) {
      let seed = 7717; const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      const values = [];
      for (let i = 0; i < count; i++) values.push((random() - .5) * 34, (random() - .5) * 24, (random() - .5) * 30 - 8, random() * Math.PI * 2);
      return new Float32Array(values);
    }
    resize() {
      const cssWidth = Math.max(1, this.canvas.clientWidth), cssHeight = Math.max(1, this.canvas.clientHeight);
      const dpr = MolecularSpace.pixelRatioFor(cssWidth, cssHeight, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(cssWidth * dpr)), height = Math.max(1, Math.round(cssHeight * dpr));
      if (this.canvas.width === width && this.canvas.height === height && this.pixelRatio === dpr) return;
      this.canvas.width = width; this.canvas.height = height;
      this.pixelRatio = dpr; this.gl.viewport(0, 0, width, height);
    }
    cameraBasis() {
      const c = this.camera;
      if (c.mode === 'walk') {
        const cp = Math.cos(c.pitch), eye = [...c.position];
        const forward = v3.norm([Math.sin(c.yaw) * cp, Math.sin(c.pitch), Math.cos(c.yaw) * cp]);
        const right = v3.norm(v3.cross([0, 1, 0], forward)), up = v3.norm(v3.cross(forward, right));
        return { eye, forward, right, up };
      }
      const cp = Math.cos(c.pitch), eye = [c.target[0] + c.distance * Math.sin(c.yaw) * cp, c.target[1] + c.distance * Math.sin(c.pitch), c.target[2] + c.distance * Math.cos(c.yaw) * cp];
      const forward = v3.norm(v3.sub(c.target, eye)), right = v3.norm(v3.cross(forward, [0, 1, 0])), up = v3.norm(v3.cross(right, forward));
      return { eye, forward, right, up };
    }
    prepareMatrices() {
      const c = this.camera, aspect = this.canvas.width / this.canvas.height, basis = this.cameraBasis();
      const target = c.mode === 'walk' ? v3.add(basis.eye, basis.forward) : c.target;
      const proj = perspective(c.fov * Math.PI / 180, aspect, .08, 90), view = lookAt(basis.eye, target, [0, 1, 0]);
      this.matrices = { vp: multiply(proj, view), ...basis, aspect };
      return this.matrices;
    }
    project(point) {
      const m = this.matrices?.vp;
      if (!m) return null;
      const x = point[0], y = point[1], z = point[2];
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw <= .1) return null;
      return { x: (cx / cw * .5 + .5) * this.canvas.clientWidth, y: (1 - (cy / cw * .5 + .5)) * this.canvas.clientHeight, depth: cw, scale: 1 / cw };
    }
    rayPlane(screenX, screenY, planePoint) {
      const rect = this.canvas.getBoundingClientRect(), m = this.matrices || this.prepareMatrices();
      const nx = screenX / rect.width * 2 - 1, ny = 1 - screenY / rect.height * 2, f = Math.tan(this.camera.fov * Math.PI / 360);
      const dir = v3.norm(v3.add(m.forward, v3.add(v3.scale(m.right, nx * m.aspect * f), v3.scale(m.up, ny * f))));
      const den = v3.dot(dir, m.forward);
      const distance = v3.dot(v3.sub(planePoint, m.eye), m.forward) / (den || 1);
      return v3.add(m.eye, v3.scale(dir, distance));
    }
    render({ visible, positions, mode, selectedId, focusId, walkMode = false, seconds, motion = 1, menuSphere = null }) {
      const gl = this.gl;
      this.resize();
      if (!walkMode) {
        this.camera.target = this.camera.target.map((v, i) => v + (this.camera.targetGoal[i] - v) * .12);
        this.camera.distance += (this.camera.distanceGoal - this.camera.distance) * .12;
      }
      this.time = seconds * motion;
      const m = this.prepareMatrices();
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(.031, .047, .057, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      this.drawPoints(this.starBuffer, this.starData.length / 4, m.vp, '#aac5c1', .3, 1.5, false);
      this.drawOrbits(visible, positions, m.vp, mode);
      if (menuSphere) this.drawMenuSphere(menuSphere, m);
      if (mode === 'gravity') {
        const source = visible.find(node => node.id === selectedId) || visible[0];
        this.drawGravity(positions.get(source?.id) || [0, 0, 0], source?.mass || 1, m.vp, this.time);
      }
      if (mode === 'magnetic') this.drawMagnetic(visible, positions, m.vp, this.time);
      if (motion > 0) this.drawElectrons(visible, positions, m.vp, this.time, mode);
      this.drawSpheres(visible, positions, selectedId, focusId, walkMode, m);
      const selectedNode = visible.find(node => node.id === selectedId && !(walkMode && node.id === focusId));
      if (selectedNode) {
        const point = positions.get(selectedNode.id), radius = (selectedNode.radius || .25) * (selectedNode.kind === 'folder' ? 1.08 : 1);
        if (point) this.drawSelectionRing(point, Math.max(radius * 2.4, .7), selectedNode.color, m.vp);
      }
      if (walkMode) {
        const focus = visible.find(node => node.id === focusId), center = positions.get(focusId) || this.camera.position;
        if (focus && center) {
          gl.depthMask(false);
          this.drawSphere(center, Math.max(.28, (focus.radius || .3) * .96), color3(focus.color), .42, m, .075);
          gl.depthMask(true);
        }
      }
      gl.depthMask(true);
    }
    drawSphere(point, radius, color, glow, matrices, alpha = 1) {
      const gl = this.gl, loc = this.sphereLocations, model = this.modelScratch;
      model[0] = radius; model[5] = radius; model[10] = radius; model[12] = point[0]; model[13] = point[1]; model[14] = point[2];
      gl.useProgram(this.sphere); gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereBuffer); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer);
      gl.enableVertexAttribArray(loc.aPosition); gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(loc.aNormal); gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 24, 12);
      gl.uniformMatrix4fv(loc.uMvp, false, multiplyInto(this.mvpScratch, matrices.vp, model)); gl.uniformMatrix4fv(loc.uModel, false, model);
      gl.uniform3fv(loc.uColor, color); gl.uniform3fv(loc.uEye, matrices.eye); gl.uniform3f(loc.uLight, -3.5, 7, 5); gl.uniform1f(loc.uGlow, glow); gl.uniform1f(loc.uAlpha, alpha);
      gl.drawElements(gl.TRIANGLES, this.sphereGeometry.indices.length, gl.UNSIGNED_SHORT, 0);
    }
    drawSpheres(visible, positions, selectedId, focusId, walkMode, matrices) {
      const gl = this.gl, valuesPerInstance = 9;
      let count = 0;
      for (const node of visible) {
        const point = positions.get(node.id); if (!point || (walkMode && node.id === focusId)) continue;
        const offset = count * valuesPerInstance;
        if (offset + valuesPerInstance > this.sphereInstanceScratch.length) {
          this.sphereInstanceCapacity *= 2;
          const grown = new Float32Array(this.sphereInstanceCapacity * valuesPerInstance);
          grown.set(this.sphereInstanceScratch); this.sphereInstanceScratch = grown;
          gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereInstanceBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, grown.byteLength, gl.DYNAMIC_DRAW);
        }
        const color = color3(node.color), selected = node.id === selectedId;
        const radius = (node.radius || .25) * (selected && node.kind === 'folder' ? 1.08 : 1);
        const glow = selected ? 1.08 : node.kind === 'root' ? .88 : .5;
        const values = this.sphereInstanceScratch;
        values[offset] = point[0]; values[offset + 1] = point[1]; values[offset + 2] = point[2];
        values[offset + 3] = color[0]; values[offset + 4] = color[1]; values[offset + 5] = color[2];
        values[offset + 6] = radius; values[offset + 7] = glow; values[offset + 8] = 1;
        count++;
      }
      if (!count) return;
      gl.bindVertexArray(this.sphereInstanceVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereInstanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sphereInstanceScratch.subarray(0, count * valuesPerInstance));
      const loc = this.instanceSphereLocations;
      gl.useProgram(this.instanceSphere);
      gl.uniformMatrix4fv(loc.uViewProjection, false, matrices.vp);
      gl.uniform3f(loc.uLight, -3.5, 7, 5); gl.uniform3fv(loc.uEye, matrices.eye);
      gl.drawElementsInstanced(gl.TRIANGLES, this.sphereGeometry.indices.length, gl.UNSIGNED_SHORT, 0, count);
      gl.bindVertexArray(null);
    }
    ensureBatchLineCapacity(requiredFloats) {
      if (requiredFloats <= this.batchLineScratch.length) return;
      const grown = new Float32Array(Math.max(requiredFloats, this.batchLineScratch.length * 2));
      grown.set(this.batchLineScratch); this.batchLineScratch = grown;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.batchLineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, grown.byteLength, gl.DYNAMIC_DRAW);
    }
    appendBatchPath(values, count, hex, alpha, closed = false) {
      if (count < 2) return;
      const segments = closed ? count : count - 1, start = this.batchLineFloatCount;
      this.ensureBatchLineCapacity(start + segments * 14);
      const output = this.batchLineScratch, color = color3(hex);
      let cursor = start;
      for (let i = 0; i < segments; i++) {
        const a = i * 3, b = ((i + 1) % count) * 3;
        output[cursor] = values[a]; output[cursor + 1] = values[a + 1]; output[cursor + 2] = values[a + 2];
        output[cursor + 3] = color[0]; output[cursor + 4] = color[1]; output[cursor + 5] = color[2]; output[cursor + 6] = alpha;
        cursor += 7;
        output[cursor] = values[b]; output[cursor + 1] = values[b + 1]; output[cursor + 2] = values[b + 2];
        output[cursor + 3] = color[0]; output[cursor + 4] = color[1]; output[cursor + 5] = color[2]; output[cursor + 6] = alpha;
        cursor += 7;
      }
      this.batchLineFloatCount = cursor;
    }
    submitBatchLines(mvp) {
      if (!this.batchLineFloatCount) return;
      const gl = this.gl, vertexCount = this.batchLineFloatCount / 7;
      gl.bindVertexArray(this.batchLineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.batchLineBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.batchLineScratch.subarray(0, this.batchLineFloatCount));
      gl.useProgram(this.batchLine);
      gl.uniformMatrix4fv(this.batchLineLocations.uMvp, false, mvp);
      gl.depthMask(false); gl.drawArrays(gl.LINES, 0, vertexCount); gl.depthMask(true);
      gl.bindVertexArray(null);
    }
    drawOrbits(visible, positions, mvp, mode) {
      const values = this.lineScratch, segments = 32;
      this.batchLineFloatCount = 0;
      const drawnPeerBands = new Set();
      for (const node of visible) {
        if (!node.parentId) continue;
        if (node.peerLevel) {
          const key = `${node.parentId}:${node.scaleDepth}`;
          if (drawnPeerBands.has(key)) continue;
          drawnPeerBands.add(key);
        }
        const parent = positions.get(node.parentId); if (!parent) continue;
        const tilt = node.inclination || 0, r = node.orbit || .8;
        for (let i = 0; i < segments; i++) {
          const t = i / segments * Math.PI * 2, j = i * 3, sine = Math.sin(t) * r;
          values[j] = parent[0] + Math.cos(t) * r; values[j + 1] = parent[1] + sine * Math.sin(tilt); values[j + 2] = parent[2] + sine * Math.cos(tilt);
        }
        const alpha = node.kind === 'widget' ? .024 : node.kind === 'app' ? .019 : .022;
        this.appendBatchPath(values, segments, node.color, mode === 'magnetic' ? alpha * 1.08 : alpha, true);
      }
      this.submitBatchLines(mvp);
    }
    drawMenuSphere({ center, radius, color = '#93c9bc' }, matrices) {
      const gl = this.gl;
      gl.depthMask(false);
      this.drawSphere(center, radius, color3(color), .28, matrices, .045);
      gl.depthMask(true);
      const values = this.lineScratch, segments = 48;
      this.batchLineFloatCount = 0;
      for (let longitude = 0; longitude < 3; longitude++) {
        const angle = longitude * Math.PI / 3;
        for (let i = 0; i < segments; i++) {
          const t = i / segments * Math.PI * 2, j = i * 3, ring = Math.cos(t) * radius;
          values[j] = center[0] + ring * Math.cos(angle);
          values[j + 1] = center[1] + Math.sin(t) * radius;
          values[j + 2] = center[2] + ring * Math.sin(angle);
        }
        this.appendBatchPath(values, segments, color, .052, true);
      }
      for (const latitude of [-.42, .42]) {
        const ring = Math.cos(latitude) * radius, y = Math.sin(latitude) * radius;
        for (let i = 0; i < segments; i++) {
          const t = i / segments * Math.PI * 2, j = i * 3;
          values[j] = center[0] + Math.cos(t) * ring;
          values[j + 1] = center[1] + y;
          values[j + 2] = center[2] + Math.sin(t) * ring;
        }
        this.appendBatchPath(values, segments, color, .027, true);
      }
      this.submitBatchLines(matrices.vp);
    }
    drawSelectionRing(center, radius, hex, mvp) {
      const values = this.lineScratch, segments = 32;
      for (let j = 0; j < segments; j++) { const t = j / segments * Math.PI * 2, i = j * 3; values[i] = center[0] + Math.cos(t) * radius; values[i + 1] = center[1] + Math.sin(t) * radius * .58; values[i + 2] = center[2] + Math.sin(t) * radius * .82; }
      this.batchLineFloatCount = 0; this.appendBatchPath(values, segments, hex, .17, true); this.submitBatchLines(mvp);
    }
    drawGravity(center, mass, mvp, seconds) {
      const strength = Math.max(.55, Math.min(2.1, Math.sqrt(Math.max(.15, mass)))), values = this.lineScratch, segments = 32;
      this.batchLineFloatCount = 0;
      for (let i = 0; i < 5; i++) {
        const r = .75 + i * .58, well = -.08 * strength / (r + .2);
        for (let j = 0; j < segments; j++) { const t = j / segments * Math.PI * 2, k = j * 3; values[k] = center[0] + Math.cos(t) * r; values[k + 1] = center[1] + well + Math.sin(t * 2 + seconds * .08) * .025 * strength; values[k + 2] = center[2] + Math.sin(t) * r; }
        this.appendBatchPath(values, segments, i < 3 ? '#eac184' : '#9a947c', .085 - i * .01, true);
      }
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 1.3, count = 15;
        for (let j = 0; j <= count; j++) { const t = j / count, y = -1.5 + t * 3, bend = x * .22 * strength / (1 + y * y), k = j * 3; values[k] = center[0] + x - bend; values[k + 1] = center[1] + y; values[k + 2] = center[2] + Math.sin(t * Math.PI) * .3 * strength; }
        this.appendBatchPath(values, count + 1, '#c9a96e', .05);
      }
      this.submitBatchLines(mvp);
    }
    drawMagnetic(visible, positions, mvp, seconds) {
      const focusId = visible[0]?.id || 'root', root = positions.get(focusId) || positions.get('root') || [0, 0, 0];
      const folders = visible.filter(n => n.kind === 'folder' && n.id !== focusId && positions.has(n.id));
      const values = this.lineScratch, segments = 24, visibleIds = new Set(visible.map(node => node.id));
      this.batchLineFloatCount = 0;
      this._magneticPointCount = 0;
      let pulseCount = 0;
      for (let i = 0; i < folders.length; i++) {
        const node = folders[i], end = positions.get(node.id), bend = ((i % 2) ? 1 : -1) * (.4 + i * .06);
        for (let s = 0; s <= segments; s++) { const t = s / segments, k = s * 3, curve = Math.sin(t * Math.PI); values[k] = root[0] + (end[0] - root[0]) * t; values[k + 1] = root[1] + (end[1] - root[1]) * t + curve * bend; values[k + 2] = root[2] + (end[2] - root[2]) * t + curve * .22; }
        this.appendBatchPath(values, segments + 1, node.color, .095);
        let t = (seconds * .09 + i / Math.max(1, folders.length)) % 1; if (node.charge < 0) t = 1 - t;
        const curve = Math.sin(t * Math.PI), x = root[0] + (end[0] - root[0]) * t, y = root[1] + (end[1] - root[1]) * t + curve * bend, z = root[2] + (end[2] - root[2]) * t + curve * .22;
        pulseCount = this.appendMagneticPoint(x, y, z, t + i);
      }
      for (const app of visible) {
        if (app.kind !== 'app') continue;
        const start = positions.get(app.id); if (!start) continue;
        for (let linkIndex = 0; linkIndex < (app.links || []).length; linkIndex++) {
          const targetId = app.links[linkIndex], end = positions.get(targetId); if (!end || !visibleIds.has(targetId)) continue;
          const bend = linkIndex % 2 ? -.45 : .45, count = 20;
          for (let step = 0; step <= count; step++) {
            const t = step / count, u = 1 - t, k = step * 3;
            values[k] = u * u * start[0] + 2 * u * t * ((start[0] + end[0]) * .5);
            values[k + 1] = u * u * start[1] + 2 * u * t * ((start[1] + end[1]) * .5 + bend);
            values[k + 2] = u * u * start[2] + 2 * u * t * ((start[2] + end[2]) * .5);
          }
          this.appendBatchPath(values, count + 1, app.color, .075);
          let t = (seconds * .11 + linkIndex * .33) % 1; if (app.charge < 0) t = 1 - t;
          const u = 1 - t, x = u * u * start[0] + 2 * u * t * ((start[0] + end[0]) * .5), y = u * u * start[1] + 2 * u * t * ((start[1] + end[1]) * .5 + bend), z = u * u * start[2] + 2 * u * t * ((start[2] + end[2]) * .5);
          pulseCount = this.appendMagneticPoint(x, y, z, t + linkIndex);
        }
      }
      this.submitBatchLines(mvp);
      if (pulseCount) this.drawPoints(this.pointBuffer, pulseCount, mvp, '#a5ded0', .78, 2.4, true, this.magneticPointScratch, pulseCount * 4);
    }
    appendMagneticPoint(x, y, z, phase) {
      const index = this._magneticPointCount || 0;
      if (index * 4 + 4 > this.magneticPointScratch.length) this.magneticPointScratch = new Float32Array(this.magneticPointScratch.length * 2);
      const offset = index * 4;
      this.magneticPointScratch[offset] = x; this.magneticPointScratch[offset + 1] = y; this.magneticPointScratch[offset + 2] = z; this.magneticPointScratch[offset + 3] = phase;
      this._magneticPointCount = index + 1;
      return this._magneticPointCount;
    }
    drawElectrons(visible, positions, mvp, seconds, mode) {
      let values = this.pointScratch, electronCount = 0;
      const gl = this.gl;
      for (let i = 0; i < visible.length; i++) {
        const node = visible[i], center = positions.get(node.id); if (!center || !['root', 'folder'].includes(node.kind)) continue;
        const perNodeCount = mode === 'electric' ? (node.charge < 0 ? 8 : 5) : node.kind === 'root' ? 3 : node.charge < 0 ? 3 : 2, r = (node.radius || .3) * (mode === 'electric' ? 3.7 : 2.8);
        for (let j = 0; j < perNodeCount; j++) {
          const a = seconds * (.35 + j * .035) * (node.charge < 0 ? -1 : 1) + node.phase + j * Math.PI * 2 / perNodeCount;
          const offset = electronCount * 4;
          if (offset + 4 > values.length) {
            this.pointScratch = new Float32Array(values.length * 2);
            this.pointScratch.set(values);
            values = this.pointScratch;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer); gl.bufferData(gl.ARRAY_BUFFER, this.pointScratch.byteLength, gl.DYNAMIC_DRAW);
          }
          const target = this.pointScratch, index = electronCount * 4;
          target[index] = center[0] + Math.cos(a) * r; target[index + 1] = center[1] + Math.sin(a * .72 + j) * r * .38; target[index + 2] = center[2] + Math.sin(a) * r; target[index + 3] = a + i;
          electronCount++;
        }
      }
      if (!electronCount) return;
      this.drawPoints(this.pointBuffer, electronCount, mvp, mode === 'electric' ? '#c6c1ff' : '#a5ded0', mode === 'electric' ? .92 : .56, mode === 'electric' ? 3.5 : 2.4, true, this.pointScratch, electronCount * 4);
    }
    drawPoints(buffer, count, mvp, hex, alpha, size, dynamic, values = null, valueLength = values?.length || 0) {
      if (!count) return;
      const gl = this.gl, loc = this.pointLocations;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      if (dynamic) {
        if (valueLength > this.pointScratch.length) {
          this.pointScratch = new Float32Array(valueLength * 2);
          gl.bufferData(gl.ARRAY_BUFFER, this.pointScratch.byteLength, gl.DYNAMIC_DRAW);
        }
        if (values !== this.pointScratch) for (let i = 0; i < valueLength; i++) this.pointScratch[i] = values[i];
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pointScratch, 0, valueLength);
      }
      gl.useProgram(this.points); gl.enableVertexAttribArray(loc.aPosition); gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(loc.aPhase); gl.vertexAttribPointer(loc.aPhase, 1, gl.FLOAT, false, 16, 12);
      gl.uniformMatrix4fv(loc.uMvp, false, mvp); gl.uniform1f(loc.uTime, this.time); gl.uniform1f(loc.uPixelRatio, this.pixelRatio); gl.uniform1f(loc.uSize, size); gl.uniform3fv(loc.uColor, color3(hex)); gl.uniform1f(loc.uAlpha, alpha);
      gl.depthMask(false); gl.drawArrays(gl.POINTS, 0, count); gl.depthMask(true);
    }
  }

  // Perspective-correct canvas renderer used when WebGL2 is blocked by the browser or GPU policy.
  // It keeps the same camera, projections, orbital data, and pointer geometry as the full renderer.
  class CanvasSpaceFallback {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      if (!this.ctx) throw new Error('Ni WebGL 2 ni Canvas 2D ne sont disponibles dans ce navigateur.');
      this.camera = { mode: 'orbit', yaw: -.24, pitch: .25, distance: 13.3, position: [0, 0, 0], target: [0, 0, 0], targetGoal: [0, 0, 0], fov: 48 };
      this.fallback = true;
      this.pixelRatio = 1;
      this.time = 0;
      this.matrices = null;
      this.stars = this.makeStars(110);
      this.resize();
    }
    makeStars(count) {
      let seed = 7717;
      const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      return Array.from({ length: count }, () => ({ point: [(random() - .5) * 34, (random() - .5) * 24, (random() - .5) * 30 - 8], phase: random() * Math.PI * 2 }));
    }
    resize() {
      const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight);
      const ratio = Math.min(1, MolecularSpace.pixelRatioFor(width, height, window.devicePixelRatio || 1));
      const pixelWidth = Math.max(1, Math.round(width * ratio)), pixelHeight = Math.max(1, Math.round(height * ratio));
      if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) { this.canvas.width = pixelWidth; this.canvas.height = pixelHeight; }
      this.pixelRatio = ratio;
    }
    cameraBasis() {
      const camera = this.camera;
      if (camera.mode === 'walk') {
        const cp = Math.cos(camera.pitch), eye = [...camera.position];
        const forward = v3.norm([Math.sin(camera.yaw) * cp, Math.sin(camera.pitch), Math.cos(camera.yaw) * cp]);
        const right = v3.norm(v3.cross([0, 1, 0], forward)), up = v3.norm(v3.cross(forward, right));
        return { eye, forward, right, up };
      }
      const cp = Math.cos(camera.pitch), eye = [camera.target[0] + camera.distance * Math.sin(camera.yaw) * cp, camera.target[1] + camera.distance * Math.sin(camera.pitch), camera.target[2] + camera.distance * Math.cos(camera.yaw) * cp];
      const forward = v3.norm(v3.sub(camera.target, eye)), right = v3.norm(v3.cross(forward, [0, 1, 0])), up = v3.norm(v3.cross(right, forward));
      return { eye, forward, right, up };
    }
    prepareMatrices() {
      const basis = this.cameraBasis(), target = this.camera.mode === 'walk' ? v3.add(basis.eye, basis.forward) : this.camera.target;
      this.matrices = { ...basis, aspect: this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight), target };
      return this.matrices;
    }
    project(point) {
      if (!this.matrices) return null;
      const m = this.matrices, offset = v3.sub(point, m.eye), depth = v3.dot(offset, m.forward);
      if (depth <= .1 || depth >= 90) return null;
      const height = this.canvas.clientHeight, scale = height * .5 / (Math.tan(this.camera.fov * Math.PI / 360) * depth);
      return { x: this.canvas.clientWidth * .5 + v3.dot(offset, m.right) * scale, y: height * .5 - v3.dot(offset, m.up) * scale, depth, scale: 1 / depth };
    }
    rayPlane(screenX, screenY, planePoint) {
      const rect = this.canvas.getBoundingClientRect(), m = this.matrices || this.prepareMatrices();
      const nx = screenX / rect.width * 2 - 1, ny = 1 - screenY / rect.height * 2, f = Math.tan(this.camera.fov * Math.PI / 360);
      const dir = v3.norm(v3.add(m.forward, v3.add(v3.scale(m.right, nx * m.aspect * f), v3.scale(m.up, ny * f))));
      const den = v3.dot(dir, m.forward), distance = v3.dot(v3.sub(planePoint, m.eye), m.forward) / (den || 1);
      return v3.add(m.eye, v3.scale(dir, distance));
    }
    color(hex, alpha = 1) {
      const raw = String(hex || '#81d8c4').replace('#', '');
      const normalized = raw.length === 3 ? raw.split('').map(value => value + value).join('') : raw;
      const value = parseInt(normalized, 16) || 0x81d8c4;
      return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
    }
    path(points, color, alpha = .2, width = 1, close = false, dash = []) {
      const ctx = this.ctx;
      ctx.beginPath();
      let started = false;
      for (const point of points) {
        const projected = this.project(point);
        if (!projected) { started = false; continue; }
        if (!started) { ctx.moveTo(projected.x, projected.y); started = true; }
        else ctx.lineTo(projected.x, projected.y);
      }
      if (close && started) ctx.closePath();
      ctx.strokeStyle = this.color(color, alpha); ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    }
    orbitPoints(center, radius, tilt, count = 56) {
      const points = [];
      for (let index = 0; index <= count; index++) {
        const angle = index / count * Math.PI * 2, sine = Math.sin(angle) * radius;
        points.push([center[0] + Math.cos(angle) * radius, center[1] + sine * Math.sin(tilt), center[2] + sine * Math.cos(tilt)]);
      }
      return points;
    }
    drawOrbits(visible, positions, mode) {
      const drawnPeerBands = new Set();
      for (const item of visible) {
        if (!item.parentId) continue;
        if (item.peerLevel) { const key = `${item.parentId}:${item.scaleDepth}`; if (drawnPeerBands.has(key)) continue; drawnPeerBands.add(key); }
        const parent = positions.get(item.parentId); if (!parent) continue;
        this.path(this.orbitPoints(parent, item.orbit || .8, item.inclination || 0), item.color, mode === 'magnetic' ? .045 : .03, 1, true);
      }
    }
    drawMenuSphere({ center, radius, color = '#93c9bc' }) {
      const ctx = this.ctx, p = this.project(center); if (!p) return;
      const r = Math.max(18, Math.min(220, radius * p.scale * this.canvas.clientHeight * .5 / Math.tan(this.camera.fov * Math.PI / 360)));
      const glow = ctx.createRadialGradient(p.x - r * .34, p.y - r * .36, 1, p.x, p.y, r);
      glow.addColorStop(0, this.color('#d8fff0', .18)); glow.addColorStop(.52, this.color(color, .07)); glow.addColorStop(1, this.color(color, .015));
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
      for (let index = 0; index < 3; index++) this.path(this.orbitPoints(center, radius * .99, index * Math.PI / 3, 60), color, .12, 1, true);
      for (const latitude of [-.55, .55]) {
        const ring = Math.cos(latitude) * radius, y = center[1] + Math.sin(latitude) * radius, points = [];
        for (let i = 0; i <= 60; i++) { const t = i / 60 * Math.PI * 2; points.push([center[0] + Math.cos(t) * ring, y, center[2] + Math.sin(t) * ring]); }
        this.path(points, color, .075, 1, true);
      }
      ctx.restore();
    }
    drawGravity(center, mass, seconds) {
      const strength = Math.max(.55, Math.min(2.1, Math.sqrt(Math.max(.15, mass))));
      for (let i = 0; i < 5; i++) {
        const radius = .75 + i * .58, y = center[1] - .08 * strength / (radius + .2) + Math.sin(seconds * .08 + i) * .015;
        const points = Array.from({ length: 48 }, (_, j) => { const t = j / 47 * Math.PI * 2; return [center[0] + Math.cos(t) * radius, y, center[2] + Math.sin(t) * radius]; });
        this.path(points, i < 3 ? '#eac184' : '#9a947c', .1 - i * .014, 1, true);
      }
      for (let i = -2; i <= 2; i++) {
        const x = i * 1.3, points = [];
        for (let j = 0; j <= 24; j++) { const t = j / 24, y = -2 + t * 4, bend = x * .22 * strength / (1 + y * y); points.push([center[0] + x - bend, center[1] + y, center[2] + Math.sin(t * Math.PI) * .3 * strength]); }
        this.path(points, '#c9a96e', .06, 1);
      }
    }
    drawMagnetic(visible, positions, seconds) {
      const root = positions.get(visible[0]?.id) || [0, 0, 0], folders = visible.filter(item => item.kind === 'folder' && positions.has(item.id));
      for (let index = 0; index < folders.length; index++) {
        const item = folders[index], end = positions.get(item.id), bend = (index % 2 ? 1 : -1) * (.4 + index * .06);
        const points = Array.from({ length: 25 }, (_, j) => { const t = j / 24, curve = Math.sin(t * Math.PI); return [root[0] + (end[0] - root[0]) * t, root[1] + (end[1] - root[1]) * t + curve * bend, root[2] + (end[2] - root[2]) * t + curve * .22]; });
        this.path(points, item.color, .16, 1.25, false, [3, 5]);
        let t = (seconds * .09 + index / Math.max(1, folders.length)) % 1; if (item.charge < 0) t = 1 - t;
        const point = this.project(points[Math.round(t * 24)]); if (point) this.dot(point, 2.5, '#b2f3df', .8);
      }
      for (const app of visible.filter(item => item.kind === 'app')) {
        const start = positions.get(app.id); if (!start) continue;
        for (let linkIndex = 0; linkIndex < (app.links || []).length; linkIndex++) {
          const end = positions.get(app.links[linkIndex]); if (!end) continue;
          const bend = linkIndex % 2 ? -.45 : .45, points = Array.from({ length: 21 }, (_, j) => { const t = j / 20, u = 1 - t; return [u * u * start[0] + 2 * u * t * ((start[0] + end[0]) * .5), u * u * start[1] + 2 * u * t * ((start[1] + end[1]) * .5 + bend), u * u * start[2] + 2 * u * t * ((start[2] + end[2]) * .5)]; });
          this.path(points, app.color, .15, 1.15);
        }
      }
    }
    dot(point, radius, color, alpha = .8) {
      const ctx = this.ctx, gradient = ctx.createRadialGradient(point.x, point.y, .1, point.x, point.y, radius * 2.8);
      gradient.addColorStop(0, this.color(color, alpha)); gradient.addColorStop(1, this.color(color, 0));
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(point.x, point.y, radius * 2.8, 0, Math.PI * 2); ctx.fill();
    }
    drawElectrons(visible, positions, seconds, mode) {
      for (let i = 0; i < visible.length; i++) {
        const item = visible[i], center = positions.get(item.id); if (!center || !['root', 'folder'].includes(item.kind)) continue;
        const count = mode === 'electric' ? (item.charge < 0 ? 8 : 5) : item.kind === 'root' ? 3 : item.charge < 0 ? 3 : 2, radius = (item.radius || .3) * (mode === 'electric' ? 3.7 : 2.8);
        for (let j = 0; j < count; j++) {
          const angle = seconds * (.35 + j * .035) * (item.charge < 0 ? -1 : 1) + (item.phase || 0) + j * Math.PI * 2 / count;
          const point = this.project([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle * .72 + j) * radius * .38, center[2] + Math.sin(angle) * radius]);
          if (point) this.dot(point, mode === 'electric' ? 2.6 : 1.8, mode === 'electric' ? '#c6c1ff' : '#a5ded0', mode === 'electric' ? .9 : .58);
        }
      }
    }
    drawSphere(item, point, selected) {
      const p = this.project(point); if (!p) return;
      const baseRadius = (item.radius || .25) * (selected && item.kind === 'folder' ? 1.08 : 1), radius = Math.max(3, Math.min(96, baseRadius * p.scale * this.canvas.clientHeight * .5 / Math.tan(this.camera.fov * Math.PI / 360)));
      const ctx = this.ctx, glowColor = item.color || '#81d8c4';
      const gradient = ctx.createRadialGradient(p.x - radius * .36, p.y - radius * .42, Math.max(1, radius * .015), p.x, p.y, radius);
      gradient.addColorStop(0, this.color('#f6fff4', .98)); gradient.addColorStop(.12, this.color(glowColor, .98)); gradient.addColorStop(.54, this.color(glowColor, .83)); gradient.addColorStop(1, this.color('#061015', .98));
      ctx.save(); ctx.shadowColor = this.color(glowColor, selected ? .55 : .34); ctx.shadowBlur = radius * (selected ? .9 : .55);
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.strokeStyle = this.color(glowColor, selected ? .9 : .58); ctx.lineWidth = selected ? 1.5 : .8; ctx.stroke();
    }
    render({ visible, positions, mode, selectedId, focusId, walkMode = false, seconds, motion = 1, menuSphere = null }) {
      this.resize();
      if (!walkMode) {
        this.camera.target = this.camera.target.map((value, index) => value + (this.camera.targetGoal[index] - value) * .12);
        this.camera.distance += (this.camera.distanceGoal - this.camera.distance) * .12;
      }
      this.time = seconds * motion;
      const m = this.prepareMatrices(), ctx = this.ctx, width = this.canvas.clientWidth, height = this.canvas.clientHeight;
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, width, height);
      const background = ctx.createRadialGradient(width * .5, height * .46, 0, width * .5, height * .46, Math.max(width, height) * .72);
      background.addColorStop(0, '#142126'); background.addColorStop(.55, '#0c1218'); background.addColorStop(1, '#080c11');
      ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
      for (const star of this.stars) { const p = this.project(star.point); if (p) this.dot(p, .45 + (Math.sin(seconds * .72 + star.phase) + 1) * .28, '#aac5c1', .18); }
      this.drawOrbits(visible, positions, mode);
      if (menuSphere) this.drawMenuSphere(menuSphere);
      if (mode === 'gravity') { const source = visible.find(item => item.id === selectedId) || visible[0]; this.drawGravity(positions.get(source?.id) || [0, 0, 0], source?.mass || 1, this.time); }
      if (mode === 'magnetic') this.drawMagnetic(visible, positions, this.time);
      if (motion > 0) this.drawElectrons(visible, positions, this.time, mode);
      const sorted = visible.map(item => ({ item, point: positions.get(item.id), p: positions.has(item.id) ? this.project(positions.get(item.id)) : null })).filter(entry => entry.point && entry.p).sort((a, b) => b.p.depth - a.p.depth);
      for (const { item, point } of sorted) this.drawSphere(item, point, item.id === selectedId);
      const selected = visible.find(item => item.id === selectedId), selectedPoint = selected && positions.get(selectedId), selectedScreen = selectedPoint && this.project(selectedPoint);
      if (selected && selectedScreen) {
        const r = Math.max(8, (selected.radius || .25) * selectedScreen.scale * height * .5 / Math.tan(this.camera.fov * Math.PI / 360) * 2.2);
        ctx.beginPath(); ctx.ellipse(selectedScreen.x, selectedScreen.y, r, r * .58, 0, 0, Math.PI * 2); ctx.strokeStyle = this.color(selected.color, .38); ctx.lineWidth = 1; ctx.stroke();
      }
      if (walkMode) { const focus = visible.find(item => item.id === focusId), center = positions.get(focusId) || m.eye; if (focus && center) this.drawSphere({ ...focus, radius: Math.max(.28, (focus.radius || .3) * .96) }, center, true); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  window.MolecularSpace = MolecularSpace;
})();

