/* ============================================================
   Spirit Ink v4.0 — HUD Overlay Renderer
   Creates and manages all HUD DOM elements over the WebGL canvas.
   No external dependencies. Exports HUD to window via IIFE.
   ============================================================ */
(function () {
  'use strict';

  // ────────────────────────────── helpers ──────────────────────────────

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, parent) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  }

  function svgEl(tag, attrs, parent) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) node.setAttribute(k, attrs[k]);
      }
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  // ────────────────────────────── HUD class ───────────────────────────

  /**
   * @param {HTMLElement} container — the overlay div that sits on top of the canvas
   */
  function HUD(container) {
    this._container = container;
    this._els = {};            // cached DOM references
    this._timeInterval = null; // clock updater handle
    this._fpsFrames = 0;
    this._fpsLast = 0;
    this._fps = 0;
    this._scanActive = false;
    this._particleCount = 0;
  }

  // ─────────────────────────────── init ───────────────────────────────

  /**
   * Build all HUD DOM elements inside the container.
   * Call once after the container is in the DOM.
   */
  HUD.prototype.init = function () {
    var c = this._container;
    var self = this;
    var e = this._els;

    // ── Corner brackets (4 corners) ──
    e.corners = {
      tl: el('div', 'si-corner si-corner--tl', c),
      tr: el('div', 'si-corner si-corner--tr', c),
      bl: el('div', 'si-corner si-corner--bl', c),
      br: el('div', 'si-corner si-corner--br', c),
    };

    // ── Arc reactor center ──
    var reactor = el('div', 'si-reactor', c);
    el('div', 'si-reactor__ring si-reactor__ring--1', reactor);
    el('div', 'si-reactor__ring si-reactor__ring--2', reactor);
    el('div', 'si-reactor__ring si-reactor__ring--3', reactor);
    e.reactorCore = el('div', 'si-reactor__core', reactor);
    e.reactor = reactor;

    // ── Data ring (SVG with tick marks) ──
    var dataRing = el('div', 'si-data-ring', c);
    var svg = svgEl('svg', { viewBox: '0 0 200 200' }, dataRing);
    // Outer ring — dashed
    svgEl('circle', {
      cx: '100', cy: '100', r: '95',
      fill: 'none', stroke: 'rgba(0,212,255,0.06)', 'stroke-width': '0.5',
      'stroke-dasharray': '4 8'
    }, svg);
    // Inner ring
    svgEl('circle', {
      cx: '100', cy: '100', r: '85',
      fill: 'none', stroke: 'rgba(0,212,255,0.04)', 'stroke-width': '0.5',
      'stroke-dasharray': '2 12'
    }, svg);
    // Tick marks (24 ticks around outer edge)
    for (var i = 0; i < 24; i++) {
      var angle = (i / 24) * Math.PI * 2;
      var x1 = 100 + Math.cos(angle) * 92;
      var y1 = 100 + Math.sin(angle) * 92;
      var x2 = 100 + Math.cos(angle) * 96;
      var y2 = 100 + Math.sin(angle) * 96;
      svgEl('line', {
        x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: 'rgba(0,212,255,0.08)', 'stroke-width': '0.5'
      }, svg);
    }
    e.dataRing = dataRing;

    // ── Scan line ──
    e.scanLine = el('div', 'si-scan-line', c);

    // ── HUD text labels ──
    e.textTL = el('div', 'si-hud-text si-hud-text--tl', c);
    e.textTL.textContent = 'SPIRIT INK // DESIGN TOKEN ENGINE';

    e.textTR = el('div', 'si-hud-text si-hud-text--tr', c);
    e.textTR.textContent = '--:--:--';

    e.textBL = el('div', 'si-hud-text si-hud-text--bl', c);
    e.textBL.textContent = 'TOKENS: 0 ACTIVE';

    e.textBR = el('div', 'si-hud-text si-hud-text--br', c);
    e.textBR.textContent = '0 FPS / 0 PARTICLES';

    // ── Token display (left side, vertical list) ──
    e.tokenDisplay = el('div', 'si-token-display', c);

    // ── Token status bar (bottom center, horizontal pills) ──
    e.tokenBar = el('div', 'si-token-bar', c);

    // ── Version tag ──
    var ver = el('div', 'si-version', c);
    ver.textContent = 'SPIRIT INK v4.0';

    // ── Status text (above chat input area) ──
    e.statusText = el('div', 'si-status', c);

    // ── Chat input area (bottom center, interactive) ──
    e.inputWrap = el('div', 'si-input-wrap', c);
    var inputRow = el('div', 'si-input-row', e.inputWrap);
    e.inputField = el('input', 'si-input', inputRow);
    e.inputField.type = 'text';
    e.inputField.placeholder = '对灵墨说话...';
    e.inputField.autocomplete = 'off';
    e.inputField.spellcheck = false;
    e.sendBtn = el('button', 'si-send-btn', inputRow);
    e.sendBtn.textContent = 'SEND';

    // ── Pack selector bar (bottom-left, interactive) ──
    e.packBar = el('div', 'si-pack-bar', c);

    // ── Toolbar (top-right, interactive) ──
    var toolbar = el('div', 'si-toolbar', c);
    e.configBtn = el('button', 'si-toolbar-btn si-toolbar-btn--config', toolbar);
    e.configBtn.title = 'Config';
    e.configBtn.innerHTML = '&#9881;'; // ⚙

    // ── Config panel (slide-in from right, interactive) ──
    e.configPanel = el('div', 'si-panel', c);
    var panelHeader = el('div', 'si-panel__header', e.configPanel);
    var panelTitle = el('span', '', panelHeader);
    panelTitle.textContent = 'CONFIG';
    e.panelCloseBtn = el('button', 'si-panel__close', panelHeader);
    e.panelCloseBtn.innerHTML = '&#10005;';

    e.panelBody = el('div', 'si-panel__body', e.configPanel);

    // ── Start the clock ──
    this._startClock();
  };

  // ──────────────────────────── clock helper ──────────────────────────

  HUD.prototype._startClock = function () {
    var self = this;
    this._timeInterval = setInterval(function () {
      if (self._els.textTR) {
        self._els.textTR.textContent = new Date().toLocaleTimeString();
      }
    }, 1000);
  };

  // ────────────────────────────── update ──────────────────────────────

  /**
   * Call once per animation frame with the latest spring values.
   *
   * @param {object}  springValues  — from SpringPool.getCurrentValues()
   * @param {string[]} activeTokens — token names currently active
   * @param {boolean} isThinking    — whether AI is processing
   */
  HUD.prototype.update = function (springValues, activeTokens, isThinking) {
    if (!springValues) springValues = {};
    if (!activeTokens) activeTokens = [];

    var e = this._els;

    // FPS counter (simple frame counting — caller should call per-frame)
    var now = performance.now();
    this._fpsFrames++;
    if (now - this._fpsLast >= 1000) {
      this._fps = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsLast = now;
    }

    // Diagnostic readout (top-left + bottom-right)
    if (e.textBR) {
      e.textBR.textContent = this._fps + ' FPS / ' + this._particleCount + ' PARTICLES';
    }

    // Reactor pulse — modulate core glow with spring glow value
    if (e.reactorCore) {
      var glow = springValues.glow || 0.5;
      var scale = springValues.scale || 1;
      var coreR = Math.round(glow * 12 + 4);
      e.reactorCore.style.width = (coreR * scale) + 'px';
      e.reactorCore.style.height = (coreR * scale) + 'px';
      var glowColor = 'rgba(' +
        Math.round((springValues.colorR || 0) * 255) + ',' +
        Math.round((springValues.colorG || 0.83) * 255) + ',' +
        Math.round((springValues.colorB || 1) * 255) + ',';
      e.reactorCore.style.background =
        'radial-gradient(circle,' + glowColor + (glow * 0.9).toFixed(2) + '),' + glowColor + '0)';
      e.reactorCore.style.boxShadow =
        '0 0 ' + Math.round(glow * 30) + 'px ' + glowColor + (glow * 0.6).toFixed(2) + '),' +
        '0 0 ' + Math.round(glow * 60) + 'px ' + glowColor + (glow * 0.3).toFixed(2) + ')';

      // Thinking state — speed up reactor pulse
      if (isThinking) {
        e.reactor.classList.add('si-reactor--thinking');
      } else {
        e.reactor.classList.remove('si-reactor--thinking');
      }
    }

    // Data ring speed — driven by spring speed value
    if (e.dataRing) {
      var speed = Math.max(0.5, (springValues.speed || 0.3) * 20);
      e.dataRing.style.animationDuration = speed.toFixed(1) + 's';
    }
  };

  // ─────────────────────────── setScanActive ──────────────────────────

  /**
   * Control scan line visibility and intensity.
   * @param {boolean} active
   */
  HUD.prototype.setScanActive = function (active) {
    this._scanActive = !!active;
    if (this._els.scanLine) {
      if (this._scanActive) {
        this._els.scanLine.classList.add('si-scan-line--active');
      } else {
        this._els.scanLine.classList.remove('si-scan-line--active');
      }
    }
  };

  // ─────────────────────── setTokenDisplay ────────────────────────────

  /**
   * Show which tokens are currently active in both the sidebar list
   * and the bottom token bar.
   *
   * @param {string[]} activeNames  — active token IDs (e.g. ['joy', 'wonder'])
   * @param {object}   allTokens    — map of { tokenId: { display: string } }
   */
  HUD.prototype.setTokenDisplay = function (activeNames, allTokens) {
    if (!activeNames) activeNames = [];
    if (!allTokens) allTokens = {};

    var e = this._els;

    // Left sidebar token items
    if (e.tokenDisplay) {
      var html = '';
      for (var id in allTokens) {
        if (!allTokens.hasOwnProperty(id)) continue;
        var isActive = activeNames.indexOf(id) !== -1;
        var cls = 'si-token-item' + (isActive ? ' si-token-item--active' : '');
        var label = allTokens[id].display || id;
        html += '<div class="' + cls + '">' + label + '</div>';
      }
      e.tokenDisplay.innerHTML = html;
    }

    // Bottom token bar — pills for active tokens only
    if (e.tokenBar) {
      var barHtml = '';
      for (var j = 0; j < activeNames.length; j++) {
        var name = activeNames[j];
        var tokenDef = allTokens[name] || {};
        var display = tokenDef.display || name;
        barHtml += '<span class="si-token-pill">' + display.toUpperCase() + '</span>';
      }
      if (barHtml === '') {
        barHtml = '<span class="si-token-pill si-token-pill--idle">IDLE</span>';
      }
      e.tokenBar.innerHTML = barHtml;
    }

    // Bottom-left HUD text — token count
    if (e.textBL) {
      var names = activeNames.join(' / ').toUpperCase();
      e.textBL.textContent = 'TOKENS: ' + activeNames.length + ' ACTIVE' +
        (names ? ' — ' + names : '');
    }
  };

  // ──────────────────────── showStatus ────────────────────────────────

  /**
   * Update the status text element (AI response or system message).
   * @param {string} text
   */
  HUD.prototype.showStatus = function (text) {
    if (this._els.statusText) {
      this._els.statusText.textContent = text || '';
      // Quick fade-in
      this._els.statusText.classList.remove('si-status--visible');
      // Force reflow to restart transition
      void this._els.statusText.offsetWidth;
      this._els.statusText.classList.add('si-status--visible');
    }
  };

  // ───────────────────── setParticleCount ─────────────────────────────

  /**
   * Update the particle count shown in the FPS readout.
   * @param {number} n
   */
  HUD.prototype.setParticleCount = function (n) {
    this._particleCount = n || 0;
  };

  // ──────────────────── buildPackButtons ──────────────────────────────

  /**
   * Populate the pack selector bar with buttons.
   * @param {Array<{id:string, label:string, emoji:string}>} packs
   * @param {string}  activePackId
   * @param {function} onSelect — callback(packId)
   */
  HUD.prototype.buildPackButtons = function (packs, activePackId, onSelect) {
    var e = this._els;
    if (!e.packBar) return;

    e.packBar.innerHTML = '';
    var self = this;

    for (var i = 0; i < packs.length; i++) {
      (function (pack) {
        var btn = el('button', 'si-pack-btn', e.packBar);
        if (pack.id === activePackId) btn.classList.add('si-pack-btn--active');
        btn.title = pack.label || pack.id;
        btn.innerHTML = '<span class="si-pack-btn__label">' + (pack.label || pack.id) + '</span>' +
                        '<span class="si-pack-btn__icon">' + (pack.emoji || '') + '</span>';
        btn.addEventListener('click', function () {
          // Deactivate all siblings
          var all = e.packBar.querySelectorAll('.si-pack-btn');
          for (var j = 0; j < all.length; j++) all[j].classList.remove('si-pack-btn--active');
          btn.classList.add('si-pack-btn--active');
          if (typeof onSelect === 'function') onSelect(pack.id);
        });
      })(packs[i]);
    }
  };

  // ──────────────────── buildConfigPanel ──────────────────────────────

  /**
   * Populate the config panel body with standard Spirit Ink fields.
   * Returns an object with references to the created inputs so the caller
   * can read values.
   *
   * @param {Array<{value:string, label:string}>} providers — provider option entries
   * @param {object} currentConfig — { provider, apiKey, apiBase, model, particleCount }
   * @param {Array<{value:string, label:string}>} models — model option entries
   * @returns {object} { provider, apiKey, apiBase, model, particleCount } — DOM elements
   */
  HUD.prototype.buildConfigPanel = function (providers, currentConfig, models) {
    var body = this._els.panelBody;
    if (!body) return {};
    body.innerHTML = '';

    var cfg = currentConfig || {};

    // Provider select
    var provLabel = el('label', '', body);
    provLabel.textContent = 'AI 提供商';
    var provSelect = el('select', 'si-panel__select', body);
    for (var p = 0; p < (providers || []).length; p++) {
      var opt = el('option', '', provSelect);
      opt.value = providers[p].value;
      opt.textContent = providers[p].label;
      if (providers[p].value === cfg.provider) opt.selected = true;
    }

    // API Key
    var keyLabel = el('label', '', body);
    keyLabel.textContent = 'API Key';
    var keyInput = el('input', 'si-panel__input', body);
    keyInput.type = 'password';
    keyInput.placeholder = '粘贴 API Key...';
    if (cfg.apiKey) keyInput.value = cfg.apiKey;

    // API Base (hidden by default)
    var apiBaseRow = el('div', 'si-panel__row', body);
    apiBaseRow.style.display = 'none';
    var apiBaseLabel = el('label', '', apiBaseRow);
    apiBaseLabel.textContent = 'API 地址';
    var apiBaseInput = el('input', 'si-panel__input', apiBaseRow);
    apiBaseInput.type = 'text';
    apiBaseInput.placeholder = 'https://...';
    if (cfg.apiBase) apiBaseInput.value = cfg.apiBase;

    // Model select
    var modelLabel = el('label', '', body);
    modelLabel.textContent = '模型';
    var modelSelect = el('select', 'si-panel__select', body);
    for (var m = 0; m < (models || []).length; m++) {
      var mOpt = el('option', '', modelSelect);
      mOpt.value = models[m].value;
      mOpt.textContent = models[m].label;
      if (models[m].value === cfg.model) mOpt.selected = true;
    }

    // Particle count
    var partLabel = el('label', '', body);
    partLabel.textContent = '粒子数量';
    var partInput = el('input', 'si-panel__input', body);
    partInput.type = 'number';
    partInput.min = '50';
    partInput.max = '2000';
    partInput.step = '50';
    partInput.value = cfg.particleCount || 400;

    // Buttons row
    var btnRow = el('div', 'si-panel__btn-row', body);
    var saveBtn = el('button', 'si-panel__btn', btnRow);
    saveBtn.textContent = '保存';
    var testBtn = el('button', 'si-panel__btn', btnRow);
    testBtn.textContent = '测试';

    return {
      provider: provSelect,
      apiKey: keyInput,
      apiBaseRow: apiBaseRow,
      apiBase: apiBaseInput,
      model: modelSelect,
      particleCount: partInput,
      saveBtn: saveBtn,
      testBtn: testBtn,
    };
  };

  // ────────────────────── panel toggle ────────────────────────────────

  /**
   * Show or hide the config panel.
   * @param {boolean} [force] — true = show, false = hide, undefined = toggle
   */
  HUD.prototype.togglePanel = function (force) {
    if (this._els.configPanel) {
      var show = (force !== undefined) ? !!force : !this._els.configPanel.classList.contains('si-panel--open');
      if (show) {
        this._els.configPanel.classList.add('si-panel--open');
      } else {
        this._els.configPanel.classList.remove('si-panel--open');
      }
    }
  };

  // ──────────────────── input event helpers ───────────────────────────

  /**
   * Set a callback for the send button and Enter key in the input field.
   * @param {function} onSend — called with the trimmed input text
   */
  HUD.prototype.onSend = function (onSend) {
    var self = this;
    if (this._els.sendBtn) {
      this._els.sendBtn.addEventListener('click', function () {
        var text = self._els.inputField.value.trim();
        if (text && typeof onSend === 'function') onSend(text);
      });
    }
    if (this._els.inputField) {
      this._els.inputField.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          var text = self._els.inputField.value.trim();
          if (text && typeof onSend === 'function') onSend(text);
        }
      });
    }
  };

  /**
   * Set callback for the config toggle button and panel close button.
   * @param {function} onToggle
   */
  HUD.prototype.onConfigToggle = function (onToggle) {
    var self = this;
    if (this._els.configBtn) {
      this._els.configBtn.addEventListener('click', function () {
        self.togglePanel();
        if (typeof onToggle === 'function') onToggle();
      });
    }
    if (this._els.panelCloseBtn) {
      this._els.panelCloseBtn.addEventListener('click', function () {
        self.togglePanel(false);
        if (typeof onToggle === 'function') onToggle();
      });
    }
  };

  /**
   * Enable or disable the input + send button (e.g. while thinking).
   * @param {boolean} disabled
   */
  HUD.prototype.setInputEnabled = function (disabled) {
    if (this._els.inputField) this._els.inputField.disabled = !!disabled;
    if (this._els.sendBtn) this._els.sendBtn.disabled = !!disabled;
  };

  /**
   * Clear the input field text.
   */
  HUD.prototype.clearInput = function () {
    if (this._els.inputField) this._els.inputField.value = '';
  };

  /**
   * Set the config panel apiBaseRow visibility.
   * @param {boolean} visible
   */
  HUD.prototype.setApiBaseVisible = function (visible) {
    var body = this._els.panelBody;
    if (!body) return;
    var row = body.querySelector('.si-panel__row');
    if (row) row.style.display = visible ? 'block' : 'none';
  };

  // ─────────────────────────── dispose ───────────────────────────────

  /**
   * Remove all created elements and stop timers.
   */
  HUD.prototype.dispose = function () {
    if (this._timeInterval) {
      clearInterval(this._timeInterval);
      this._timeInterval = null;
    }
    this._container.innerHTML = '';
    this._els = {};
  };

  // ─────────────────────────── export ────────────────────────────────

  window.HUD = HUD;
})();
