/**
 * Spirit Ink v4.0 — Token Engine Core
 * Manages token packs, resolves tokens to render params, handles activation lifecycle.
 * No external dependencies. Exports TokenEngine to window scope.
 */
(function () {
  'use strict';

  /**
   * Deep-merge source into target. Arrays are replaced (not concatenated).
   * Only plain objects are recursed; everything else is overwritten.
   */
  function deepMerge(target, source) {
    if (!source) return target;
    for (var key in source) {
      if (!source.hasOwnProperty(key)) continue;
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] !== null &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  /**
   * TokenEngine — the core token management class.
   *
   * State:
   *   currentPack        — the raw pack object currently loaded
   *   baseTokens         — Map<string, tokenEntry>  (name → token def)
   *   sceneTokens        — Map<string, tokenEntry>  (name → token def)
   *   activeBaseToken    — string | null  (currently active base token name)
   *   activeSceneToken   — string | null  (currently active scene token name)
   *   sceneTokenTimeout  — number | null  (setTimeout id for scene expiry)
   *   _onActivate        — function | null
   */
  function TokenEngine() {
    this.currentPack = null;
    this.baseTokens = new Map();
    this.sceneTokens = new Map();
    this.activeBaseToken = null;
    this.activeSceneToken = null;
    this.sceneTokenTimeout = null;
    this._onActivate = null;
  }

  // ------------------------------------------------------------------ loadPack
  /**
   * Load a token pack object.
   * @param {object} packData — {name, color, bloom, personality, base_tokens, scene_tokens, ai_rules}
   */
  TokenEngine.prototype.loadPack = function (packData) {
    if (!packData || typeof packData !== 'object') {
      throw new Error('TokenEngine.loadPack: packData must be a non-null object');
    }
    if (!packData.base_tokens || typeof packData.base_tokens !== 'object') {
      throw new Error('TokenEngine.loadPack: packData.base_tokens is required');
    }
    if (!packData.scene_tokens || typeof packData.scene_tokens !== 'object') {
      throw new Error('TokenEngine.loadPack: packData.scene_tokens is required');
    }

    this.currentPack = packData;
    this.baseTokens.clear();
    this.sceneTokens.clear();

    var self = this;

    Object.keys(packData.base_tokens).forEach(function (key) {
      self.baseTokens.set(key, packData.base_tokens[key]);
    });

    Object.keys(packData.scene_tokens).forEach(function (key) {
      self.sceneTokens.set(key, packData.scene_tokens[key]);
    });

    // Reset active state
    this._clearSceneTimeout();
    this.activeBaseToken = null;
    this.activeSceneToken = null;
  };

  // ----------------------------------------------------------------- resolve
  /**
   * Given an array of token names, find the first matching base token and first
   * matching scene token, then merge their render params (scene overrides base).
   *
   * @param {string[]} tokenNames
   * @returns {object} merged render params
   */
  TokenEngine.prototype.resolve = function (tokenNames) {
    if (!Array.isArray(tokenNames)) tokenNames = [];

    // Find first base token match; fall back to 'idle'
    var baseTokenName = null;
    for (var i = 0; i < tokenNames.length; i++) {
      if (this.baseTokens.has(tokenNames[i])) {
        baseTokenName = tokenNames[i];
        break;
      }
    }
    if (!baseTokenName) baseTokenName = 'idle';

    var baseToken = this.baseTokens.get(baseTokenName);
    var baseRender = (baseToken && baseToken.render)
      ? this._cloneRender(baseToken.render)
      : { style: 'energy_flow', color: [0, 0.83, 1], scale: 1.0, glow: 0.6, spread: 0.05, bloom: 0.3, speed: 0.3 };

    // Find first scene token match
    var sceneTokenName = null;
    for (var j = 0; j < tokenNames.length; j++) {
      if (this.sceneTokens.has(tokenNames[j])) {
        sceneTokenName = tokenNames[j];
        break;
      }
    }

    if (sceneTokenName) {
      var sceneToken = this.sceneTokens.get(sceneTokenName);
      if (sceneToken && sceneToken.render) {
        deepMerge(baseRender, sceneToken.render);
      }
    }

    return baseRender;
  };

  // -------------------------------------------------------------- activateTokens
  /**
   * Set the active base and scene tokens, fire onActivate callback,
   * and schedule scene token auto-expiry after render.duration ms.
   *
   * @param {string[]} tokenNames
   */
  TokenEngine.prototype.activateTokens = function (tokenNames) {
    if (!Array.isArray(tokenNames)) tokenNames = [];

    // Determine base token
    var newBase = null;
    for (var i = 0; i < tokenNames.length; i++) {
      if (this.baseTokens.has(tokenNames[i])) {
        newBase = tokenNames[i];
        break;
      }
    }

    // Determine scene token
    var newScene = null;
    for (var j = 0; j < tokenNames.length; j++) {
      if (this.sceneTokens.has(tokenNames[j])) {
        newScene = tokenNames[j];
        break;
      }
    }

    var baseChanged = (newBase !== this.activeBaseToken);
    var sceneChanged = (newScene !== this.activeSceneToken);

    this.activeBaseToken = newBase;
    this.activeSceneToken = newScene;

    // Clear any previous scene timeout
    this._clearSceneTimeout();

    // Schedule scene token expiry
    if (newScene) {
      var self = this;
      var duration = this._getSceneDuration(newScene);
      this.sceneTokenTimeout = setTimeout(function () {
        self.sceneTokenTimeout = null;
        var expiredScene = self.activeSceneToken;
        self.activeSceneToken = null;
        if (self._onActivate) {
          self._onActivate({
            base: self.activeBaseToken,
            scene: null,
            render: self.getCurrentRender(),
            expired: expiredScene
          });
        }
      }, duration);
    }

    // Fire callback if anything changed
    if ((baseChanged || sceneChanged) && this._onActivate) {
      this._onActivate({
        base: this.activeBaseToken,
        scene: this.activeSceneToken,
        render: this.getCurrentRender()
      });
    }
  };

  // ------------------------------------------------------------ setOnActivate
  /**
   * Register a callback fired when active tokens change.
   * cb({base, scene, render, expired?})
   */
  TokenEngine.prototype.setOnActivate = function (cb) {
    if (typeof cb !== 'function' && cb !== null) {
      throw new Error('TokenEngine.setOnActivate: callback must be a function or null');
    }
    this._onActivate = cb;
  };

  // --------------------------------------------------------- getCurrentRender
  /**
   * Get the current merged render params from the active base + scene tokens.
   */
  TokenEngine.prototype.getCurrentRender = function () {
    var names = [];
    if (this.activeBaseToken) names.push(this.activeBaseToken);
    if (this.activeSceneToken) names.push(this.activeSceneToken);
    return this.resolve(names);
  };

  // ------------------------------------------------------- getActiveTokenNames
  /**
   * Return an array of currently active token names.
   */
  TokenEngine.prototype.getActiveTokenNames = function () {
    var result = [];
    if (this.activeBaseToken) result.push(this.activeBaseToken);
    if (this.activeSceneToken) result.push(this.activeSceneToken);
    return result;
  };

  // -------------------------------------------------------------- exportPack
  /**
   * Return the current pack as a JSON string.
   */
  TokenEngine.prototype.exportPack = function () {
    if (!this.currentPack) {
      throw new Error('TokenEngine.exportPack: no pack loaded');
    }
    return JSON.stringify(this.currentPack, null, 2);
  };

  // -------------------------------------------------------------- importPack
  /**
   * Parse and validate a JSON string as a token pack.
   * Does NOT automatically load it — returns the pack data.
   *
   * @param {string} jsonStr
   * @returns {object} validated pack data
   * @throws {Error} on invalid JSON or missing required fields
   */
  TokenEngine.prototype.importPack = function (jsonStr) {
    if (typeof jsonStr !== 'string') {
      throw new Error('TokenEngine.importPack: input must be a JSON string');
    }

    var pack;
    try {
      pack = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('TokenEngine.importPack: invalid JSON — ' + e.message);
    }

    // Validate required top-level fields
    var required = ['name', 'color', 'bloom', 'base_tokens', 'scene_tokens'];
    for (var i = 0; i < required.length; i++) {
      if (!pack[required[i]]) {
        throw new Error(
          'TokenEngine.importPack: missing required field "' + required[i] + '"'
        );
      }
    }

    // Validate color sub-structure (bg may be 0 which is falsy)
    if (!pack.color.primary || pack.color.bg === undefined || pack.color.bg === null) {
      throw new Error('TokenEngine.importPack: color must have primary and bg');
    }

    // Validate base_tokens entries have render
    var baseKeys = Object.keys(pack.base_tokens);
    if (baseKeys.length === 0) {
      throw new Error('TokenEngine.importPack: base_tokens must not be empty');
    }
    for (var b = 0; b < baseKeys.length; b++) {
      if (!pack.base_tokens[baseKeys[b]].render) {
        throw new Error(
          'TokenEngine.importPack: base_token "' + baseKeys[b] + '" missing render'
        );
      }
    }

    // Validate scene_tokens entries have render with duration
    var sceneKeys = Object.keys(pack.scene_tokens);
    for (var s = 0; s < sceneKeys.length; s++) {
      if (!pack.scene_tokens[sceneKeys[s]].render) {
        throw new Error(
          'TokenEngine.importPack: scene_token "' + sceneKeys[s] + '" missing render'
        );
      }
    }

    return pack;
  };

  // ================================================================== PRIVATE

  /**
   * Shallow-clone a render object so resolve() never mutates the original.
   */
  TokenEngine.prototype._cloneRender = function (render) {
    var clone = {};
    for (var key in render) {
      if (!render.hasOwnProperty(key)) continue;
      if (Array.isArray(render[key])) {
        clone[key] = render[key].slice();
      } else if (
        render[key] !== null &&
        typeof render[key] === 'object'
      ) {
        clone[key] = this._cloneRender(render[key]);
      } else {
        clone[key] = render[key];
      }
    }
    return clone;
  };

  /**
   * Get the duration (ms) for a scene token; default 5000.
   */
  TokenEngine.prototype._getSceneDuration = function (sceneName) {
    var token = this.sceneTokens.get(sceneName);
    if (token && token.render && typeof token.render.duration === 'number') {
      return Math.max(0, token.render.duration);
    }
    return 5000;
  };

  /**
   * Clear the scene token expiry timeout if one is pending.
   */
  TokenEngine.prototype._clearSceneTimeout = function () {
    if (this.sceneTokenTimeout !== null) {
      clearTimeout(this.sceneTokenTimeout);
      this.sceneTokenTimeout = null;
    }
  };

  // Expose to global scope
  window.TokenEngine = TokenEngine;
})();
