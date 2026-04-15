# Hermes Agent Workspace

Hermes Agent 的工作目录，存放脚本、数据、记忆等运行时文件。

## 目录结构

```
workspace/
├── data/images/          # 公众号文章卡片、发布历史、视觉精选历史
├── memory/               # 待办事项等持久化记忆
├── transitions/          # Mr.DerDer 频道视频转场动画
├── gen_intro.py          # 频道片头生成脚本
├── gen_audio_v4.py       # 片头音频生成脚本
├── intro-v4.html         # 片头 HTML 动画
├── render_intro.js       # 片头渲染脚本 (Puppeteer)
├── render_v4.js          # 片头 v4 渲染脚本
└── package.json          # Node.js 依赖 (Puppeteer 等)
```

## 自动同步

此仓库通过 Hermes cron job 定期自动 commit & push。

## 相关项目

- [Hermes Agent](https://github.com/nicepkg/hermes-agent) - AI Agent 框架
