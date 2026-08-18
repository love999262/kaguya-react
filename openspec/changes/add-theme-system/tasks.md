## 1. 令牌与主题管理器基础

- [x] 1.1 新建 `src/scss/theme.scss`：定�?`:root[data-theme='dark']` �?`:root[data-theme='light']` 两套 `--kg-*` 令牌（surface/surface-strong/surface-hover/border/border-strong/text/text-muted/text-faint/accent/accent-soft/shadow/glass-blur/grid-surface/grid-text/overlay），夜间值抽样自现有视觉，日间值按设计定稿；在 `index.scss` 顶部 `@use`
- [x] 1.2 新建 `src/ts/theme.ts`：Mode 类型、`initTheme()`（同步读 `kaguya:theme-mode`、校验、默�?system、设 `document.documentElement.dataset.theme`）、`setMode`、`getResolved`、`onChange`（matchMedia change 监听，仅 system 生效）、派�?`kaguya:theme-change`
- [x] 1.3 `app.tsx` �?render 前调�?`initTheme()`
- [x] 1.4 验证：手动改 localStorage 三种值刷新，首屏无闪烁；system 模式下调系统偏好实时切换

## 2. 右上角三态开�?
- [x] 2.1 新建 `src/ts/themeToggle.tsx`：radiogroup 语义、太�?月亮/显示器内�?SVG、title 提示、方向键+回车键盘支持、当前模式高亮、订�?theme 模块更新
- [x] 2.2 新建 `src/scss/themeToggle.scss`（或并入 kaguya.scss）：固定右上角玻璃胶囊样式，双主题令牌取值；`index.scss` 引入
- [x] 2.3 `kaguya.tsx` 挂载开关组件；验证点击/键盘切换、tooltip、高亮正�?
## 3. 背景与根布局

- [x] 3.1 `kaguya.scss`：根容器背景色改令牌；`.kaguya-img::after` 日间遮罩（var(--kg-overlay) + backdrop-filter），夜间透明
- [x] 3.2 验证�?` 键切换壁纸后遮罩保持

## 4. Navigator（搜索栏/建议/网站表格�?
- [x] 4.1 搜索栏、引擎选择、搜索按钮迁移到令牌（保留品牌渐变常量）
- [x] 4.2 建议下拉面板迁移（surface-strong、hover 态）
- [x] 4.3 网站分类表格：底�?文字/边框/悬停迁移�?`--kg-grid-*` 与文本令牌，夜间深色玻璃、日间浅色；分类头部渐变保留
- [x] 4.4 双主题下目检表格可读性与悬停�?
## 5. Calendar

- [x] 5.1 `calendar.scss` 全量迁移：面板、选择器、按钮、日期格（今�?选中/周末/节假�?调休）、天气标记、定位行与刷新按钮（�?highlight 态）改令�?- [x] 5.2 双主题目检日历对比度与状态色

## 6. Clock

- [x] 6.1 `clock.tsx`：THEMES �?dark/light 集合，订�?`kaguya:theme-change` 重抽并重�?- [x] 6.2 `clock.scss` 数字时间块迁移令牌；双主题目检

## 7. DeepMode 与其�?
- [x] 7.1 `deepmode.scss` 面板/输入/按钮/消息气泡迁移令牌（保留强调色渐变�?- [x] 7.2 `live2d.scss`、`app.scss`、`reset.scss` 中随主题色迁移（reset 仅基础色）
- [x] 7.3 `global.scss` �?`$list-hover` 等硬编码主题色改为令牌引用或保留为品牌常量并注释

## 8. 校验与收�?
- [x] 8.1 `rg` 扫描 scss 硬编码颜色，白名单品牌渐�?分类头部，其余全部令牌化
- [x] 8.2 核对双主题主要文�?面板对比�?�?.5:1，不达标调整令牌 alpha
- [x] 8.3 `npm run typecheck`（calendar 等目标文件无新增错误）与 `npm run build` 通过
- [x] 8.4 浏览器目检：三态切换、跟随系统实时响应、持久化、无 FOUC、夜间无纯白表格
