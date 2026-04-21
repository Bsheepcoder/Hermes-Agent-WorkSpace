/**
 * Spirit Ink — 多模型提供商配置组件
 * 独立模块，可单独维护。主文件通过 <script src="providers.js"> 引入。
 *
 * 导出全局对象 window.SIProviders，包含：
 *   - PROVIDERS: 提供商列表
 *   - init(): 初始化UI
 *   - save(): 保存配置
 *   - test(): 测试连接
 *   - getApiKey(): 当前key
 *   - getModel(): 当前model
 *   - call(systemPrompt, messages): 发送请求（返回 {content, usage}）
 */

window.SIProviders = (() => {

  // ==================== 提供商定义 ====================
  // 增删提供商只需修改这个数组
  const PROVIDERS = [
    {
      id: 'zhipu',
      name: '智谱 GLM',
      apiBase: 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions',
      authHeader: 'Bearer',
      format: 'openai',  // openai | claude
      models: [
        { id: 'glm-5',        name: 'GLM-5 · 旗舰' },
        { id: 'glm-5-turbo',  name: 'GLM-5-Turbo · 长程' },
        { id: 'glm-4.7',      name: 'GLM-4.7 · 高智能' },
        { id: 'glm-4.6',      name: 'GLM-4.6 · 超强' },
        { id: 'glm-4.5-air',  name: 'GLM-4.5-Air · 性价比' },
      ]
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      apiBase: 'https://api.openai.com/v1/chat/completions',
      authHeader: 'Bearer',
      format: 'openai',
      models: [
        { id: 'gpt-4o',       name: 'GPT-4o' },
        { id: 'gpt-4o-mini',  name: 'GPT-4o-mini · 快' },
        { id: 'o3-mini',      name: 'o3-mini · 推理' },
      ]
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      apiBase: 'https://api.anthropic.com/v1/messages',
      authHeader: 'x-api-key',
      format: 'claude',
      extraHeaders: {
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      models: [
        { id: 'claude-sonnet-4-20250514',    name: 'Claude Sonnet 4' },
        { id: 'claude-3-5-sonnet-20241022',  name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-20241022',   name: 'Claude 3.5 Haiku · 快' },
      ]
    },
    {
      id: 'kimi',
      name: 'Kimi 月之暗面',
      apiBase: 'https://api.moonshot.cn/v1/chat/completions',
      authHeader: 'Bearer',
      format: 'openai',
      models: [
        { id: 'kimi-k2.5',             name: 'Kimi K2.5 · 最新' },
        { id: 'moonshot-v1-128k',     name: 'Moonshot v1 · 128K' },
        { id: 'moonshot-v1-32k',      name: 'Moonshot v1 · 32K' },
      ]
    },
    {
      id: 'minimax',
      name: 'MiniMax',
      apiBase: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
      authHeader: 'Bearer',
      format: 'openai',
      models: [
        { id: 'MiniMax-M2.7',  name: 'M2.7 · 最新' },
        { id: 'MiniMax-M2.5',  name: 'M2.5' },
      ]
    },
    {
      id: 'custom',
      name: '自定义',
      apiBase: '',
      authHeader: 'Bearer',
      format: 'openai',
      models: [],
      customApiBase: true
    }
  ];

  // ==================== 状态 ====================
  let _providerId = localStorage.getItem('si_provider') || 'zhipu';
  let _apiKey     = localStorage.getItem('si_k') || '';
  let _model      = localStorage.getItem('si_m') || 'glm-5';
  let _customUrl  = localStorage.getItem('si_apiBase') || '';

  function _get(id) { return PROVIDERS.find(p => p.id === (id || _providerId)) || PROVIDERS[0]; }

  // ==================== UI ====================
  function _onProviderChange() {
    const p = _get(document.getElementById('cProvider').value);
    const sel = document.getElementById('cModel');
    sel.innerHTML = '';
    p.models.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.name; sel.appendChild(o);
    });
    // 自定义模式显示API地址输入框
    const show = p.customApiBase;
    document.getElementById('cApiBaseRow').style.display = show ? 'block' : 'none';
    if (show) document.getElementById('cApiBase').value = _customUrl;
  }

  function _cfgMsg(t, ok) {
    const e = document.getElementById('cMsg');
    e.textContent = t;
    e.className = 'cmsg show ' + (ok ? 'ok' : 'err');
    setTimeout(() => e.classList.remove('show'), 4000);
  }

  // ==================== 公开方法 ====================

  /** 初始化配置面板UI，在页面加载后调用 */
  function init() {
    // 填充提供商下拉
    const sel = document.getElementById('cProvider');
    PROVIDERS.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name; sel.appendChild(o);
    });
    sel.value = _providerId;
    sel.onchange = _onProviderChange;
    _onProviderChange();

    // 恢复已保存的值
    document.getElementById('cKey').value = _apiKey;
    if (_apiKey) document.getElementById('bCfg').classList.add('on');
  }

  /** 保存当前面板配置到 localStorage，返回 {providerId, apiKey, model, N} */
  function save(getParticleCount) {
    _providerId = document.getElementById('cProvider').value;
    _apiKey     = document.getElementById('cKey').value.trim();
    _model      = document.getElementById('cModel').value;
    _customUrl  = document.getElementById('cApiBase').value.trim();
    const N     = getParticleCount ? getParticleCount() : 100;

    localStorage.setItem('si_provider', _providerId);
    localStorage.setItem('si_k', _apiKey);
    localStorage.setItem('si_m', _model);
    localStorage.setItem('si_apiBase', _customUrl);

    const name = _get().name;
    _cfgMsg('✓ 已保存 (' + name + ' / ' + _model + ' / 粒子:' + N + ')', true);
    if (_apiKey) document.getElementById('bCfg').classList.add('on');
    return { providerId: _providerId, apiKey: _apiKey, model: _model, N };
  }

  /** 测试当前配置的API连接 */
  async function test() {
    const k = document.getElementById('cKey').value.trim();
    if (!k) { _cfgMsg('✗ 请输入Key', false); return; }
    _cfgMsg('测试中...', true);
    const pid = document.getElementById('cProvider').value;
    const p = _get(pid);
    const mid = document.getElementById('cModel').value;
    const url = p.customApiBase ? document.getElementById('cApiBase').value.trim() : p.apiBase;
    if (!url) { _cfgMsg('✗ 请填写API地址', false); return; }
    try {
      const headers = { 'Content-Type': 'application/json', [p.authHeader]: k };
      Object.assign(headers, p.extraHeaders || {});
      const body = p.format === 'claude'
        ? JSON.stringify({ model: mid, max_tokens: 20, messages: [{ role: 'user', content: 'hi' }] })
        : JSON.stringify({ model: mid, messages: [{ role: 'user', content: 'hi' }], max_tokens: 20 });
      const r = await fetch(url, { method: 'POST', headers, body });
      _cfgMsg(r.ok ? '✓ 连接成功' : '✗ ' + JSON.stringify(await r.json()).slice(0, 100), r.ok);
    } catch (e) { _cfgMsg('✗ ' + e.message, false); }
  }

  /** 获取当前API Key */
  function getApiKey() { return _apiKey; }

  /** 获取当前模型ID */
  function getModel() { return _model; }

  /** 获取当前提供商信息 */
  function getProvider() { return _get(); }

  /**
   * 发送AI请求（统一入口）
   * @param {string} systemPrompt - 系统提示词
   * @param {Array} messages - 对话历史 [{role, content}]
   * @param {Object} opts - { maxTokens, temperature }
   * @returns {{ content: string, usage: {input, output}, raw: Object }}
   */
  async function call(systemPrompt, messages, opts = {}) {
    const { maxTokens = 4096, temperature = 0.85 } = opts;
    const p = _get();
    const url = p.customApiBase ? _customUrl : p.apiBase;

    const headers = { 'Content-Type': 'application/json', [p.authHeader]: _apiKey };
    Object.assign(headers, p.extraHeaders || {});

    let body;
    if (p.format === 'claude') {
      body = JSON.stringify({ model: _model, max_tokens: maxTokens, temperature, system: systemPrompt, messages });
    } else {
      body = JSON.stringify({ model: _model, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, ...messages] });
    }

    let r = await fetch(url, { method: 'POST', headers, body });
    if (r.status === 429) {
      await new Promise(res => setTimeout(res, 5000));
      r = await fetch(url, { method: 'POST', headers, body });
    }
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error('HTTP ' + r.status + ' · ' + JSON.stringify(err).slice(0, 150));
    }

    const data = await r.json();
    let content;
    if (p.format === 'claude') {
      content = data.content?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }

    const u = data.usage || {};
    return {
      content,
      raw: data,
      usage: {
        input: u.prompt_tokens || u.input_tokens || 0,
        output: u.completion_tokens || u.output_tokens || 0,
        total: u.total_tokens || 0
      }
    };
  }

  return { PROVIDERS, init, save, test, getApiKey, getModel, getProvider, call };
})();
