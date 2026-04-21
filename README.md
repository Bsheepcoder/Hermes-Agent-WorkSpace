# Hermes Agent Workspace

Hermes Agent 的工作目录，存放项目脚本、数据和记忆。

## 目录结构

```
workspace/
├── docs/
│   ├── wechat-articles/          # 公众号文章卡片（按日期-主题分组）
│   │   ├── 2026-04-15-language/  # 语言发育迟缓
│   │   ├── 2026-04-15-sensory/   # 感觉统合
│   │   ├── 2026-04-16-finemotor/ # 精细动作
│   │   ├── 2026-04-17-grossmotor/# 大运动
│   │   ├── 2026-04-18-attention/ # 注意力
│   │   ├── 2026-04-19-social/    # 社交
│   │   ├── 2026-04-20-emotion/   # 情绪
│   │   ├── publish-history.json  # 发布历史
│   │   └── visual-history.json   # 视觉精选历史
│   ├── video/                    # 视频项目
│   │   ├── mr-derder-intro/      # Mr.DerDer 频道片头
│   │   └── tadpole/              # 小蝌蚪找妈妈 V2
│   └── project/                  # 项目设计图、封面等素材
├── transitions/                  # Three.js 粒子转场引擎（共用）
├── memory/                       # 待办事项等持久化记忆
├── auto_push.sh                  # 自动 git commit & push
└── package.json                  # Node.js 依赖
```

## 文档归档规范

- `docs/` 目录下按子目录分类，不允许直接放文件到 `docs/` 根目录
- `docs/wechat-articles/` — 公众号文章（md 原文 + html 排版稿 + 卡片图片）
- `docs/video/` — 视频相关工作流、脚本、素材说明
- `docs/project/` — 项目相关设计图、封面等素材
- 新文件必须归入对应子目录

## 自动同步

此仓库通过 Hermes cron job 每 6 小时自动 commit & push。
