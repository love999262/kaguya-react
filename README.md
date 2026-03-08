# Kaguya React

A modernized personal navigation homepage built with **React 18 + TypeScript + Vite**.  
The project keeps the original anime-style identity while adding production-oriented engineering upgrades: offline caching, API fallback chains, and optional WebLLM-powered interaction.

## Overview

- Frontend framework: React 18 + TypeScript
- Build tool: Vite
- Styling: SCSS
- Runtime: Browser-only static site (no backend required)
- Optional AI runtime: `@mlc-ai/web-llm` (WebGPU)

## Key Features

- Smart search bar with:
  - search engine switch
  - local history
  - real-time suggestion candidates
  - keyboard navigation (`ArrowUp` / `ArrowDown` / `Enter`)
- Calendar module with:
  - holiday/workday marks
  - weather icons in day cells
  - 14-day forecast strip
  - location + provider display
- Weather reliability strategy:
  - primary source + automatic fallback chain
  - cached fallback when online APIs are unavailable
- Live2D companion:
  - dual character model support (22/33)
  - drag interaction
  - message bubbles + action animations
- Deep interaction panel:
  - text-only chat with 22/33 personalities
  - WebLLM dual-tier model loading:
    - load small fallback model first (fast availability)
    - warm up premium model in background
    - auto-promote to premium when ready
    - auto-fallback per request if premium fails
- Service Worker static asset caching:
  - background images and Live2D resources are pre-cached
  - repeat visits are much faster

## Project Structure

```text
src/
  app.tsx                 # app entry + service worker registration
  ts/
    kaguya.tsx            # main layout composition
    navigator.tsx         # site cards / category grid
    searchengle.tsx       # search bar + suggestions + history
    calendar.tsx          # calendar + weather + holiday logic
    live2d.tsx            # Live2D containers and interactions
    deepmode.tsx          # WebLLM and deep interaction panel
  scss/
    *.scss                # global and module styles
public/
  sw.js                   # service worker cache strategy
  backgrounds/            # background resources
  live2d/                 # Live2D models and assets
```

## Quick Start

### Requirements

- Node.js 18+ (recommended Node.js 20 LTS)
- npm 9+
- A modern browser (WebGPU required for WebLLM features)

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Default dev URL: [http://localhost:8089](http://localhost:8089)

### Build and Preview

```bash
npm run typecheck
npm run build
npm run preview
```

Default preview URL: [http://localhost:4173](http://localhost:4173)

## Scripts

- `npm run dev`: start Vite dev server
- `npm run typecheck`: run TypeScript type check (`tsc --noEmit`)
- `npm run build`: build production assets
- `npm run preview`: preview production build locally

## API and Fallback Design

- Weather:
  - online provider chain with automatic degrade
  - local cache fallback if all remote providers fail
- Holiday data:
  - multiple remote mirrors + local cache fallback
- Search suggestions:
  - multiple suggestion endpoints + local history fallback

This design prevents hard failure when one provider is blocked or unstable.

## Caching Strategy

- Service Worker (`public/sw.js`) caches:
  - background images
  - Live2D model files
- Browser storage is used for:
  - search history
  - weather cache
  - holiday cache
  - WebLLM cache strategy preference
- Deep mode also requests persistent storage when possible to reduce cache eviction risk.

## Deployment

This project is static-site friendly and can be deployed to:

- GitHub Pages
- Any CDN/static host (Netlify, Vercel static export, OSS + CDN, etc.)

Important setting:

- `vite.config.ts` uses `base: './'` to support relative static deployment paths.

## Troubleshooting

- WebLLM keeps loading slowly on first run:
  - expected behavior; model files are large
  - after first successful cache, subsequent loads are much faster
- WebLLM unavailable:
  - verify browser WebGPU support
  - check network access to model source
  - fallback text strategy still works when model loading fails
- Service Worker cache not taking effect:
  - run `npm run build && npm run preview` to validate production caching behavior
  - hard refresh once after deployment updates

## License

ISC

---

## 中文说明

### 项目简介

这是一个基于 **React 18 + TypeScript + Vite** 的个人导航主页项目，保留原有二次元风格，同时补齐现代前端工程能力（缓存、兜底、静态部署友好）。

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
