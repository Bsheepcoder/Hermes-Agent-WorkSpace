/* ============================================================
   Spirit Ink v4.0 — Particle Renderer
   Manages the main particle system, decoration star-dust,
   style-specific motion, physics, and GPU buffer sync.
   No external dependencies. Exports ParticleRenderer to window scope.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- constants ---------- */
  var DECORATION_COUNT  = 50;
  var DAMPING           = 0.88;
  var COLOR_BLEND_RATE  = 0.015;
  var BOUNDARY_X        = 1.5;
  var BOUNDARY_Y        = 1.2;
  var BOUNDARY_Z        = 0.8;
  var BOUNDARY_FORCE    = 0.002;
  var REPULSION_DIST    = 0.04;
  var REPULSION_FORCE   = 0.00003;
  var REPULSION_RANGE   = 5;          // check i+1 .. i+RANGE neighbours
  var TARGET_STIFFNESS  = 0.04;
  var BREATHE_AMP       = 0.00015;
  var BREATHE_FREQ      = 0.8;

  /* ================================================================
     ParticleRenderer
     ================================================================ */
  function ParticleRenderer(scene, camera) {
    this._scene   = scene;
    this._camera  = camera || null;
    this._particles = [];
    this._N        = 0;
    this._geo      = null;
    this._mesh     = null;
    this._mat      = null;

    // decoration
    this._dGeo     = null;
    this._dMesh    = null;
    this._dVels    = [];

    // bloom pass reference (set externally)
    this._bloomPass = null;

    // pixel ratio
    this._pr = Math.min(
      typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1,
      2
    );
  }

  /* ---------- public API ---------- */

  ParticleRenderer.prototype.init = function (options) {
    options = options || {};
    var count = options.count || 400;
    if (options.pixelRatio) {
      this._pr = Math.min(options.pixelRatio, 2);
    }
    this._buildParticles(count);
    this._buildDecoration();
  };

  ParticleRenderer.prototype.rebuild = function (count) {
    this._disposeParticles();
    this._buildParticles(count);
  };

  /**
   * Main tick — call every frame.
   *
   * @param {number}  dt           frame delta (seconds)
   * @param {number}  time         elapsed time (seconds)
   * @param {Object}  springValues flat {colorR,colorG,colorB,scale,glow,spread,bloom,speed,camShake}
   * @param {string}  styleName    active style key (e.g. 'energy_flow')
   * @param {boolean} isThinking   AI thinking flag
   */
  ParticleRenderer.prototype.update = function (dt, time, springValues, styleName, isThinking) {
    var sv = this._safeSpringValues(springValues);
    var N  = this._N;

    // ---- bloom ----
    if (this._bloomPass) {
      this._bloomPass.strength = sv.bloom;
    }

    // ---- camera shake ----
    this._applyCameraShake(sv);

    // ---- thinking rotation ----
    this._applyThinkingRotation(dt, time, isThinking);

    // ---- glow uniform ----
    if (this._mat && this._mat.uniforms) {
      this._mat.uniforms.uGlow.value = sv.glow;
    }

    // ---- particle physics ----
    for (var i = 0; i < N; i++) {
      var p = this._particles[i];

      // breathe
      p.y += Math.sin(time * BREATHE_FREQ + p.phase) * BREATHE_AMP;

      // style-specific motion (skip if already chasing a target)
      if (!p.hasTarget) {
        this._applyStyleMotion(p, i, styleName, time, sv);
      }

      // target attraction (holo_grid, shield, etc.)
      if (p.hasTarget) {
        p.vx += (p.tx - p.x) * TARGET_STIFFNESS;
        p.vy += (p.ty - p.y) * TARGET_STIFFNESS;
        p.vz += (p.tz - p.z) * TARGET_STIFFNESS;
      }

      // repulsion (check next few neighbours)
      for (var j = i + 1; j < N && j < i + REPULSION_RANGE; j++) {
        var q  = this._particles[j];
        var dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
        if (dist < REPULSION_DIST) {
          var f = (REPULSION_DIST - dist) / dist * REPULSION_FORCE;
          p.vx += dx * f; p.vy += dy * f; p.vz += dz * f;
          q.vx -= dx * f; q.vy -= dy * f; q.vz -= dz * f;
        }
      }

      // boundary
      if (Math.abs(p.x) > BOUNDARY_X) p.vx -= p.x * BOUNDARY_FORCE;
      if (Math.abs(p.y) > BOUNDARY_Y) p.vy -= p.y * BOUNDARY_FORCE;
      if (Math.abs(p.z) > BOUNDARY_Z) p.vz -= p.z * BOUNDARY_FORCE;

      // damping
      p.vx *= DAMPING; p.vy *= DAMPING; p.vz *= DAMPING;

      // integrate position
      p.x += p.vx; p.y += p.vy; p.z += p.vz;

      // color blend toward spring target
      p.cr += (sv.colorR - p.cr) * COLOR_BLEND_RATE;
      p.cg += (sv.colorG - p.cg) * COLOR_BLEND_RATE;
      p.cb += (sv.colorB - p.cb) * COLOR_BLEND_RATE;
    }

    // ---- sync GPU buffers ----
    this._syncGPUBuffers();

    // ---- decoration particles ----
    this._updateDecoration(time);
  };

  ParticleRenderer.prototype.releaseTargets = function () {
    for (var i = 0; i < this._N; i++) {
      this._particles[i].hasTarget = false;
    }
  };

  ParticleRenderer.prototype.dispose = function () {
    this._disposeParticles();
    this._disposeDecoration();
  };

  ParticleRenderer.prototype.getMesh = function () {
    return this._mesh;
  };

  ParticleRenderer.prototype.setBloomPass = function (bloomPass) {
    this._bloomPass = bloomPass;
  };

  ParticleRenderer.prototype.getBloomUniforms = function () {
    return {
      strength:  0.3,
      threshold: 0.1
    };
  };

  /* ================================================================
     Private — particle lifecycle
     ================================================================ */

  ParticleRenderer.prototype._buildParticles = function (n) {
    var THREE = window.THREE;
    if (!THREE) throw new Error('THREE.js not loaded');

    this._N = n;
    this._particles = [];

    for (var i = 0; i < n; i++) {
      this._particles.push(this._createParticle(i, n));
    }

    var pos = new Float32Array(n * 3);
    var col = new Float32Array(n * 3);

    this._geo = new THREE.BufferGeometry();
    this._geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._geo.setAttribute('aColor',   new THREE.BufferAttribute(col, 3));

    var shaders = window.ShaderStore;
    this._mat = new THREE.ShaderMaterial({
      uniforms: {
        uPR:   { value: this._pr },
        uGlow: { value: 0.5 }
      },
      vertexShader:   shaders.getVertexShader(),
      fragmentShader: shaders.getFragmentShader(),
      transparent: true,
      depthWrite:  true
    });

    this._mesh = new THREE.Points(this._geo, this._mat);
    this._scene.add(this._mesh);
  };

  ParticleRenderer.prototype._createParticle = function (i, N) {
    var a = (i / N) * Math.PI * 2;
    var r = 0.3 + Math.random() * 0.4;
    return {
      x:  Math.cos(a) * r * 0.5,
      y:  Math.sin(a) * r * 0.3 + (Math.random() - 0.5) * 0.4,
      z:  (Math.random() - 0.5) * 0.3,
      vx: 0, vy: 0, vz: 0,
      tx: 0, ty: 0, tz: 0,
      hasTarget: false,
      cr: 0.2, cg: 0.5, cb: 0.7,
      phase:       Math.random() * Math.PI * 2,
      styleOffset: Math.random() * Math.PI * 2
    };
  };

  ParticleRenderer.prototype._disposeParticles = function () {
    if (this._mesh) {
      this._scene.remove(this._mesh);
    }
    if (this._geo) this._geo.dispose();
    if (this._mat) this._mat.dispose();
    this._geo  = null;
    this._mat  = null;
    this._mesh = null;
    this._particles = [];
    this._N = 0;
  };

  /* ================================================================
     Private — decoration particles
     ================================================================ */

  ParticleRenderer.prototype._buildDecoration = function () {
    var THREE = window.THREE;
    if (!THREE) return;

    var dpA = new Float32Array(DECORATION_COUNT * 3);
    this._dVels = [];

    for (var i = 0; i < DECORATION_COUNT; i++) {
      dpA[i * 3]     = (Math.random() - 0.5) * 4;
      dpA[i * 3 + 1] = (Math.random() - 0.5) * 3;
      dpA[i * 3 + 2] = (Math.random() - 0.5) * 2;

      this._dVels.push({
        sp: 0.05 + Math.random() * 0.2,
        ph: Math.random() * Math.PI * 2,
        r:  0.3  + Math.random() * 0.8,
        cy: (Math.random() - 0.5) * 2,
        cx: (Math.random() - 0.5) * 2
      });
    }

    this._dGeo = new THREE.BufferGeometry();
    this._dGeo.setAttribute('position', new THREE.BufferAttribute(dpA, 3));

    var dShaders = window.ShaderStore.getDecorationShader();

    var dMat = new THREE.ShaderMaterial({
      uniforms:       { uPR: { value: this._pr } },
      vertexShader:   dShaders.vertex,
      fragmentShader: dShaders.fragment,
      transparent: true,
      depthWrite:  false
    });

    this._dMesh = new THREE.Points(this._dGeo, dMat);
    this._scene.add(this._dMesh);
  };

  ParticleRenderer.prototype._updateDecoration = function (time) {
    if (!this._dGeo) return;
    var dpA = this._dGeo.attributes.position.array;

    for (var i = 0; i < DECORATION_COUNT; i++) {
      var v = this._dVels[i];
      dpA[i * 3]     = v.cx + Math.sin(time * v.sp + v.ph) * v.r;
      dpA[i * 3 + 1] = v.cy + Math.cos(time * v.sp * 0.7 + v.ph) * v.r * 0.5;
      dpA[i * 3 + 2] = Math.sin(time * v.sp * 0.5 + v.ph * 2) * 0.3;
    }
    this._dGeo.attributes.position.needsUpdate = true;
  };

  ParticleRenderer.prototype._disposeDecoration = function () {
    if (this._dMesh) {
      this._scene.remove(this._dMesh);
    }
    if (this._dGeo) this._dGeo.dispose();
    if (this._dMesh && this._dMesh.material) this._dMesh.material.dispose();
    this._dGeo  = null;
    this._dMesh = null;
    this._dVels = [];
  };

  /* ================================================================
     Private — GPU sync
     ================================================================ */

  ParticleRenderer.prototype._syncGPUBuffers = function () {
    if (!this._geo) return;

    var pA = this._geo.attributes.position.array;
    var cA = this._geo.attributes.aColor.array;

    for (var i = 0; i < this._N; i++) {
      var p = this._particles[i];
      var j = i * 3;
      pA[j] = p.x; pA[j + 1] = p.y; pA[j + 2] = p.z;
      cA[j] = p.cr; cA[j + 1] = p.cg; cA[j + 2] = p.cb;
    }

    this._geo.attributes.position.needsUpdate = true;
    this._geo.attributes.aColor.needsUpdate   = true;
  };

  /* ================================================================
     Private — camera shake
     ================================================================ */

  ParticleRenderer.prototype._applyCameraShake = function (sv) {
    var cam = this._camera;
    if (!cam) return;

    if (sv.camShake > 0.01) {
      cam.position.x = (Math.random() - 0.5) * sv.camShake;
      cam.position.y = (Math.random() - 0.5) * sv.camShake;
    } else {
      cam.position.x *= 0.9;
      cam.position.y *= 0.9;
    }
  };

  /* ================================================================
     Private — thinking rotation
     ================================================================ */

  ParticleRenderer.prototype._applyThinkingRotation = function (dt, time, isThinking) {
    if (!this._mesh) return;

    if (isThinking) {
      this._mesh.rotation.y += dt * 0.4;
      this._mesh.rotation.x = Math.sin(time * 0.3) * 0.1;
    } else {
      this._mesh.rotation.y += (0 - this._mesh.rotation.y) * 0.02;
      this._mesh.rotation.x += (0 - this._mesh.rotation.x) * 0.02;
    }
  };

  /* ================================================================
     Private — spring value safety
     ================================================================ */

  ParticleRenderer.prototype._safeSpringValues = function (sv) {
    if (!sv) sv = {};
    return {
      colorR:   sv.colorR   != null ? sv.colorR   : 0,
      colorG:   sv.colorG   != null ? sv.colorG   : 0.83,
      colorB:   sv.colorB   != null ? sv.colorB   : 1,
      scale:    Math.max(0.1, sv.scale    || 1),
      glow:     sv.glow     != null ? sv.glow     : 0.5,
      spread:   sv.spread   || 0,
      bloom:    sv.bloom    != null ? sv.bloom    : 0.3,
      speed:    Math.max(0.01, sv.speed || 0.3),
      camShake: sv.camShake || 0
    };
  };

  /* ================================================================
     Private — style-specific motion functions
     ================================================================ */

  ParticleRenderer.prototype._applyStyleMotion = function (p, i, style, time, sv) {
    var speed  = Math.max(0.01, sv.speed);
    var spread = sv.spread;
    var t      = time * speed + p.styleOffset;
    var N      = this._N;

    switch (style) {

      /* --- energy_flow: flow field with sine/cosine streams --- */
      case 'energy_flow': {
        var angle = Math.sin(p.x * 3 + t) * Math.cos(p.y * 3 + t * 0.7) * Math.PI;
        p.vx += Math.cos(angle) * 0.0008 * speed;
        p.vy += Math.sin(angle) * 0.0008 * speed;
        p.vz += Math.sin(t + p.phase) * 0.0002;
        break;
      }

      /* --- data_rain: falling columns --- */
      case 'data_rain': {
        var col  = Math.floor((i / N) * 20);
        var colX = (col / 20 - 0.5) * 2;
        p.vx += (colX - p.x) * 0.003;
        p.vy -= 0.008 * speed;
        if (p.y < -1.2) { p.y = 1.2; p.vy = 0; }
        p.vz += Math.sin(t * 2 + col) * 0.0001;
        break;
      }

      /* --- holo_grid: grid positions with wave distortion --- */
      case 'holo_grid': {
        var cols = Math.ceil(Math.sqrt(N));
        var gx   = ((i % cols) / cols - 0.5) * 2 * (sv.scale || 1);
        var gy   = (Math.floor(i / cols) / cols - 0.5) * 2 * (sv.scale || 1);
        var wave = Math.sin(time * 0.5 + gx * 2) * 0.1;
        p.tx = gx; p.ty = gy + wave; p.tz = 0;
        p.hasTarget = true;
        break;
      }

      /* --- plasma: radial energy from center --- */
      case 'plasma': {
        var pdx = p.x, pdy = p.y;
        var pdist = Math.sqrt(pdx * pdx + pdy * pdy) || 0.01;
        var push  = Math.sin(time * 2 + p.phase) * 0.002 * speed;
        p.vx += (pdx / pdist) * push;
        p.vy += (pdy / pdist) * push;
        // pull back gently
        p.vx -= p.x * 0.0005;
        p.vy -= p.y * 0.0005;
        break;
      }

      /* --- neural: drifting nodes with subtle connections --- */
      case 'neural': {
        p.vx += Math.sin(t * 0.3 + p.phase) * 0.0005;
        p.vy += Math.cos(t * 0.4 + p.phase * 1.3) * 0.0005;
        // subtle attraction to nearby particles (only check some)
        if (i % 10 === 0) {
          for (var j = Math.max(0, i - 5); j < Math.min(N, i + 5); j++) {
            if (j === i) continue;
            var q   = this._particles[j];
            var ddx = q.x - p.x, ddy = q.y - p.y;
            var d2  = ddx * ddx + ddy * ddy;
            if (d2 < 0.15 && d2 > 0.005) {
              p.vx += ddx * 0.00002;
              p.vy += ddy * 0.00002;
            }
          }
        }
        break;
      }

      /* --- shield: concentric rings --- */
      case 'shield': {
        var ring      = Math.floor(i / (N / 6));
        var ringCount = Math.ceil(N / 6);
        var posInRing = (i % ringCount) / ringCount;
        var a2        = posInRing * Math.PI * 2 + time * 0.5;
        var radius    = 0.2 + ring * 0.15 + Math.sin(time * 2 + ring) * 0.05;
        p.tx = Math.cos(a2) * radius;
        p.ty = Math.sin(a2) * radius;
        p.tz = Math.sin(a2 * 2 + time) * 0.05;
        p.hasTarget = true;
        break;
      }

      /* --- scan: radial scanning beam --- */
      case 'scan': {
        var scanAngle  = time * 2;
        var beamWidth  = 0.4;
        var pAngle     = Math.atan2(p.y, p.x);
        var pDist      = Math.sqrt(p.x * p.x + p.y * p.y);
        var angleDiff  = ((scanAngle - pAngle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        if (Math.abs(angleDiff) < beamWidth) {
          p.cr = sv.colorR * 1.5;
          p.cg = sv.colorG * 1.5;
          p.cb = sv.colorB * 1.5;
        }
        // slow orbit
        p.vx += Math.cos(pAngle + 0.01) * 0.0002;
        p.vy += Math.sin(pAngle + 0.01) * 0.0002;
        break;
      }

      /* --- default: energy_flow fallback --- */
      default: {
        p.vx += Math.sin(t + p.phase) * 0.0003;
        p.vy += Math.cos(t + p.phase * 1.3) * 0.0003;
        break;
      }
    }

    /* ---- spread / contract (applied to ALL styles) ---- */
    if (Math.abs(spread) > 0.001) {
      var sd = Math.sqrt(p.x * p.x + p.y * p.y) || 0.01;
      p.vx += (p.x / sd) * spread * 0.0005;
      p.vy += (p.y / sd) * spread * 0.0005;
    }
  };

  /* ---------- export ---------- */
  window.ParticleRenderer = ParticleRenderer;
})();
