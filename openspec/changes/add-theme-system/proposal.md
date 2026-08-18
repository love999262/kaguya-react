## Why

当前整站只有一套"夜间玻璃"视觉：深色半透明面板 + 浅色文字，且导航网站表格为纯白底。白天强光下深色面板对比刺眼、白色表格在夜间又过亮，缺少随环境切换的能力。需要引入日间/夜间双主题与右上角主题开关，并对全系统样式做一次令牌化梳理，让两套主题风格统一、可维护。

## What Changes

- 新增右上角主题开关：三态（日间 / 夜间 / 跟随系统），默认"跟随系统"，选择持久化到 localStorage
- "跟随系统"监听 `prefers-color-scheme` 变化实时切换，无需刷新
- 引入设计令牌（CSS 自定义属性）体系：表面色、文字色、边框、阴影、强调色等，全部组件样式从硬编码颜色迁移到令牌
- 新增日间主题样式：浅色玻璃面板 + 深色文字；现有夜间视觉令牌化为暗色主题，整体观感保持一致
- 夜间主题下将纯白导航网站表格改为深色玻璃风格，消除夜间刺眼白块；日间主题下保持浅色表格
- 日间模式复用现有随机壁纸且不叠加遮罩（目检确认遮罩发灰发雾，保留遮罩钩子但默认 transparent/none）；夜间模式保持现状
- 首屏渲染前应用已保存主题，避免闪烁（FOUC）
- 时钟（canvas 绘制）配色随当前主题取值，不再完全随机于深色盘

## Capabilities

### New Capabilities
- `ui/theme-system`: 主题模式管理（三态开关、持久化、跟随系统监听、根节点主题属性）、设计令牌与双主题样式契约、右上角开关控件的行为与可访问性要求

### Modified Capabilities
（无，openspec/specs 暂无已有能力）

## Impact

- 样式：`src/scss/` 全部组件样式（global/kaguya/navigator/calendar/clock/deepmode/live2d/app）迁移到令牌
- 代码：新增主题管理模块与开关组件（挂载于 `src/ts/kaguya.tsx` 根布局）；`clock.tsx`、`background.tsx` 适配主题
- 存储：新增 localStorage key `kaguya:theme-mode`
- 无破坏性 API 变更；不引入新依赖
