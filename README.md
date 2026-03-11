# Kaguya React

一个基于 **React 19 + TypeScript + Vite** 构建的现代化个人导航主页。
保留原有二次元风格，同时添加生产级工程升级：离线缓存、API 兜底链、可选的 WebLLM 智能交互。

## 📖 目录

- [项目概览](#项目概览)
- [主要特性](#主要特性)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [API 和兜底设计](#api-和兜底设计)
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
- **可选 AI 运行时**：`@mlc-ai/web-llm` (WebGPU)
- **浏览器要求**：现代浏览器（WebLLM 需要 WebGPU 支持）

## ✨ 主要特性

### 智能搜索栏
- 🔍 搜索引擎切换
- 📝 本地搜索历史
- 💡 实时联想词建议
- ⌨️ 键盘导航支持（`↑`/`↓`/`Enter`）

### 日历模块
- 📅 节假日/调休标记
- 🌤️ 日期单元格天气图标
- 📊 14 天天气预报栏
- 📍 位置 + 数据源显示

### 天气可靠性策略
- 🔄 主数据源 + 自动兜底链
- 📦 在线 API 不可用时的缓存兜底

### Live2D 陪伴
- 🎭 双角色模型支持（22/33）
- 🖱️ 拖拽交互
- 💬 消息气泡 + 动作动画

### 深度交互面板
- 💬 与 22/33 分角色的纯文字聊天
- 🤖 WebLLM 双层模型加载：
  - 先加载小型兜底模型（快速可用）
  - 后台预热优质模型
  - 准备就绪后自动切换到优质模型
  - 优质模型失败时请求级自动兜底

### 离线加速
- ⚡ Service Worker 静态资源缓存
- 🖼️ 背景图和 Live2D 资源预缓存
- 🚀 二次访问速度大幅提升

## 📁 项目结构

```text
src/
  app.tsx                 # 应用入口 + Service Worker 注册
  ts/
    kaguya.tsx            # 主布局组合
    navigator.tsx         # 站点卡片 / 分类网格
    searchengle.tsx       # 搜索栏 + 联想词 + 历史记录
    calendar.tsx          # 日历 + 天气 + 节假日逻辑
    live2d.tsx            # Live2D 容器和交互
    deepmode.tsx          # WebLLM 和深度交互面板
  scss/
    *.scss                # 全局和模块样式
public/
  sw.js                   # Service Worker 缓存策略
  backgrounds/            # 背景资源
  live2d/                 # Live2D 模型和资源
```

## 🚀 快速开始

### 环境要求

- Node.js 18+（推荐 Node.js 20 LTS）
- npm 9+
- 现代浏览器（WebLLM 需要 WebGPU 支持）

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

## 🔧 API 和兜底设计

### 天气数据
- 🔄 在线数据源链 + 自动降级
- 📦 所有远程源失败时的本地缓存兜底

### 节假日数据
- 🔄 多个远程镜像 + 本地缓存兜底

### 搜索建议
- 🔄 多个建议端点 + 本地历史记录兜底

这种设计可以防止在某个数据源被屏蔽或不稳定时出现硬失败。

## 💾 缓存策略

### Service Worker (`public/sw.js`) 缓存：
- 🖼️ 背景图片
- 🎭 Live2D 模型文件

### 浏览器存储：
- 📝 搜索历史
- 🌤️ 天气缓存
- 📅 节假日缓存
- 🤖 WebLLM 缓存策略偏好

### 深度模式：
- 💾 尽可能请求持久化存储以降低缓存被回收的风险

## 📦 部署指南

本项目是静态站友好型，可以部署到：

- GitHub Pages
- 任何 CDN/静态托管（Netlify、Vercel 静态导出、OSS + CDN 等）

### GitHub Pages 部署

1. **构建项目**：
   ```bash
   npm run build
   ```

2. **推送 master 分支**：
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

### WebLLM 首次运行加载缓慢
- ✅ 预期行为；模型文件较大
- ✅ 首次成功缓存后，后续加载会快很多

### WebLLM 不可用
- ✅ 验证浏览器 WebGPU 支持
- ✅ 检查模型源的网络访问
- ✅ 模型加载失败时兜底文本策略仍然可用

### Service Worker 缓存未生效
- ✅ 运行 `npm run build && npm run preview` 验证生产缓存行为
- ✅ 部署更新后强制刷新一次

### 浏览器未授予持久化权限

**问题**：深度交互面板提示"浏览器未授予持久化存储权限"

**解决方案**：

1. **Chrome/Edge 浏览器**：
   - 点击地址栏左侧的锁图标 🔒
   - 选择"网站设置"或"权限设置"
   - 找到"存储"或"数据存储"权限
   - 设置为"允许"

2. **Firefox 浏览器**：
   - 点击地址栏左侧的信息图标 ℹ️
   - 选择"连接安全"→"更多信息"
   - 在"权限"选项卡中找到"存储"
   - 选择"允许"

3. **通过浏览器控制台请求权限**：
   ```javascript
   if (navigator.storage && navigator.storage.persist) {
       navigator.storage.persist().then(granted => {
           if (granted) {
               console.log('持久化存储已授权');
           } else {
               console.log('持久化存储未授权，但普通存储仍可用');
           }
       });
   }
   ```

**影响**：
- ✅ 即使未授权，模型仍然可以使用，但可能需要每次重新下载
- ✅ 浏览器在存储空间不足时可能会清理缓存
- ✅ 项目已内置降级策略，会继续使用普通存储

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

## 中文说明

### 项目简介

这是一个基于 **React 19 + TypeScript + Vite** 的个人导航主页项目，保留原有二次元风格，同时补齐现代前端工程能力（缓存、兜底、静态部署友好）。

### 主要能力

- 搜索栏：支持搜索引擎切换、历史记录、联想词和键盘操作
- 日历与天气：支持节假日/调休标记、14天天气图标展示、天气源兜底
- Live2D：22/33 双角色、可拖拽、动作和气泡交互
- 深度交互：纯文字聊天 + WebLLM 双模型分层加载（先小模型保可用，再后台预热优质模型）
- 离线加速：Service Worker 预缓存背景与 Live2D 资源，二次访问更快

### 本地运行

```bash
npm install
npm run dev
```

默认开发地址：`http://localhost:8089`

```bash
npm run typecheck
npm run build
npm run preview
```

默认预览地址：`http://localhost:4173`
