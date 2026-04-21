/* ============================================================
   Spirit Ink v4.0 — Application Entry Point
   Orchestrates all modules: TokenEngine, SpringPool, ParticleRenderer,
   HUD, PromptBuilder, ResponseParser, and AI providers.
   No external dependencies (besides THREE.js loaded via CDN).
   Exports: window.SpiritInk (app controller)
   ============================================================ */

;(function () {
  'use strict';

  /* ================================================================
     SpiritInk — main application controller
     ================================================================ */
  function SpiritInk() {
    // Three.js scene objects (created in init)
    this._scene    = null;
    this._camera   = null;
    this._renderer = null;
    this._composer = null;
    this._bloomPass = null;
    this._clock    = null;

    // Core engine modules
    this.tokenEngine  = null;   // TokenEngine instance
    this.springPool   = null;   // SpringPool instance
    this.particles    = null;   // ParticleRenderer instance
    this.hud          = null;   // HUD instance

    // State
    this._currentPackId   = null;
    this._currentPackData = null;
    this._packRegistry    = {};       // id → pack data
    this._conversationHistory = [];
    this._isThinking      = false;
    this._particleCount   = 400;
    this._activeStyle     = 'energy_flow';

    // Config (from localStorage or defaults)
    this._config = this._loadConfig();
  }

  /* ================================================================
     Public API
     ================================================================ */

  /**
   * Initialize the entire application.
   * Call once after all scripts are loaded and the DOM is ready.
   * @param {Object} options
   * @param {string} options.canvasContainerId — ID of the canvas wrapper div
   * @param {string} options.hudContainerId    — ID of the HUD overlay div
   * @param {Array}  options.packs             — [{id, label, emoji, data}] to register
   * @param {string} [options.defaultPackId]   — which pack to start with
   */
  SpiritInk.prototype.init = function (options) {
    var self = this;
    options = options || {};

    // 1. Register packs
    var packs = options.packs || [];
    for (var i = 0; i < packs.length; i++) {
      this._packRegistry[packs[i].id] = packs[i].data;
    }

    // 2. Core modules
    this.tokenEngine = new TokenEngine();
    this.springPool  = new SpringPool();

    // 3. Three.js scene
    this._initThree(options.canvasContainerId || 'canvas-wrap');

    // 4. Particle renderer
    this.particles = new ParticleRenderer(this._scene, this._camera);
    this.particles.init({ count: this._particleCount });
    this.particles.setBloomPass(this._bloomPass);

    // 5. HUD
    var hudEl = document.getElementById(options.hudContainerId || 'hud-overlay');
    this.hud = new HUD(hudEl);
    this.hud.init();
    this.hud.setParticleCount(this._particleCount);

    // 6. Wire HUD events
    this.hud.onSend(function (text) { self._handleUserInput(text); });
    this.hud.onConfigToggle(function () {
      // Build config panel on first toggle
      if (!self._configBuilt) {
        self._buildConfigPanel();
        self._configBuilt = true;
      }
    });

    // 7. Build pack buttons
    var packBtns = [];
    for (var j = 0; j < packs.length; j++) {
      packBtns.push({
        id: packs[j].id,
        label: packs[j].label || packs[j].id,
        emoji: packs[j].emoji || ''
      });
    }
    var defId = options.defaultPackId || (packs.length > 0 ? packs[0].id : null);
    this.hud.buildPackButtons(packBtns, defId, function (packId) {
      self.switchPack(packId);
    });

    // 8. Load default pack
    if (defId) {
      this.switchPack(defId);
    } else {
      console.warn('SpiritInk: no packs registered — nothing to render');
    }

    // 9. Resize handler
    window.addEventListener('resize', function () { self._onResize(); });

    // 10. Start animation loop
    this._animate();

    // 11. Init AI providers
    if (window.SIProviders && typeof SIProviders.init === 'function') {
      SIProviders.init();
    }
  };

  /**
   * Switch to a different token pack.
   * @param {string} packId
   */
  SpiritInk.prototype.switchPack = function (packId) {
    var packData = this._packRegistry[packId];
    if (!packData) {
      console.error('SpiritInk: pack not found:', packId);
      return;
    }

    this._currentPackId   = packId;
    this._currentPackData = packData;

    // Load into token engine
    this.tokenEngine.loadPack(packData);

    // Init springs with pack personality
    var personality = packData.personality || {};
    this.springPool.init(personality.k || 80, personality.d || 12);

    // Set idle token immediately
    this.tokenEngine.activateTokens(['idle']);

    // Update renderer
    this.particles.releaseTargets();

    // Update background color
    var bgColor = packData.color ? (packData.color.bg != null ? packData.color.bg : 39321) : 39321;
    this._renderer.setClearColor(bgColor, 1);

    // Update bloom defaults
    var bloomCfg = packData.bloom || {};
    this._bloomPass.threshold = bloomCfg.threshold || 0.82;

    // Update HUD
    var allTokens = this._getAllTokensMap();
    this.hud.setTokenDisplay(['idle'], allTokens);
    this.hud.showStatus('LOADED: ' + (packData.name || packId).toUpperCase());

    // Reset conversation on pack switch
    this._conversationHistory = [];

    console.log('SpiritInk: switched to pack', packId);
  };

  /**
   * Get the current list of registered pack IDs.
   * @returns {string[]}
   */
  SpiritInk.prototype.getPackIds = function () {
    return Object.keys(this._packRegistry);
  };

  /* ================================================================
     Private — Three.js initialization
     ================================================================ */

  SpiritInk.prototype._initThree = function (containerId) {
    var THREE = window.THREE;
    var container = document.getElementById(containerId);

    // Scene
    this._scene = new THREE.Scene();

    // Camera
    this._camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this._camera.position.z = 3;

    // Renderer
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setClearColor(39321, 1); // default dark bg
    container.appendChild(this._renderer.domElement);

    // Post-processing
    var EffectComposer = window.three__postprocessing__EffectComposer ||
                         (window.EffectComposer);
    var RenderPass = window.three__postprocessing__RenderPass ||
                     (window.RenderPass);
    var UnrealBloomPass = window.three__postprocessing__UnrealBloomPass ||
                          (window.UnrealBloomPass);
    var OutputPass = window.three__postprocessing__OutputPass ||
                     (window.OutputPass);

    this._composer = new EffectComposer(this._renderer);
    this._composer.addPass(new RenderPass(this._scene, this._camera));
    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.4, 0.4, 0.82
    );
    this._composer.addPass(this._bloomPass);
    this._composer.addPass(new OutputPass());

    // Clock
    this._clock = new THREE.Clock();
  };

  /* ================================================================
     Private — Animation loop
     ================================================================ */

  SpiritInk.prototype._animate = function () {
    var self = this;
    requestAnimationFrame(function () { self._animate(); });

    var dt = Math.min(this._clock.getDelta(), 0.05);
    var t  = this._clock.getElapsedTime();

    // Update springs
    this.springPool.update(dt);

    // Get interpolated values
    var sv = this.springPool.getCurrentValues();

    // Determine active style
    var render = this.tokenEngine.getCurrentRender();
    this._activeStyle = render.style || 'energy_flow';

    // Update particles
    this.particles.update(dt, t, sv, this._activeStyle, this._isThinking);

    // Update HUD (every frame for FPS counter)
    this.hud.update(sv, this.tokenEngine.getActiveTokenNames(), this._isThinking);

    // Render
    this._composer.render();
  };

  /* ================================================================
     Private — User input & AI pipeline
     ================================================================ */

  SpiritInk.prototype._handleUserInput = function (text) {
    if (!text) return;

    // Clear input
    this.hud.clearInput();

    // Add to conversation
    this._conversationHistory.push({ role: 'user', content: text });
    if (this._conversationHistory.length > 20) {
      this._conversationHistory = this._conversationHistory.slice(-20);
    }

    // Show thinking state
    this._isThinking = true;
    this.hud.setInputEnabled(true);
    this.hud.showStatus('THINKING...');
    this.tokenEngine.activateTokens(['think']);

    var self = this;
    this._callAI(text)
      .then(function (parsed) {
        self._isThinking = false;
        self.hud.setInputEnabled(false);

        if (!parsed) {
          self.hud.showStatus('ERROR — AI returned empty response');
          self.tokenEngine.activateTokens(['idle']);
          return;
        }

        // Show AI response text
        if (parsed.content) {
          self.hud.showStatus(parsed.content);
          self._conversationHistory.push({ role: 'assistant', content: JSON.stringify(parsed) });
        }

        // Activate visual tokens
        if (parsed.tokens && parsed.tokens.length > 0) {
          self.tokenEngine.activateTokens(parsed.tokens);

          // Update HUD token display
          var allTokens = self._getAllTokensMap();
          self.hud.setTokenDisplay(parsed.tokens, allTokens);
        }
      })
      .catch(function (err) {
        self._isThinking = false;
        self.hud.setInputEnabled(false);
        self.hud.showStatus('ERROR: ' + err.message);
        self.tokenEngine.activateTokens(['idle']);
      });
  };

  SpiritInk.prototype._callAI = function (text) {
    var self = this;

    if (!window.SIProviders) {
      return Promise.reject(new Error('AI providers not loaded'));
    }
    if (!SIProviders.getApiKey || !SIProviders.getApiKey()) {
      this.hud.showStatus('请先配置 API Key（右上角 ⚙）');
      return Promise.resolve(null);
    }

    var systemPrompt = PromptBuilder.buildSystemPrompt(this._currentPackData);
    var userMessages = this._conversationHistory.slice(); // copy

    var opts = { maxTokens: 2048, temperature: 0.85 };

    // First attempt
    return SIProviders.call(systemPrompt, userMessages, opts)
      .catch(function (err) {
        if (err.message && err.message.indexOf('429') !== -1) {
          self.hud.showStatus('RATE LIMITED, RETRYING...');
          return new Promise(function (resolve) { setTimeout(resolve, 5000); })
            .then(function () { return SIProviders.call(systemPrompt, userMessages, opts); });
        }
        throw err;
      })
      .then(function (result) {
        if (!result || !result.content) return null;
        return ResponseParser.parse(result.content);
      });
  };

  /* ================================================================
     Private — Config panel
     ================================================================ */

  SpiritInk.prototype._buildConfigPanel = function () {
    var self = this;

    // Provider list
    var providers = [];
    if (window.SIProviders && SIProviders.getProviders) {
      var provs = SIProviders.getProviders();
      for (var i = 0; i < provs.length; i++) {
        providers.push({ value: provs[i].id, label: provs[i].name || provs[i].id });
      }
    }
    if (providers.length === 0) {
      providers.push({ value: 'zhipu', label: '智谱' });
      providers.push({ value: 'openai', label: 'OpenAI' });
      providers.push({ value: 'custom', label: '自定义' });
    }

    // Model list
    var models = [
      { value: 'glm-4-flash', label: 'GLM-4-Flash' },
      { value: 'glm-4', label: 'GLM-4' },
      { value: 'glm-4-air', label: 'GLM-4-Air' },
      { value: 'gpt-4o-mini', label: 'GPT-4o-mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
      { value: 'custom', label: '自定义' }
    ];

    var refs = this.hud.buildConfigPanel(providers, this._config, models);

    // Show API base for custom provider
    if (refs.provider) {
      refs.provider.addEventListener('change', function () {
        var isCustom = refs.provider.value === 'custom';
        self.hud.setApiBaseVisible(isCustom);
      });
    }

    // Save handler
    if (refs.saveBtn) {
      refs.saveBtn.addEventListener('click', function () {
        var newConfig = {
          provider: refs.provider ? refs.provider.value : '',
          apiKey: refs.apiKey ? refs.apiKey.value : '',
          apiBase: refs.apiBase ? refs.apiBase.value : '',
          model: refs.model ? refs.model.value : '',
          particleCount: refs.particleCount ? parseInt(refs.particleCount.value, 10) || 400 : 400
        };

        // Save to localStorage via SIProviders
        if (window.SIProviders && typeof SIProviders.save === 'function') {
          SIProviders.save(function () { return newConfig.particleCount; });
        }

        // Apply particle count
        if (newConfig.particleCount !== self._particleCount) {
          self._particleCount = newConfig.particleCount;
          self.particles.rebuild(self._particleCount);
          self.hud.setParticleCount(self._particleCount);
        }

        self._config = newConfig;
        localStorage.setItem('si_config', JSON.stringify(newConfig));
        self.hud.togglePanel(false);
        self.hud.showStatus('CONFIG SAVED');
      });
    }

    // Test handler
    if (refs.testBtn) {
      refs.testBtn.addEventListener('click', function () {
        if (window.SIProviders && typeof SIProviders.test === 'function') {
          SIProviders.test();
        } else {
          self.hud.showStatus('TEST: providers not available');
        }
      });
    }
  };

  /* ================================================================
     Private — Helpers
     ================================================================ */

  SpiritInk.prototype._onResize = function () {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    this._composer.setSize(window.innerWidth, window.innerHeight);
  };

  SpiritInk.prototype._getAllTokensMap = function () {
    if (!this._currentPackData) return {};
    var map = {};
    var base = this._currentPackData.base_tokens || {};
    var scene = this._currentPackData.scene_tokens || {};
    for (var k in base) {
      if (base.hasOwnProperty(k)) map[k] = base[k];
    }
    for (var s in scene) {
      if (scene.hasOwnProperty(s)) map[s] = scene[s];
    }
    return map;
  };

  SpiritInk.prototype._loadConfig = function () {
    try {
      var stored = localStorage.getItem('si_config');
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return {
      provider: 'zhipu',
      apiKey: '',
      apiBase: '',
      model: 'glm-4-flash',
      particleCount: 400
    };
  };

  /* ---------- export ---------- */
  window.SpiritInk = SpiritInk;
})();
