# Spirit Ink v4.0 — 全面诊断报告

生成时间: 2026-04-22

---

## 一、版本确认

| 文件 | 确认内容 |
|------|---------|
| `vendor/three/three.min.js` | ✅ r128 (REVISION="128", 2021) |
| `vendor/three/postprocessing.bundle.js` | 手工 IIFE 转换，源自 three/addons r152 |

---

## 二、已知问题确认（修复状态）

### ✅ 已修复

| 问题 | 位置 | 状态 |
|------|------|------|
| `luminance()` → `linearToRelativeLuminance()` | `postprocessing.bundle.js:90` | ✅ 正确使用 `linearToRelativeLuminance(texel.xyz)` |
| `LinearTosRGB` 内联 | `postprocessing.bundle.js:54-57` | ✅ GammaCorrectionShader 中已内联 |
| DOMContentLoaded | `index.html:95-99` | ✅ `readyState === 'loading'` 判断 + fallback |
| appendChild null | `app.js:201` | ✅ `container` 在 DOM ready 后获取，且有 try-catch |

---

## 三、新发现的问题（按严重程度排序）

### 🔴 严重 — 运行时必崩

#### 问题 1: `EffectComposer.render()` 中 `renderer.state.buffers.stencil` — 低风险但需验证
- **文件**: `postprocessing.bundle.js:263-266`
- **代码**: `this.renderer.state.buffers.stencil.setFunc(...)` / `.setTest(...)`
- **分析**: 经源码验证，r128 的 WebGLState 确实有 `buffers: {color, depth, stencil}` 结构，stencil 对象包含 `setTest()` 和 `setFunc()` 方法。**与 r128 兼容，不是问题。**
- **严重度**: ✅ 无问题

#### 问题 2: `SIProviders.init()` 引用不存在的 DOM 元素 — 严重
- **文件**: `providers.js:106-143`
- **代码**: `SIProviders.init()` 引用 `getElementById('cProvider')`, `getElementById('cKey')`, `getElementById('cModel')` 等
- **问题**: `app.js:122-123` 在 `init()` 最后调用 `SIProviders.init()`。但 `providers.js` 中的 `init()` 期望这些 DOM 元素已经存在，而 HUD 创建的配置面板（通过 `hud.buildConfigPanel()`）并没有设置这些 ID。HUD 的 `buildConfigPanel()` 创建的 `<select>` 和 `<input>` **没有设置任何 id 属性**。
- **影响**: `SIProviders.init()` 会抛出 `Cannot read properties of null (reading 'value')`，但由于在 `app.js:122` 有条件检查且 `init()` 被 try-catch 包裹（在 boot() 中），不会完全阻塞应用启动。**但是 `SIProviders.save()` 和 `SIProviders.test()` 也会因为引用同样的不存在的 DOM 元素而崩溃。**
- **严重度**: 🔴 HIGH — AI 调用链完全断裂

#### 问题 3: `app.js` 和 `providers.js` 配置面板双重构建 — 逻辑冲突
- **文件**: `app.js:350-428` 和 `providers.js:129-143`
- **问题**: `app.js._buildConfigPanel()` 通过 HUD API 创建一套配置面板（无 ID），然后 `SIProviders.init()` 又试图操控一套完全不同的、不存在的 DOM 元素（带 `cProvider` 等 ID）。两套代码操作的不是同一个 DOM。
- **影响**: 配置保存/读取/测试全部失效。
- **严重度**: 🔴 HIGH

#### 问题 4: `_handleUserInput` 中 `setInputEnabled(true)` 语义反转
- **文件**: `app.js:275`
- **代码**: `this.hud.setInputEnabled(true)` 在 AI 思考开始时调用
- **分析**: 查看 `hud.js:520-523`，`setInputEnabled(disabled)` 的参数名暗示传入 true = disabled。调用 `setInputEnabled(true)` 实际上**禁用**了输入。然后在 `then()` 回调的 283 行调用 `setInputEnabled(false)` 来**启用**输入。语义虽然反直觉但逻辑正确——传入值确实是 disabled 状态。
- **严重度**: ⚠️ MEDIUM — 代码工作正常但极易误读和引入 bug。建议重命名为 `setInputDisabled(disabled)` 或反转逻辑。

### 🟡 中等 — 功能异常

#### 问题 5: `ParticleRenderer` 相机 Z 轴位置漂移
- **文件**: `particle.js:338-349`
- **代码**: `_applyCameraShake()` 修改 `cam.position.x` 和 `cam.position.y`，但没有恢复 `cam.position.z`。初始值 z=3 在 `app.js:194` 设置。由于 shake 只操作 x/y，z 不会漂移。
- **问题**: 当 `sv.camShake < 0.01` 时，代码 `cam.position.x *= 0.9` 逐渐衰减 x/y 到接近 0，这是正确的。
- **严重度**: ✅ 无问题（但设计上依赖于 `_animate` 每帧调用，如果暂停动画 loop 则相机位置会卡住）

#### 问题 6: `switchPack()` 后 bloom strength 未从 pack 数据同步
- **文件**: `app.js:159-160`
- **代码**: 只同步了 `this._bloomPass.threshold`，但 pack 数据中 `bloom.strength` 没有被应用到 `this._bloomPass.strength`
- **问题**: 初始化时 `UnrealBloomPass` 的 strength 参数是 0.4（硬编码），pack 定义中 `"strength": 0.4`。切换 pack 时 threshold 更新了但 strength 没更新。
- **影响**: 所有 pack 共享同一个初始 bloom strength（0.4），只有 threshold 会随 pack 变化。后续 strength 会被 `particle.js:84-86` 的 spring 值覆盖，所以实际影响有限。
- **严重度**: ⚠️ MEDIUM — bloom strength 初始值不跟 pack 走

#### 问题 7: `_disposeDecoration()` 中潜在 use-after-free
- **文件**: `particle.js:302-311`
- **代码**: 
  ```javascript
  if (this._dMesh) { this._scene.remove(this._dMesh); }
  if (this._dGeo) this._dGeo.dispose();
  if (this._dMesh && this._dMesh.material) this._dMesh.material.dispose(); // ← _dMesh still accessible
  ```
- **问题**: `_scene.remove(_dMesh)` 只是移除引用，对象本身仍然在内存中（除非被 GC）。所以第三行访问 `_dMesh.material` 不会崩溃。但 `_dMesh = null` 赋值在之后，所以顺序虽然不优雅但安全。
- **严重度**: ✅ 安全（代码风格问题）

### 🟢 轻微 — 代码质量/潜在风险

#### 问题 8: `spring.js` 使用 ES6 class 语法而其他文件用 IIFE+prototype
- **文件**: `spring.js:7-95`
- **问题**: `Spring` 和 `SpringPool` 使用 ES6 `class` 语法，而 `token-engine.js`、`particle.js`、`hud.js` 等都用 IIFE + `function.prototype` 模式。
- **影响**: 在支持 ES6 的现代浏览器中没有功能问题，但风格不一致。更重要的是，ES6 class 不能被 `new` 以外的方式调用，而 IIFE 模式的构造函数可以。
- **严重度**: ⚠️ LOW — 风格不一致，file:// 协议下需要支持 ES6 的浏览器

#### 问题 9: `ShaderMaterial` 自定义 shader 中 `#include <common>` 依赖
- **文件**: `postprocessing.bundle.js:81,583`
- **代码**: `LuminosityHighPassShader.fragmentShader` 和 `getSeperableBlurMaterial` 的 fragment shader 都用了 `#include <common>`
- **分析**: r128 的 WebGLProgram 有完整的 `#include` 解析机制（函数 `Vr`），会从 `ShaderChunk`（变量 `hi`）中查找对应 chunk。`common` chunk 确实存在于 r128 中，包含 `linearToRelativeLuminance` 定义。
- **严重度**: ✅ 无问题

#### 问题 10: `WebGLRenderTarget.texture.generateMipmaps` 在 r128 中的行为
- **文件**: `postprocessing.bundle.js:383,388,393`
- **代码**: `renderTarget.texture.generateMipmaps = false`
- **分析**: 在 r128 中，`WebGLRenderTarget` 的 texture 属性是一个 `Texture` 对象，`generateMipmaps` 是 Texture 的一个可配置属性。Three.js 在上传纹理到 GPU 时会检查此属性来决定是否生成 mipmap。这兼容 r128。
- **严重度**: ✅ 无问题

#### 问题 11: `FullscreenTriangleGeometry` 使用 `Reflect.construct` — 正确
- **文件**: `postprocessing.bundle.js:104-108`
- **代码**: `Reflect.construct(THREE.BufferGeometry, [], FullscreenTriangleGeometry)`
- **分析**: 这是处理 r128+ 中 `BufferGeometry` 作为 ES6 class（不能用 `new` 直接调用的 polyfill）的正确方式。代码正确。
- **严重度**: ✅ 无问题

#### 问题 12: `prompt-builder.js` 使用 `Object.entries()` — ES2017
- **文件**: `prompt-builder.js:18,24`
- **代码**: `Object.entries(pack.base_tokens).map(...)`
- **影响**: 需要 ES2017+ 浏览器。现代浏览器都支持，file:// 协议没有 ES module 限制所以不影响。
- **严重度**: ⚠️ LOW — 需要现代浏览器

#### 问题 13: `providers.js` 使用箭头函数、模板字符串、可选链等 ES6+ 特性
- **文件**: `providers.js` 全文
- **代码**: 大量使用 `const`, `let`, 箭头函数, `?.`, `` `${}` ``
- **影响**: 与项目其他文件的 ES5 风格不一致。需要现代浏览器（IE 不支持）。
- **严重度**: ⚠️ LOW — 与项目风格不一致但不影响功能

#### 问题 14: `UnrealBloomPass` 中 `renderToScreen` 分支的冗余渲染
- **文件**: `postprocessing.bundle.js:502-508`
- **代码**: 当 `renderToScreen` 为 true 时，先渲染 input 到 screen（步骤0），然后再做 bloom 处理，最后再渲染结果到 screen。步骤0的渲染会被后续渲染覆盖，是多余的 GPU 工作。
- **分析**: 这实际上是 three.js 官方 `UnrealBloomPass` 的原始行为（r152 版本），不是本项目的 bug。但是当 `EffectComposer.renderToScreen = true` 且 `UnrealBloomPass` 是最后一个 pass 时（实际不是，后面还有 OutputPass），这个渲染确实冗余。
- **严重度**: ⚠️ LOW — 性能浪费但不影响正确性

#### 问题 15: `token-engine.js` 中 `loadPack` 要求 `scene_tokens` 存在
- **文件**: `token-engine.js:67-68`
- **代码**: `if (!packData.scene_tokens || typeof packData.scene_tokens !== 'object')`
- **分析**: 从 `index.html` 的 pack 数据和 `jarvis-v1.json` 来看，`scene_tokens` 确实存在且非空。但如果未来加载一个没有 scene_tokens 的 pack（例如只有 base_tokens），`loadPack` 会抛出异常。
- **严重度**: ⚠️ LOW — 当前数据无问题，但设计过于严格

#### 问题 16: `hud.js` 中 `buildConfigPanel` 返回的 `apiBaseRow` 引用未正确匹配 `setApiBaseVisible`
- **文件**: `app.js:381-385` 和 `hud.js:536-541`
- **代码**: `app.js` 从 `refs.apiBaseRow` 读取引用来添加 `change` 事件，而 `hud.js:539` 中 `setApiBaseVisible` 通过 `querySelector('.si-panel__row')` 查找元素。这两者指向同一个 DOM 元素（`buildConfigPanel` 创建的 `apiBaseRow` div），所以功能上正确。
- **严重度**: ✅ 无问题

#### 问题 17: bloom strength 未在 `switchPack` 中更新
- **文件**: `app.js:159-160`
- **问题**: 只更新了 `threshold` 但没更新 `strength` 和 `radius`
- **pack 数据**: `"bloom": { "strength": 0.4, "threshold": 0.82 }` — 但 pack 数据没有 `radius` 字段
- **影响**: 如果不同 pack 有不同的 bloom strength，切换后 strength 不会立即更新（需要等 spring 系统覆盖）
- **严重度**: ⚠️ MEDIUM

---

## 四、核心问题汇总

| # | 严重度 | 问题 | 文件 | 状态 |
|---|--------|------|------|------|
| 1 | 🔴 HIGH | `SIProviders.init()` 引用不存在的 DOM ID (`cProvider`, `cKey`, etc.) | `providers.js` | **未修复** |
| 2 | 🔴 HIGH | `app.js` 与 `providers.js` 配置面板逻辑冲突 — HUD 创建的元素没有 ID | `app.js` + `providers.js` | **未修复** |
| 3 | ⚠️ MEDIUM | `setInputEnabled(true)` 语义反转（disabled=true） | `app.js:275` | 逻辑正确但易误读 |
| 4 | ⚠️ MEDIUM | `switchPack()` 未同步 bloom strength | `app.js:159-160` | **未修复** |
| 5 | ⚠️ LOW | `spring.js` 使用 ES6 class 风格不一致 | `spring.js` | 风格问题 |
| 6 | ⚠️ LOW | `prompt-builder.js` 使用 `Object.entries()` (ES2017) | `prompt-builder.js` | 兼容性 |

---

## 五、r128 vs r152 API 兼容性 — 完整验证结果

| API 调用 | r128 支持 | 位置 |
|----------|-----------|------|
| `renderer.state.buffers.stencil.setFunc()` | ✅ 存在 | `postprocessing.bundle.js:264` |
| `renderer.state.buffers.stencil.setTest()` | ✅ 存在 | `postprocessing.bundle.js:500,550` |
| `THREE.ShaderChunk` (ShaderChunk 变量 `hi`) | ✅ 存在 | `three.min.js` |
| `#include <common>` 解析 | ✅ 内置 | r128 `WebGLProgram` |
| `linearToRelativeLuminance()` 在 common chunk 中 | ✅ 存在 | `three.min.js` |
| `THREE.WebGLRenderTarget` | ✅ 存在 | `three.min.js` |
| `texture.generateMipmaps` 属性 | ✅ 存在 | r128 Texture |
| `THREE.BufferGeometry` (ES6 class) | ✅ 支持 `Reflect.construct` | `postprocessing.bundle.js:104` |
| `THREE.ShaderMaterial` + 自定义 fragment/vertex shader | ✅ 完全支持 | `shader-store.js`, `postprocessing.bundle.js` |
| `THREE.Points` + `THREE.BufferAttribute` | ✅ 完全支持 | `particle.js:198-214` |
| `THREE.EffectComposer` 架构 | ✅ 手工实现兼容 r128 | `postprocessing.bundle.js:188-313` |
| `THREE.UniformsUtils.clone()` | ✅ 存在 | `postprocessing.bundle.js:153,402,442` |

**结论**: r128 与 postprocessing bundle 之间**没有 API 不兼容问题**。bundle 中的 `state.buffers.stencil`、`linearToRelativeLuminance`、`#include <common>` 在 r128 中都存在且行为正确。

---

## 六、修复建议

### 🔴 必须修复

**问题 1+2: providers.js 与 HUD 配置面板的集成断裂**

方案 A（推荐）: 给 HUD `buildConfigPanel()` 创建的 DOM 元素添加与 `providers.js` 期望一致的 ID：

```javascript
// hud.js buildConfigPanel() 中：
provSelect.id = 'cProvider';
keyInput.id = 'cKey';
apiBaseInput.id = 'cApiBase';
apiBaseRow.id = 'cApiBaseRow';
modelSelect.id = 'cModel';
```

方案 B: 重写 `providers.js`，移除 DOM 操作，改为纯数据层（`getApiKey()`, `getModel()`, `call()` 等），所有 UI 由 HUD 负责。这是更好的架构但工作量大。

**问题 4: bloom strength 同步**

```javascript
// app.js switchPack() 中，在 threshold 行后添加：
this._bloomPass.strength = bloomCfg.strength || 0.4;
```

### ⚠️ 建议修复

**问题 3: setInputEnabled 语义**

重命名为 `setInputDisabled(disabled)` 或反转参数：
```javascript
HUD.prototype.setInputEnabled = function (enabled) {
  var disabled = !enabled;
  // ...
};
```
