/* ============================================================
   Spirit Ink v4.0 — Spring Physics Engine
   Single-file, zero-dependency spring dynamics for render params.
   Exports: Spring, SpringPool  (window scope)
   ============================================================ */

class Spring {
  constructor(k = 80, d = 12) {
    this.target = 0;
    this.value  = 0;
    this.velocity = 0;
    this.k = k;
    this.d = d;
  }

  setTarget(t) {
    this.target = t;
  }

  update(dt) {
    const f = (this.target - this.value) * this.k;
    this.velocity += (f - this.velocity * this.d) * dt;
    this.value += this.velocity * dt;
    // clamp to prevent explosion
    if (Math.abs(this.value) > 10) this.value = Math.sign(this.value) * 10;
    if (Math.abs(this.velocity) > 20) this.velocity = Math.sign(this.velocity) * 20;
  }
}

class SpringPool {
  constructor() {
    this._pool = {};
    this._names = [
      'colorR', 'colorG', 'colorB',
      'scale', 'glow', 'spread', 'bloom', 'speed', 'camShake'
    ];
  }

  /**
   * Create or reset every spring with the given stiffness/damping.
   */
  init(k = 80, d = 12) {
    for (const name of this._names) {
      if (!this._pool[name]) {
        this._pool[name] = new Spring(k, d);
      } else {
        this._pool[name].k = k;
        this._pool[name].d = d;
      }
    }
  }

  /**
   * Push render-parameter targets into the springs.
   * @param {Object} render
   * @param {number[]} render.color  - [r, g, b] each 0-1
   * @param {number}  render.scale
   * @param {number}  render.glow
   * @param {number}  render.spread
   * @param {number}  render.bloom
   * @param {number}  render.speed
   * @param {number}  render.camera_shake
   */
  applyTargets(render) {
    const c = render.color || [0, 0.83, 1];
    this._pool.colorR.setTarget(c[0]);
    this._pool.colorG.setTarget(c[1]);
    this._pool.colorB.setTarget(c[2]);
    this._pool.scale.setTarget(render.scale || 1);
    this._pool.glow.setTarget(render.glow || 0.5);
    this._pool.spread.setTarget(render.spread || 0);
    this._pool.bloom.setTarget(render.bloom || 0.3);
    this._pool.speed.setTarget(render.speed || 0.3);
    this._pool.camShake.setTarget(render.camera_shake || 0);
  }

  /** Tick every spring forward by dt seconds. */
  update(dt) {
    for (const s of Object.values(this._pool)) s.update(dt);
  }

  /**
   * Return a flat object with the current (interpolated) value of every spring.
   */
  getCurrentValues() {
    const out = {};
    for (const name of this._names) {
      out[name] = this._pool[name].value;
    }
    return out;
  }
}

window.Spring     = Spring;
window.SpringPool = SpringPool;
