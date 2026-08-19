## 1. 令牌与主题管理器基础

- [x] 1.1 新建 `src/scss/theme.scss`：定义 `:root[data-theme='dark']` 与 `:root[data-theme='light']` 两套 `--kg-*` 令牌（surface/surface-strong/surface-soft/surface-hover/border/border-strong/text/text-soft/text-muted/text-faint/accent/accent-soft/on-accent/shadow/glass-blur/overlay/overlay-filter/holiday-text/workday-text），夜间值抽自现有视觉，日间值按设计定稿；在 `index.scss` 顶部 `@use`
- [x] 1.2 新建 `src/ts/theme.ts`：Mode 类型、`initTheme()`（同步读 `kaguya:theme-mode`、校验、默认 system、设 `document.documentElement.dataset.theme`）、`setThemeMode`、`getResolvedTheme`、`onThemeChange`（matchMedia change 监听，仅 system 生效）、派发 `kaguya:theme-change`
- [x] 1.3 `app.tsx` 在 render 前调用 `initTheme()`
- [x] 1.4 验证：手动改 localStorage 三种值刷新，首屏无闪烁；system 模式下调系统偏好实时切换

## 2. 右上角三态开关

- [x] 2.1 新建 `src/ts/themeToggle.tsx`：radiogroup 语义、太阳/月亮/显示器内联 SVG、title 提示、方向键+回车键盘支持、当前模式高亮、订阅 theme 模块更新
- [x] 2.2 新建 `src/scss/themeToggle.scss`：固定右上角玻璃胶囊样式，双主题令牌取值；`index.scss` 引入
- [x] 2.3 `kaguya.tsx` 挂载开关组件；验证点击/键盘切换、tooltip、高亮正确

## 3. 背景与根布局

- [x] 3.1 `kaguya.scss`：`.kaguya-img::after` 遮罩按主题取值（var(--kg-overlay) + backdrop-filter）；日间白色系提亮遮罩呈标准日间观感，夜间 transparent/none；画布底色统一黑色消除透亮
- [x] 3.2 验证按 ` 键切换壁纸后遮罩保持

## 4. Navigator（搜索栏/建议/网站表格）

- [x] 4.1 搜索栏、引擎选择、搜索按钮迁移到令牌（保留品牌渐变常量）
- [x] 4.2 建议下拉面板迁移（surface-strong、hover 态）
- [x] 4.3 网站分类表格：底色/文字/边框/悬停迁移到 `--kg-surface`/`--kg-surface-soft`/`--kg-border`/`--kg-text` 令牌（与日历同风格），分类头部渐变保留；列间 `margin-left: -1px` 合并边框、单元格仅 `border-top`，消除双线重叠；去掉斑马纹统一格子底色
- [x] 4.4 双主题下目检表格可读性与悬停态

## 5. Calendar

- [x] 5.1 `calendar.scss` 全量迁移：面板、选择器、按钮、日期格（今天/选中/周末/节假日/调休）、天气标记、定位行与刷新按钮（含 highlight 态）改令牌
- [x] 5.2 双主题目检日历对比度与状态色

## 6. Clock

- [x] 6.1 `clock.tsx`：THEMES 拆 dark/light 集合，订阅 `kaguya:theme-change` 重绘
- [x] 6.2 `clock.scss` 数字时间块迁移令牌；双主题目检

## 7. DeepMode 与其余

- [x] 7.1 `deepmode.scss` 面板/输入/按钮/消息气泡迁移令牌（保留强调色渐变）
- [x] 7.2 `live2d.scss`、`app.scss`、`reset.scss` 中随主题色迁移（reset 仅基础色）
- [x] 7.3 `global.scss` 中 `$list-hover` 等硬编码主题色改为令牌引用或保留为品牌常量并注释

## 8. 校验与收尾

- [x] 8.1 `rg` 扫描 scss 硬编码颜色，白名单品牌渐变/分类头部，其余全部令牌化
- [x] 8.2 核对双主题主要文字/面板对比度 ≥ 4.5:1，不达标调整令牌 alpha
- [x] 8.3 `npx tsc --noEmit` 与 `npm run build` 通过
- [x] 8.4 浏览器目检：三态切换、跟随系统实时响应、持久化、无 FOUC、夜间无纯白表格
- [x] 8.5 openspec 产物全部为合法 UTF-8（修复 tasks.md 编码导致 GitHub Pages Jekyll 构建失败）
