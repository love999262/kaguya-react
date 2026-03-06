# kaguya-react

个人导航页项目，技术栈为 Vite + React 18 + TypeScript。

## 开发

```bash
npm install
npm run dev
```

默认地址：`http://localhost:8089`

## 构建与预览

```bash
npm run typecheck
npm run build
npm run preview
```

预览地址：`http://localhost:4173`

## 当前优化项

- 背景图片改为本地 `webp`，减少静态资源体积。
- 加入 Service Worker，对 `/backgrounds/*` 使用 `cache-first`。
- 默认搜索引擎改为 Bing。
- 搜索框快捷键改为 `/` 聚焦，避免全局输入抢焦点。
- 链接数据已统一为 `https://`，并清理重复项。
- 工程已迁移到 Vite，`npm audit` 当前为 `0 vulnerabilities`。

## 静态部署分支

- `master`：源码分支
- `IO`：静态页面分支（部署产物）
