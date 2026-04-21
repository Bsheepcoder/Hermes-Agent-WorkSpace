# Spirit Ink v4.0 — Design Token 驱动的可视化表达引擎

> 完整开发文档 | 2026-04-21
> 作者：XD Q + Hermes
> 状态：3 个 Demo 已完成，Phase 1 重构进行中

---

## 一、项目概述

### 1.1 一句话定义

Spirit Ink 是一个 **AI 驱动的可视化表达引擎**——AI 输出抽象 Design Token，系统将 Token 映射为粒子动画、图片、GIF、视频等视觉内容，实现「想法即画面」。

### 1.2 核心变革（v3 → v4）

| 维度 | v3 灵墨 | v4 灵墨 |
|------|---------|---------|
| AI 输出 | 直接视觉指令（RGB、坐标、形状） | 抽象 Token（情绪、风格、能量） |
| 视觉样式 | 单一（发光粒子） | 可扩展（粒子/图片/GIF/视频/3D） |
| 扩展方式 | 改 prompt + 改代码 | 加 Token 包，零代码 |
| AI 职责 | 既要想「说什么」又要懂「怎么渲染」 | 只管「说什么」，渲染交给系统 |
| 演进方向 | 人工维护 | AI 自生长（自动生成新 Token） |

### 1.3 产品愿景

用户只需要：
1. 选择或导入一个 Token 包（表达风格定义）
2. 对 AI 说话
3. AI 按照该 Token 包的规则输出 Token
4. 系统将 Token 渲染为画面

最终目标：**定义基础配置 → 载入他人 Token 包 → AI 自动生长新表达 → 表达引擎自进化。**

---

## 二、项目进度

### 2.1 已完成

| # | 内容 | 文件 | 状态 |
|---|------|------|------|
| 1 | Jarvis 粒子 Demo | index.html | ✅ |
| 2 | 奶龙图片 Token Demo | nailong-demo.html | ✅ |
| 3 | 奶龙 GIF Video Token Demo | nailong-video-demo.html | ✅ |
| 4 | providers.js 多模型 AI 接口 | providers.js | ✅ |
| 5 | Playwright 录屏脚本 | record-*.cjs | ✅ |
| 6 | V4 完整方案文档 | docs/SPIRIT_INK_V4_PROPOSAL.md | ✅ |
| 7 | V4 开发文档（840行） | docs/DEVELOPMENT.md | ✅ |
| 8 | Demo 录屏视频 | docs/*.mp4 (3个) | ✅ |

### 2.2 当前阶段：Phase 1 基础引擎重构

目标：将 3 个 Demo 的逻辑重构为模块化引擎

| 任务 | 状态 | 说明 |
|------|------|------|
| T1.1 Spring 物理引擎 | 🔲 待开发 | Spring 类 + SpringPool |
| T1.2 Token 引擎核心 | 🔲 待开发 | TokenPack 加载/查表/合并 |
| T1.3 内置 Jarvis Token 包 | 🔲 待开发 | JSON 格式，15-20 基础 + 8-10 场景 Token |
| T1.4 粒子渲染器重构 | 🔲 待开发 | 7 种 shader，从 SpringPool 读取参数 |
| T1.5 Prompt 构建器 + 响应解析 | 🔲 待开发 | 动态注入 Token 规则 |
| T1.6 主页面集成 | 🔲 待开发 | 模块组装 + 基础 UI |
| T1.7 HUD 覆盖层 | 🔲 待开发 | 反应堆、数据环、扫描线 |

### 2.3 后续阶段

| 阶段 | 内容 | 预计工期 |
|------|------|---------|
| Phase 2: Token 包管理 | 管理 UI + 导入导出 + 编辑器 | 4 天 |
| Phase 3: Token 分层与智能调度 | 基础/场景分层 + 性能自适应 | 2.5 天 |
| Phase 4: AI 自生长 | 生图/生视频集成 + 社区分享 | 16 天 |

---

## 三、架构设计

### 3.1 五层架构

```
用户输入
  ↓
┌─────────────────────────────┐
│  Layer 1: UI 层             │  聊天界面 / Token 面板 / HUD
├─────────────────────────────┤
│  Layer 2: Token 层          │  抽象语义 Token（emotion/style/energy）
│  AI 输出 JSON Token，       │
│  引擎查表映射渲染参数         │
├─────────────────────────────┤
│  Layer 3: Spring 物理层     │  弹性过渡动画（stiffness/damping）
│  参数平滑过渡，不硬切         │
├─────────────────────────────┤
│  Layer 4: Renderer 渲染层   │  粒子系统 / 图片切换 / GIF播放 / WebGL
│  一个 Token → 一组渲染参数    │
├─────────────────────────────┤
│  Layer 5: AI 推理层         │  LLM 理解用户意图 → 输出 Token
│  System Prompt 约束输出格式   │
└─────────────────────────────┘
```

### 3.2 完整数据流

```
[1] 用户输入 "你好呀"
       │
[2] AI 接口层
       │  构建 System Prompt = 通用规则 + 当前Token包的ai_rules + token列表
       │  发送: system_prompt + conversation_history + user_message
       │
[3] AI 返回
       │  {"content": "你好！很高兴见到你", "tokens": ["joy_breath", "wave_hello"]}
       │
[4] Design Token 层
       │  查表: joy_breath → { render: {...} }
       │  查表: wave_hello → { render: {...} }
       │  合并渲染参数（按优先级）
       │
[5] Spring 物理层
       │  将合并后的参数设为弹簧目标值
       │  每帧更新弹簧，输出当前插值
       │
[6] 渲染引擎层
       │  读取弹簧当前值 → 更新 Shader Uniform → 渲染
       │  同时更新 HUD 元素
       │
[7] 用户看到画面
```

---

## 四、Design Token 系统

### 4.1 Token 分层

**基础 Token（Base Tokens）**
- 用途：等待状态、简单情绪反应、微动效
- 特征：低计算量、快速响应、持续循环
- 响应延迟：< 100ms
- 例子：呼吸脉冲、粒子漂浮、微光闪烁、颜色渐变

**场景 Token（Scene Tokens）**
- 用途：重大情绪转折、故事性表达、沉浸式画面
- 特征：高计算量、有起承转合、有明确时长
- 响应延迟：可接受 1-3s（有 loading 过渡）
- 例子：全息网格展开、等离子爆炸、神经网络激活

### 4.2 Token 包结构

```json
{
  "pack": {
    "id": "jarvis-official-v1",
    "name": "J.A.R.V.I.S. 官方风格",
    "version": "1.0.0",
    "author": "XD Q",
    "description": "钢铁侠贾维斯风格，蓝金色调，全息科技感",
    "thumbnail": "jarvis-preview.jpg",
    "tags": ["sci-fi", "hud", "tech"],
    "engine_version": "4.0",
    "personality": {
      "spring_k": 80,
      "spring_d": 12
    },
    "color_scheme": {
      "background": "#060610",
      "primary": "#00d4ff",
      "secondary": "#ffd700",
      "accent": "#0066cc",
      "text": "rgba(200,220,240,0.7)"
    }
  },
  "base_tokens": {
    "joy_breath": {
      "display_name": "喜悦呼吸",
      "description": "粒子轻微膨胀收缩，颜色变暖",
      "category": "emotion",
      "trigger_hint": "用户表达开心、高兴",
      "render": {
        "color": { "primary": "#ffd700", "secondary": "#ff8c00", "blend": 0.3 },
        "particle": { "scale": 1.2, "glow": 0.8 },
        "motion": { "spring_k": 60, "spring_d": 14, "spread": 0.15 },
        "bloom": { "strength": 0.3, "threshold": 0.85 }
      },
      "duration": "loop",
      "priority": 0
    }
  },
  "scene_tokens": {
    "wonder_reveal": {
      "display_name": "惊叹展开",
      "description": "粒子从中心向外爆炸式展开，伴随全息网格",
      "category": "scene",
      "trigger_hint": "用户表达惊叹、赞叹、发现",
      "render": {
        "style": "holo_grid",
        "color": { "primary": "#00d4ff", "secondary": "#ffd700", "blend": 0.5 },
        "particle": { "count": 800, "scale": 1.5, "glow": 1.0 },
        "motion": { "spring_k": 120, "spring_d": 8, "pattern": "explode_from_center" },
        "camera": { "shake": 0.1, "zoom": 0.8 },
        "bloom": { "strength": 0.6, "threshold": 0.7 },
        "hud": { "scan_active": true, "ring_speed": "fast" }
      },
      "duration": 5000,
      "priority": 1
    }
  },
  "ai_rules": "当用户表达好奇时，使用 wonder 系列token...",
  "ai_examples": [
    { "user": "你好", "response": {"content": "你好！", "tokens": ["joy_breath"]} }
  ]
}
```

### 4.3 渲染器类型

| 渲染器 | 载体 | 适用场景 | Demo 状态 |
|--------|------|----------|-----------|
| `particle` | Three.js 粒子 | 科幻/抽象风格 | ✅ Jarvis Demo |
| `image` | 静态图片 | 表情包/IP 形象 | ✅ 奶龙图片 Demo |
| `gif` | 动态 GIF | 搞笑/日常风格 | ✅ 奶龙 GIF Demo |
| `video` | 短视频片段 | 影视/真人 IP | 🔄 规划中 |
| `3d` | Three.js 模型 | 高端品牌/游戏 | 🔄 规划中 |

### 4.4 粒子渲染模式（7种 Jarvis 风格）

| 模式 ID | 名称 | 视觉描述 | 适用 Token |
|---------|------|---------|-----------|
| energy_flow | 能量流 | 粒子沿流场运动带拖尾 | 专注、活跃、分析中 |
| data_rain | 数据雨 | 矩阵式下落数据点（蓝金色） | 思考、搜索、处理信息 |
| holo_grid | 全息网格 | 线框网格可变形 | 惊叹、展示、展开 |
| plasma | 等离子体 | 中心发热向外扩散 | 愤怒、强烈、能量释放 |
| neural | 神经网络 | 节点+连线结构 | 学习、连接、理解 |
| shield | 力场 | 同心圆波纹 | 防御、拒绝、边界 |
| scan | 扫描 | 旋转扫描线 | 分析、检测、观察 |

---

## 五、核心模块设计

### 5.1 目标文件结构

```
spirit-ink/
├── index.html              # 入口页面
├── providers.js            # AI 多模型提供商（复用 v3）
├── css/
│   └── style.css           # 全局样式 + HUD 样式
├── js/
│   ├── app.js              # 主应用入口、UI 交互
│   ├── token-engine.js     # Token 核心引擎
│   │   ├── TokenPack       # Token 包加载/存储/导入导出
│   │   ├── TokenResolver   # Token 查表、冲突处理、优先级
│   │   └── TokenTransition # Token 过渡管理
│   ├── spring.js           # Spring 物理引擎
│   │   ├── Spring          # 单个弹簧
│   │   └── SpringPool      # 弹簧池管理
│   ├── renderer/
│   │   ├── base.js         # 渲染器基类
│   │   ├── particle.js     # 粒子渲染器（Three.js）
│   │   ├── shader-store.js # 着色器库（7种模式）
│   │   ├── hud.js          # HUD 覆盖层渲染
│   │   ├── image.js        # 图片渲染器
│   │   ├── gif.js          # GIF 渲染器
│   │   └── video.js        # 视频渲染器（预留）
│   ├── ai/
│   │   ├── prompt-builder.js  # Prompt 动态构建
│   │   └── response-parser.js # AI 响应解析
│   └── ui/
│       ├── input.js        # 输入框
│       ├── config.js       # 配置面板
│       ├── pack-manager.js # Token 包管理界面
│       ├── pack-editor.js  # Token 编辑器
│       └── debug.js        # Debug 面板
├── packs/                  # 内置 Token 包
│   ├── jarvis-v1.json      # J.A.R.V.I.S. 官方风格
│   └── minimal-v1.json     # 极简默认风格
└── assets/
    ├── nailong/            # 10张奶龙 JPG
    └── nailong-gif/        # 12个奶龙 GIF
```

### 5.2 TokenEngine（token-engine.js）

```javascript
class TokenEngine {
  constructor() {
    this.currentPack = null;   // 当前加载的 Token 包
    this.baseTokens = {};      // 基础 Token 查表
    this.sceneTokens = {};     // 复杂 Token 查表
    this.activeTokens = [];    // 当前活跃的 Token 列表
    this.resolver = new TokenResolver();
    this.transition = new TokenTransition();
  }

  // 加载 Token 包
  loadPack(packJSON) { ... }

  // AI 输出 Token 名字列表，引擎查表返回合并后的渲染参数
  resolve(tokenNames) { ... }

  // 导出/导入包
  exportPack() { ... }
  importPack(json) { ... }
}
```

### 5.3 TokenResolver（Token 查表 + 冲突处理）

```javascript
class TokenResolver {
  resolve(tokens) {
    let result = { color: {}, particle: {}, motion: {}, bloom: {}, hud: {} };
    // 按 priority 排序，低→高依次合并
    const sorted = [...tokens].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    for (const token of sorted) {
      deepMerge(result, token.render);
    }
    return result;
  }
}
```

规则：
- 同名参数取优先级高的
- 基础 Token 作为底色，场景 Token 覆盖
- 颜色取 blend 混合
- spring 参数取最活跃的

### 5.4 SpringPool（弹簧池）

```javascript
class Spring {
  constructor(k = 80, d = 12) {
    this.target = 0; this.value = 0; this.velocity = 0;
    this.k = k; this.d = d;
  }
  setTarget(t) { this.target = t; }
  update(dt) {
    const force = (this.target - this.value) * this.k;
    this.velocity += (force - this.velocity * this.d) * dt;
    this.value += this.velocity * dt;
  }
}

class SpringPool {
  constructor() {
    this.springs = {
      color_r: new Spring(), color_g: new Spring(), color_b: new Spring(),
      color_r2: new Spring(), color_g2: new Spring(), color_b2: new Spring(),
      particle_scale: new Spring(), particle_glow: new Spring(),
      bloom_strength: new Spring(), bloom_threshold: new Spring(),
      motion_speed: new Spring(), motion_spread: new Spring(),
      camera_shake: new Spring(), camera_zoom: new Spring(),
    };
  }

  // 从 Token 参数设置所有弹簧目标值
  applyTargets(renderParams) { ... }

  // 每帧更新所有弹簧
  update(dt) { ... }

  // 获取当前值传给渲染器
  getCurrentValues() { ... }
}
```

弹簧「性格」：
- **jarvis** (k:80, d:12) — 精准控制，快速稳定
- **friday** (k:120, d:10) — 敏捷响应，轻微过冲
- **ultron** (k:180, d:6) — 暴烈震荡，难以稳定

### 5.5 PromptBuilder（AI Prompt 动态构建）

```javascript
class PromptBuilder {
  buildSystemPrompt(pack) {
    const base = `你是灵墨，一个有身体的AI。你的身体通过 Design Token 控制视觉表达。
每次回复必须是 JSON：{"content":"你说的话","tokens":["token_name_1","token_name_2"]}
只能使用当前 Token 包中定义的 token。`;

    const tokenList = Object.entries(pack.base_tokens).map(([id, def]) =>
      `- "${id}": ${def.description} (触发: ${def.trigger_hint})`
    ).join('\n');

    const sceneList = Object.entries(pack.scene_tokens).map(([id, def]) =>
      `- "${id}": ${def.description} (触发: ${def.trigger_hint}, 持续${def.duration}ms)`
    ).join('\n');

    return `${base}\n\n## 可用的基础 Token\n${tokenList}\n\n## 可用的场景 Token\n${sceneList}\n\n## 使用规则\n${pack.ai_rules}`;
  }
}
```

---

## 六、HUD 覆盖层设计

HTML/CSS 叠加在 WebGL Canvas 上的 UI 元素：

| 元素 | 描述 | Token 控制 |
|------|------|-----------|
| 电弧反应堆 | 中心脉冲动画 | hud.reactor_pulse |
| 旋转数据环 | SVG，带刻度线 | hud.ring_speed (slow/normal/fast) |
| 诊断数据 | 浮动状态读数文字 | hud.diagnostic |
| 角落方括号 | 瞄准框 | hud.bracket |
| 水平扫描线 | 扫描效果 | hud.scan_active |

配色：cyan (#00d4ff), gold (#ffd700), blue (#0066cc), white on dark (#060610)

---

## 七、技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 前端框架 | 原生 JS（无框架） | 与 v3.0 保持一致，项目体量不大 |
| 3D 渲染 | Three.js (CDN) | v3.0 已验证，生态成熟 |
| Token 存储 | localStorage + JSON 文件 | 轻量，用户可直接编辑 |
| Spring 物理 | 自实现 | 代码量极小（~50行），无需物理引擎 |
| HUD 渲染 | HTML/CSS 叠加 | 文字锐利，性能好，易于样式化 |
| AI 接口 | providers.js 复用 | 已支持 6 个提供商，无需重写 |
| Token 包格式 | JSON | 通用、可读、易于编辑和传输 |
| 录屏 | Playwright 逐帧截图 + ffmpeg | 服务器 headless 环境兼容 |

---

## 八、性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| Token 查表延迟 | < 1ms | key-value Map，O(1) |
| Spring 物理帧率 | 60fps | 独立于渲染帧率 |
| 粒子数量（默认） | 300 | Jarvis Token 包默认值 |
| 粒子数量（最大） | 2000 | 复杂场景 Token |
| Token 切换过渡 | 200-500ms | Spring 物理驱动 |
| AI 响应→画面延迟 | < 2s | 取决于 AI API 延迟 |
| 页面加载时间 | < 3s | CDN 资源 + Token 包 |

### 兼容性

| 目标 | 范围 |
|------|------|
| 浏览器 | Chrome 90+, Edge 90+, Firefox 90+, Safari 15+ |
| WebGL | WebGL 2.0 |
| 屏幕尺寸 | 响应式，推荐桌面端 |
| AI 提供商 | 智谱/OpenAI/Claude/Kimi/MiniMax/自定义 |

---

## 九、已有 Demo 技术摘要

### Demo 1: Jarvis 粒子（index.html）
- Three.js + Bloom 后处理 + UnrealBloomPass
- 7 种粒子渲染模式切换
- 3 个 Token Pack: Jarvis / Minimal / Cyber
- HUD 叠加层（SVG 数据环 + CSS 动画）

### Demo 2: 奶龙图片（nailong-demo.html）
- 10 张 JPG 表情包（assets/nailong/）
- Spring 物理缩放过渡（scale 弹跳）
- Token 切换驱动：图片 + 背景色 + 发光环 + 粒子背景
- 切换动画：opacity fade + scale bounce

### Demo 3: 奶龙 GIF（nailong-video-demo.html）
- 12 个 GIF 动图（assets/nailong-gif/）
- 与 Demo 2 架构一致，renderer 替换为 GIF 播放
- 每个 GIF 预加载到 Image 对象，切换时替换 src
- Canvas 粒子背景 + Glow ring 随 Token 变色

### 共用组件（已验证可复用）
- `providers.js` — AI API 配置，零修改复用
- Spring Physics 类 — Demo 2/3 中已实现基础版
- Canvas 粒子背景 — 三个 Demo 均使用
- Token 切换 UI — 左侧卡片列表 + 底部 Token label

---

## 十、风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| AI 输出不遵守 Token 规则 | 高 | 3层容错解析 + 严格 prompt + examples |
| Token 包质量参差不齐 | 中 | 内置校验 schema + 包评分系统 |
| 7种 shader 性能问题 | 中 | 按需加载 + 低端设备降级 |
| Spring 物理发散（数值爆炸） | 低 | 限制弹簧参数范围 + 每帧 clamp |
| AI 生成 Token 的 prompt 注入风险 | 中 | Token 包签名 + 沙盒执行 |
| WebGL 上下文丢失 | 低 | 监控 + 自动重连 + 优雅降级 |

---

## 十一、里程碑

| 里程碑 | 日期 | 交付内容 |
|--------|------|---------|
| M1: Alpha | 2026-04-27 | Jarvis 风格页面 + Design Token 链路跑通 |
| M2: Beta | 2026-05-01 | Token 包管理 + 导入导出 |
| M3: RC | 2026-05-04 | Token 分层 + 性能适配 |
| M4: v4.0 Release | 2026-05-08 | 正式发布，社区分享 |
| M5: 自生长 | TBD | AI 自动生成 Token |

---

## 十二、素材清单

### 奶龙图片（assets/nailong/）
10 张 JPG，共 332KB

| 文件 | 表情 |
|------|------|
| 01_idle.jpg | 呆呆站 |
| 02_happy.jpg | 开心 |
| 03_shy.jpg | 害羞 |
| 04_curious.jpg | 好奇 |
| 05_hungry.jpg | 饿了 |
| 06_silly.jpg | 犯傻 |
| 07_smell.jpg | 闻东西 |
| 08_scared.jpg | 害怕 |
| 09_ok.jpg | OK |
| 10_runaway.jpg | 跑路 |

### 奶龙 GIF（assets/nailong-gif/）
12 个 GIF，共 25MB

| 文件 | 表情 |
|------|------|
| cute.gif | 可爱 |
| dance.gif | 跳舞 |
| fall.gif | 摔倒 |
| happy.gif | 开心 |
| hungry.gif | 饿了 |
| idle.gif | 发呆 |
| run.gif | 跑 |
| sad.gif | 难过 |
| shy.gif | 害羞 |
| silly.gif | 犯傻 |
| think.gif | 思考 |
| valid.gif | 比耶 |

---

## 附录 A：v3 → v4 迁移对照

| v3 概念 | v4 对应 | 变化 |
|-----------|-----------|------|
| body.feel.emotion | tokens → emotion 类 Token | 从具体参数变抽象 Token |
| body.move.target | tokens → shape 类 Token | 从直接形状变 Token 查表 |
| body.pose | tokens → action 类 Token | 同上 |
| emotionMap (硬编码) | Token 包的 render 字段 | 从代码硬编码变数据驱动 |
| actionMemory | Token 包持久化 | 从零散存储变结构化 JSON |
