# Kaguya React

一个基于 **React 19 + TypeScript + Vite** 构建的现代化个人导航主页。保留原有二次元风格，同时提供生产级工程体验。

## 📖 目录

- [项目概览](#项目概览)
- [主要特性](#主要特性)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [缓存策略](#缓存策略)
- [部署指南](#部署指南)
- [常见问题](#常见问题)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 🌟 项目概览

- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite
- **样式方案**：SCSS
- **运行环境**：纯浏览器静态站（无需后端）
- **可选依赖**：`@mlc-ai/web-llm` (WebGPU AI)、`kaguya-clock`
- **浏览器要求**：现代浏览器（WebGPU 功能需要相应支持）

## ✨ 主要特性

### 智能搜索栏
- 🔍 多搜索引擎切换（支持 14+ 种搜索引擎）
- 📝 本地搜索历史记录（最多保存 30 条）
- 💡 实时联想词建议（百度搜索建议 API）
- ⌨️ 键盘导航支持（`↑`/`↓`/`Enter`/`Esc`）
- 🌐 支持 Bing、百度、Google、DuckDuckGo、搜狗、Yandex、Perplexity、Google Scholar、Wikipedia、GitHub、Stack Overflow、MDN、npm、高德地图等

### 网站导航
- 📑 分类网站网格展示
- 🎨 渐变色分类标题
- 🔞 双模式切换（普通模式 / 成人模式）
- ⌨️ 快捷键支持（按 `\` 键切换模式）

### 时钟模块
- 🕐 双时钟显示（指针式 + 数字式）
- 🎨 随机主题配色
- 📦 基于 `kaguya-clock` 库实现

### Live2D 陪伴
- 🎭 双角色模型支持（22/33 娘）
- 🖱️ 拖拽交互（可自由移动位置）
- 💬 消息气泡 + 动作动画
- 📱 响应式显示（大屏才显示）

### 背景切换
- 🖼️ 多张精美背景图
- 🎨 SVG 背景支持

### 离线加速
- ⚡ Service Worker 静态资源缓存
- 🖼️ 背景图和 Live2D 资源预缓存
- 🚀 二次访问速度大幅提升

## 📁 项目结构

```text
kaguya-react/
├── dist/                          # 生产构建输出目录
├── public/                        # 公共资源
│   ├── backgrounds/               # 背景图片资源
│   │   ├── weibo/                 # 微博风格背景
│   │   └── bg-*.svg               # SVG 背景
│   ├── live2d/                    # Live2D 相关资源
│   │   ├── lib/                   # Live2D 库文件
│   │   └── model/                 # Live2D 模型文件
│   └── sw.js                      # Service Worker 脚本
├── src/                           # 源代码目录
│   ├── images/                    # 图片资源
│   ├── scss/                      # 样式文件
│   │   ├── index.scss             # 样式入口
│   │   ├── global.scss            # 全局样式
│   │   ├── app.scss               # 应用样式
│   │   ├── kaguya.scss            # 主容器样式
│   │   ├── navigator.scss         # 导航样式
│   │   ├── searchengle.scss       # 搜索栏样式
│   │   ├── calendar.scss          # 日历样式
│   │   ├── clock.scss             # 时钟样式
│   │   ├── live2d.scss            # Live2D 样式
│   │   ├── deepmode.scss          # 深度模式样式
│   │   └── reset.scss             # 样式重置
│   ├── ts/                        # TypeScript 源码
│   │   ├── CONSTANTS.ts           # 常量定义
│   │   ├── kaguya.tsx             # 主应用组件
│   │   ├── app.tsx                # 应用入口
│   │   ├── navigator.tsx          # 导航容器
│   │   ├── navigates.tsx          # 网站链接列表
│   │   ├── searchengle.tsx        # 搜索引擎组件
│   │   ├── calendar.tsx           # 日历组件
│   │   ├── clock.tsx              # 时钟组件
│   │   ├── live2d.tsx             # Live2D 组件
│   │   ├── deepmode.tsx           # 深度模式组件
│   │   ├── background.tsx         # 背景组件
│   │   ├── newsService.ts         # 新闻服务
│   │   ├── jsonpService.ts        # JSONP 服务
│   │   └── utils.ts               # 工具函数
│   └── app.tsx                    # React 应用入口
├── index.html                     # HTML 入口文件
├── vite.config.ts                 # Vite 配置
├── package.json                   # 项目依赖配置
├── searchengine-list.json         # 搜索引擎列表配置
├── websites.json                  # 普通网站导航配置
├── adult-websites.json            # 成人网站导航配置
└── README.md                      # 项目说明文档
```

## 🚀 快速开始

### 环境要求

- Node.js 18+（推荐 Node.js 20 LTS）
- npm 9+
- 现代浏览器

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

默认开发地址：[http://localhost:8089](http://localhost:8089)

### 构建和预览

```bash
npm run typecheck
npm run build
npm run preview
```

默认预览地址：[http://localhost:4173](http://localhost:4173)

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run typecheck` | 运行 TypeScript 类型检查 (`tsc --noEmit`) |
| `npm run build` | 构建生产资源 |
| `npm run preview` | 本地预览生产构建 |

## 💾 缓存策略

### Service Worker (`public/sw.js`) 缓存：
- 🖼️ 背景图片
- 🎭 Live2D 模型文件

### 浏览器存储：
- 📝 搜索历史 (localStorage)
- 🔍 搜索引擎偏好 (localStorage)

## 📦 部署指南

本项目是静态站友好型，可以部署到：

- GitHub Pages
- 任何 CDN/静态托管（Netlify、Vercel、OSS + CDN 等）

### GitHub Pages 部署

1. **构建项目**：
   ```bash
   npm run build
   ```

2. **推送代码**：
   ```bash
   git add -A
   git commit -m "build: update for deployment"
   git push origin master
   ```

3. **推送到 gh-pages 分支**：
   ```bash
   git push origin --delete gh-pages
   git subtree push --prefix dist origin gh-pages
   ```

4. **配置 GitHub Pages**：
   - 进入仓库 Settings → Pages
   - Source 选择 `Deploy from a branch`
   - Branch 选择 `gh-pages` 和 `/ (root)`
   - 点击 Save

### 重要配置

- `vite.config.ts` 使用 `base: './'` 以支持相对路径的静态部署

## ❓ 常见问题

### Service Worker 缓存未生效
- ✅ 运行 `npm run build && npm run preview` 验证生产缓存行为
- ✅ 部署更新后强制刷新一次

### Live2D 角色不显示
- ✅ 检查浏览器窗口宽度是否 ≥ 1320px
- ✅ 检查网络连接和资源加载

### 如何自定义网站导航？
- ✅ 编辑 `websites.json` 修改普通网站导航
- ✅ 编辑 `adult-websites.json` 修改成人网站导航
- ✅ 编辑 `searchengine-list.json` 修改搜索引擎列表

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

ISC

---

## English Documentation

### Project Overview

This is a modern personal navigation homepage built with **React 19 + TypeScript + Vite**, featuring an anime-style UI with production-grade engineering.

### Key Features

- **Smart Search Bar**: Multi-engine switching, search history, real-time suggestions, keyboard navigation
- **Website Navigation**: Categorized grid, dual-mode (regular/adult), gradient styling
- **Clock Module**: Dual display (analog + digital), random themes
- **Live2D Companion**: Dual characters (22/33), draggable, message bubbles + animations
- **Background Switching**: Multiple beautiful backgrounds
- **Offline Acceleration**: Service Worker caching for fast subsequent visits

### Quick Start

```bash
npm install
npm run dev
```

Default dev server: [http://localhost:8089](http://localhost:8089)

### Build & Deploy

```bash
npm run typecheck
npm run build
npm run preview
```

The project can be deployed to any static hosting service (GitHub Pages, Netlify, Vercel, etc.).

### License

ISC
