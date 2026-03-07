# kaguya-react

一个个人导航页项目，已从旧版 webpack 工程迁移到 Vite + React 18 + TypeScript。

## Run

```bash
npm install
npm run dev
```

默认地址：`http://localhost:8089`

## Build

```bash
npm run typecheck
npm run build
npm run preview
```

## Modernization notes

- 移除跨域远程 JSON 请求，改为本地打包数据，修复 CORS 问题。
- 移除 `axios`，统一使用浏览器原生能力和本地数据。
- 所有外链跳转启用 `noopener,noreferrer` 并做协议校验。
- 依赖升级后 `npm audit` 当前为 `0 vulnerabilities`。
- 样式重构为响应式玻璃卡片风格，优化了移动端布局和交互。
