/* ============================================================
   Spirit Ink v4.0 — Shader Store
   Central repository for all GLSL shader source strings used
   by the particle and decoration renderers.
   No external dependencies. Exports ShaderStore to window scope.
   ============================================================ */

(function () {
  'use strict';

  var ShaderStore = {

    /* ---- Main Particle Shaders ---- */

    /**
     * Vertex shader for the main particle system.
     * Attributes: position (built-in), aColor (per-particle RGB)
     * Uniforms:   uPR (pixel ratio), uGlow (glow intensity)
     */
    VERTEX: [
      'attribute vec3 aColor;',
      'varying vec3 vC;',
      'uniform float uPR;',
      'uniform float uGlow;',
      'void main(){',
      '  vC = aColor;',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = (6.0 + uGlow * 10.0) * uPR * (1.0 / -mv.z);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),

    /**
     * Fragment shader for the main particle system.
     * Soft glow circle with a bright core highlight.
     */
    FRAGMENT: [
      'varying vec3 vC;',
      'void main(){',
      '  float d = length(gl_PointCoord - vec2(0.5));',
      '  if(d > 0.5) discard;',
      '  float glow = smoothstep(0.5, 0.0, d);',
      '  float core = smoothstep(0.2, 0.0, d);',
      '  vec3 c = vC * glow * 1.4 + vec3(1.0) * core * 0.2;',
      '  gl_FragColor = vec4(c, smoothstep(0.5, 0.25, d) * 0.85);',
      '}'
    ].join('\n'),

    /* ---- Decoration / Star-Dust Shaders ---- */

    /**
     * Vertex shader for background decoration particles.
     * Very small point size, fixed low opacity.
     */
    DECORATION_VERTEX: [
      'varying float vA;',
      'uniform float uPR;',
      'void main(){',
      '  vA = 0.06;',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = 1.5 * uPR * (1.0 / -mv.z);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),

    /**
     * Fragment shader for background decoration particles.
     * Faint teal-tinted dots.
     */
    DECORATION_FRAGMENT: [
      'varying float vA;',
      'void main(){',
      '  float d = length(gl_PointCoord - vec2(0.5));',
      '  if(d > 0.5) discard;',
      '  gl_FragColor = vec4(0.3, 0.6, 0.8, smoothstep(0.5, 0.45, d) * vA);',
      '}'
    ].join('\n'),

    /* ---- Accessor Methods ---- */

    getVertexShader: function () {
      return this.VERTEX;
    },

    getFragmentShader: function () {
      return this.FRAGMENT;
    },

    getDecorationShader: function () {
      return {
        vertex: this.DECORATION_VERTEX,
        fragment: this.DECORATION_FRAGMENT
      };
    }
  };

  window.ShaderStore = ShaderStore;
})();
