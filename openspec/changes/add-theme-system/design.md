## Context

现状：整站样式分散在 `src/scss/` 9 个文件（约 2900 行），颜色全部硬编码（深色玻璃面板 rgba + 浅色文字），唯一例外是导航网站表格为纯白底。无主题机制、无 CSS 变量、无系统偏好监听。组件均为 React class 组件，前缀 `kaguya-`。入口 `src/app.tsx` 同步渲染 `<Kaguya />`。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**
- 建立单一来源的设计令牌（CSS 自定义属性），双主题各自完整
- 主题管理器：三态模式、持久化、跟随系统、首屏前应用（无 FOUC）
- 右上角三态开关组件，可访问、风格融入现有玻璃语言
- 全部现有组件迁移到令牌，夜间观感不回归、日间全新但同语言

**Non-Goals:**
- 不做自定义主题/取色器、不做独立日间壁纸池（已确认复用同一壁纸且不遮罩）
- 不做按时间段自动切换（跟随系统已覆盖）
- 不重构组件结构（class 组件保持），仅样式与主题接线
- 不做主题切换的大型过渡动画（仅 150-250ms 颜色过渡）

## Decisions

### 1. 主题状态：`data-theme` 属性 + CSS 变量，而非 body class 或 CSS-in-JS
在 `document.documentElement` 上设置 `data-theme="light" | "dark"`，令牌在 `:root[data-theme='light']` / `:root[data-theme='dark']` 两套中定义。
理由：纯 CSS 切换零 JS 重渲染；所有 scss 文件可直接 `var(--kg-*)`；与现有 `@use './global.scss'` 体系兼容。
替代方案：class 切换（等价但属性更语义化、避免与组件 class 混淆）；CSS-in-JS（与现有 scss 架构冲突，否决）。

### 2. 主题管理器为独立模块 `src/ts/theme.ts`
API：`getMode()` / `setMode(mode)` / `getResolved()` / `onChange(cb)`；内部：localStorage `kaguya:theme-mode`、`matchMedia('(prefers-color-scheme: dark)')` + `change` 监听（仅 `system` 模式生效）、应用属性并派发 `kaguya:theme-change` CustomEvent（detail: `{ mode, resolved }`）。
理由：canvas 时钟等非纯 CSS 消费者需要 JS 侧通知；集中逻辑便于测试与回滚。
替代方案：React Context（消费者含非 React 的 canvas 逻辑，且根组件外也要用，否决）。

### 3. 无 FOUC：入口同步初始化
`app.tsx` 在 `createRoot().render()` 前调用 `initTheme()`（读 localStorage → 校验 → 设属性）。localStorage 读取为同步 API，成本可忽略。
替代方案：head 内联脚本（vite 无独立 head 注入点，模块顶层等效，否决）。

### 4. 令牌命名与集合
实施中追加决策：双主题统一 iOS 液态玻璃材质（`--kg-glass-blur: blur(24px) saturate(180%)`，`--kg-shadow` 为"外阴影 + 顶部镜面内高光 + 边缘微光"组合，全部面板 box-shadow 归一到该令牌）；暗色主题为中性烟灰玻璃（非深蓝系）；日间主题边框用白色高光式近无形边缘（`--kg-border: rgba(255,255,255,.55)`），避免灰黑硬边。

前缀 `--kg-`。核心令牌：`--kg-surface`（玻璃面板底）、`--kg-surface-strong`（下拉/弹层）、`--kg-surface-hover`、`--kg-border`、`--kg-border-strong`、`--kg-text`、`--kg-text-muted`、`--kg-text-faint`、`--kg-accent`（#00A1D6 系）、`--kg-accent-soft`、`--kg-shadow`、`--kg-glass-blur`、`--kg-overlay`/`--kg-overlay-filter`（壁纸遮罩钩子，双主题均 transparent/none）。网站表格不设独立令牌，复用 `--kg-surface`/`--kg-surface-soft`/`--kg-border`/`--kg-text`，与日历同风格；分隔线单线绘制（列间 `margin-left: -1px`、单元格仅 `border-top`），无斑马纹。
夜间值取自现有视觉抽样（面板 rgba(20,30,50,.55) 系、文字 #eef7ff 系）；日间值：白玻璃 rgba(255,255,255,.62)、文字 #1f2937 系，blur 保持。
理由：命名按用途而非颜色值，避免 `--kg-blue` 式陷阱。

### 5. 壁纸处理：`::after` 遮罩钩子保留但默认关闭
`.kaguya-img::after` 固定覆盖，`background: var(--kg-overlay)` + `filter: var(--kg-overlay-filter)`。目检确认日间在壁纸上盖半透明层会发灰发雾，最终双主题令牌均取 transparent/none，壁纸原样显示，面板可读性靠玻璃模糊与令牌对比度保证。
理由：保留遮罩钩子便于将来按主题微调壁纸观感；`background.tsx` 零改动。

### 6. 开关组件 `src/ts/themeToggle.tsx`
固定右上角（top: 12px; right: 16px），玻璃胶囊内 3 个图标按钮（内联 SVG：太阳/月亮/显示器），`role="radiogroup"` + 子项 `role="radio" aria-checked`，方向键循环、回车激活；`title` 提示"日间/夜间/跟随系统"；当前模式高亮（强调色底）。挂载于 `kaguya.tsx` 根布局。
理由：与用户确认的三态一致；图标+tooltip 满足"不要太多字"的既有偏好。

### 7. 时钟配色：主题化调色板集合
`clock.tsx` 现有随机 THEMES 拆为 `dark`/`light` 两个集合；订阅 `kaguya:theme-change`，主题变化时从对应集合重抽并重绘。
理由：保持随机趣味性同时满足对比度契约。

### 8. 迁移顺序：先令牌与开关，再逐组件换色
global.scss 新增令牌块；随后 kaguya/background → navigator（含表格深色化）→ calendar → clock → deepmode → live2d/app。每完成一个组件即可独立验证。

## Risks / Trade-offs

- [令牌迁移面大，遗漏硬编码色] → 迁移后用 `rg` 扫描 scss 中 `#[0-9a-fA-F]{3,8}` 与 `rgba(`，白名单品牌渐变/分类头部；typecheck+build 验证。
- [夜间表格由白变深，老用户视觉变化] → 属本次"梳理"目标（proposal 已声明），悬停/选中态同步设计保证可辨。
- [日间对比度不达标] → 令牌定稿时核对主要文字/面板组合 ≥4.5:1；不达标调整 alpha。
- [canvas 时钟不随主题重绘] → 订阅事件强制重绘（决策 7）。
- [backdrop-filter 叠加性能] → 仅一层全屏伪元素，与现有面板 blur 同量级，可接受。

## Migration Plan

单次 change 内完成；提交粒度按组件拆分便于 bisect。回滚：revert 提交；localStorage 旧值 `kaguya:theme-mode` 对旧版本无副作用（旧版不读）。
