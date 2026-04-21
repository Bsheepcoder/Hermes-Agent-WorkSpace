# Spirit Ink v4.1 — 重构方案

> 日期: 2026-04-22
> 状态: 待确认

---

## 一、为什么重构

v4.0 存在的架构问题：

| 问题 | 根因 |
|------|------|
| shader 编译失败反复出现 | 手工将 r152 ES modules 转为 r128 IIFE，遗漏版本差异 |
| providers.js 与 HUD 面板冲突 | 两套代码操控不同的 DOM，集成断裂 |
| HUD.js 21KB 过于庞大 | 配置面板、输入框、token 显示、FPS 计数器全塞一个文件 |
| 文件:// 兼容性脆弱 | ES modules → IIFE 转换是人工操作，容易遗漏 |
| 8 个 JS 文件 + 1 个内联 JSON | 初始化依赖链复杂，加载顺序敏感 |

核心教训：**不要手工转换 Three.js addon 的 ES modules 为 IIFE**。

---

## 二、新架构

### 2.1 核心原则

1. **零构建工具** — 不用 webpack/esbuild/rollup，双击 index.html 即可运行
2. **零外部依赖** — vendor 目录本地化所有第三方代码，离线可用
3. **ES5 优先** — 不用 class/arrow/optional-chaining，最大兼容性
4. **单文件 vendor** — Three.js + postprocessing 合并为一个 vendor bundle
5. **渐进功能** — MVP 先跑起来，再迭代 AI/配置/多 pack

### 2.2 Three.js 方案：esbuild 预构建 vendor bundle

**不再手工转换 ES modules**。用 Node.js 的 esbuild（一次性操作）将 Three.js + 所有需要的 addon 打包成一个 IIFE 格式的 `vendor/three.js`：

```bash
# 一次性构建（需要 Node.js）
npm init -y
npm install three@0.152 esbuild
npx esbuild node_modules/three/src/Three.js \
  node_modules/three/examples/jsm/postprocessing/EffectComposer.js \
  node_modules/three/examples/jsm/postprocessing/RenderPass.js \
  node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js \
  node_modules/three/examples/jsm/postprocessing/ShaderPass.js \
  node_modules/three/examples/jsm/shaders/CopyShader.js \
  node_modules/three/examples/jsm/shaders/GammaCorrectionShader.js \
  node_modules/three/examples/jsm/postprocessing/OutputPass.js \
  --bundle --format=iife --global-name=THREE \
  --outfile=vendor/three.js
```

输出 `vendor/three.js` (~600KB minified)：
- `window.THREE` — 全部 Three.js 核心 + EffectComposer + UnrealBloomPass 等
- 单个 `<script src="vendor/three.js">` 加载
- 与 file:// 完美兼容

**构建只需一次**，之后 vendor/three.js 就是一个纯静态文件，和手工下载的 three.min.js 一样使用。

### 2.3 模块结构（MVP → 完整版）

```
spirit-ink/
├── index.html              # 入口（内联 pack 数据 + boot 脚本）
├── css/
│   └── style.css           # 全部样式
├── vendor/
│   └── three.js            # esbuild 预构建的单文件 bundle（THREE + postprocessing）
└── js/
    ├── core.js             # SpiritInk 主类（初始化、动画循环、事件）
    ├── particles.js        # 粒子系统（渲染 + 物理 + 风格运动）
    ├── tokens.js           # Token 引擎（pack 加载、token 管理、激活/混合）
    ├── springs.js          # Spring 插值系统
    ├── hud.js              # HUD 覆盖层（token 显示 + FPS + 输入框）
    └── postprocessing.js   # bloom 后处理封装（EffectComposer 适配层）
```

相比 v4.0 的变化：
- **删除** providers.js → AI 集成延后到 Phase 3
- **删除** ai/ 目录 → 延后
- **删除** shader-store.js → shader 内联到 particles.js
- **合并** token-engine.js + spring.js → tokens.js + springs.js
- **新增** postprocessing.js → 将 EffectComposer 初始化和 bloom 适配层隔离

### 2.4 文件大小目标

| 文件 | 目标大小 | 说明 |
|------|---------|------|
| index.html | < 10KB | 入口 + 内联 pack 数据 + boot |
| vendor/three.js | ~600KB | esbuild 产物，不手动编辑 |
| js/core.js | < 5KB | 主类，薄层 |
| js/particles.js | < 8KB | 粒子 + shader |
| js/tokens.js | < 4KB | token 管理 |
| js/springs.js | < 2KB | spring 插值 |
| js/hud.js | < 8KB | HUD（精简版，不含配置面板） |
| js/postprocessing.js | < 2KB | bloom 封装 |
| css/style.css | < 6KB | 样式 |
| **总计** | **~650KB** | 其中 vendor 占 92% |

---

## 三、开发路线图

### Phase 1: MVP（最小可用版本）

**目标**：打开 index.html → 看到蓝色粒子流动 + bloom 辉光 + HUD token 显示

**范围**：
- [x] vendor/three.js 预构建
- [ ] index.html（boot 脚本 + 内联 pack 数据）
- [ ] js/springs.js（Spring + SpringPool）
- [ ] js/tokens.js（TokenEngine — 仅 loadPack + activateTokens + getCurrentRender）
- [ ] js/particles.js（粒子系统 — energy_flow 风格 + 400 粒子 + shader）
- [ ] js/postprocessing.js（EffectComposer + UnrealBloomPass 初始化）
- [ ] js/hud.js（简化版 — token 列表 + FPS + 底部标题，无输入框、无配置面板）
- [ ] js/core.js（SpiritInk 主类 — init + _animate）
- [ ] css/style.css（深色背景 + HUD 样式）
- [ ] 1 个 pack：jarvis-v1（8 base tokens，仅 idle + joy 完整风格，其余 fallback）
- [ ] 验证 file:// 和 http:// 都能正常打开

**不包含**：AI 调用、用户输入、配置面板、场景 token、pack 切换

### Phase 2: 交互增强

- [ ] 所有 8 个 base token 的完整风格运动
- [ ] 5 个 scene token（wonder, power, shield, analysis, neural_connect）
- [ ] HUD 输入框 + 模拟 AI 响应（预设回复，无需真正的 API 调用）
- [ ] Token 切换动画（spring 过渡）
- [ ] Pack 切换（顶部 pack 选择器）

### Phase 3: AI 集成

- [ ] Provider 抽象层（纯数据，不操作 DOM）
- [ ] HUD 配置面板（带 ID，与 provider 数据层正确对接）
- [ ] Prompt Builder + Response Parser
- [ ] 真正的 AI API 调用
- [ ] token 解析 → 视觉反馈闭环

### Phase 4: 打磨

- [ ] 响应式布局
- [ ] 性能优化（Web Worker 粒子物理？）
- [ ] 更多 pack（minimal, cyber 等）
- [ ] 导出/分享功能

---

## 四、MVP 技术细节

### 4.1 初始化流程

```
index.html 加载
  ├── <script src="vendor/three.js">        → window.THREE (含 postprocessing)
  ├── <script> window.__PACK_DATA__ = {...}  → 内联 pack JSON
  ├── <script src="js/springs.js">           → window.SpringPool
  ├── <script src="js/tokens.js">            → window.TokenEngine
  ├── <script src="js/particles.js">         → window.ParticleRenderer
  ├── <script src="js/postprocessing.js">    → window.PostProcessing
  ├── <script src="js/hud.js">               → window.HUD
  └── <script> boot() on DOMContentLoaded:
        ├── new SpiritInk()                   → core.js 内联或最后加载
        ├── app.init({ canvasContainer, hudContainer, packData })
        │   ├── _initThree()                 → WebGLRenderer + Scene + Camera
        │   ├── PostProcessing.init()        → EffectComposer + BloomPass
        │   ├── ParticleRenderer.init()      → 400 粒子 + shader
        │   ├── TokenEngine.loadPack()       → 解析 pack 数据
        │   ├── SpringPool.init()            → 创建 spring 实例
        │   ├── HUD.init()                   → 创建 DOM 元素
        │   └── _animate()                   → 启动渲染循环
        └── console.log('Spirit Ink booted ✓')
```

### 4.2 粒子 Shader（ES5 兼容）

```glsl
// Vertex
attribute vec3 aColor;
varying vec3 vColor;
uniform float uPixelRatio;
uniform float uGlow;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (6.0 + uGlow * 10.0) * uPixelRatio * (1.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}

// Fragment
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float glow = smoothstep(0.5, 0.0, d);
  float core = smoothstep(0.2, 0.0, d);
  vec3 color = vColor * glow * 1.4 + vec3(1.0) * core * 0.2;
  gl_FragColor = vec4(color, smoothstep(0.5, 0.25, d) * 0.85);
}
```

与 v4.0 相同，无需修改（已在 shader-store.js 中验证可用）。

### 4.3 Pack 数据格式（简化版 MVP）

```json
{
  "id": "jarvis-v1",
  "name": "J.A.R.V.I.S.",
  "color": { "primary": [0, 0.83, 1], "secondary": [1, 0.84, 0] },
  "bloom": { "strength": 0.4, "threshold": 0.82 },
  "base_tokens": {
    "idle": {
      "render": { "style": "energy_flow", "color": [0, 0.83, 1], "glow": 0.6, "speed": 0.3 }
    },
    "joy": {
      "render": { "style": "energy_flow", "color": [1, 0.84, 0], "glow": 0.9, "speed": 0.8 }
    }
  }
}
```

MVP 只保留 `render` 字段，删除 `desc`、`trigger`、`category`、`duration`、`priority` 等 AI 上下文字段。

---

## 五、与 v4.0 的对比

| 维度 | v4.0 | v4.1 MVP |
|------|------|----------|
| Three.js 加载 | r128 UMD + 手工 IIFE bundle | r152 esbuild 单文件 |
| JS 文件数 | 8 | 6 |
| shader | 分离 shader-store.js | 内联到 particles.js |
| HUD | 21KB 含配置面板 | <8KB 纯显示 |
| AI 集成 | providers.js + ai/ 目录 | 无（Phase 3） |
| 代码风格 | ES5 + ES6 混合 | 统一 ES5（var, function, prototype） |
| 场景 token | 有 | Phase 2 |
| 文件:// | 脆弱（多次修复） | 稳定（无 fetch、无 module、无 DOM 时序问题） |

---

## 六、风险与缓解

| 风险 | 缓解 |
|------|------|
| esbuild 产物的 WebGL 兼容性 | r152 是 Three.js 最稳定版本之一，WebGL 1/2 兼容好 |
| vendor/three.js 文件过大 | esbuild tree-shaking 自动删除未使用代码 |
| 服务器没有 Node.js | 有 Node.js。且构建是一次性的，产物可复制 |
| esbuild bundle 导出格式 | 用 `--format=iife --global-name=THREE` 确保设置 window.THREE |
| Three.js 后续版本升级 | 锁定 three@0.152，升级时重新构建 vendor 即可 |
