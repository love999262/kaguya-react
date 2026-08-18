# fix-typecheck-errors

## Why

`npx tsc --noEmit` 存在 44 个既有类型错误（deepmode、services、utils、memory、skit、searchengle、translator）。vite build 不做类型检查故能出包，但类型系统失效意味着重构无安全网，且隐藏了真实 bug 风险（如 `STRATEGIES` 改名遗漏、`joke.content` 对 string 取值等运行时隐患）。

## What Changes

- 补齐动态 import 改造后遗留的悬空引用：`SkitEngine`（type-only）、`formatMemoriesForPrompt`、`getTodayInHistory`/`formatHistoryForCharacter`、`indexedDBCache`、`addMemory`，全部以不破坏代码分割的方式接线（type-only import 或局部 async 包装函数内动态 import）
- 修正改名遗漏：deepmode 内 `STRATEGIES` → `LLM_LOAD_STRATEGIES`
- 修正与库/类型不符的调用：`fetchJokeFromAPI` 返回 string、`fetchAllNews` → `fetchHotNews`、`top_p` 补入本地 WebLLM 接口、`addDialogueMessage` metadata 联合类型对齐
- 最小类型修正：JSON 数据断言为 `MemorialDay[]`、`getByIndex` 接受 `IDBKeyRange`、`requestIdleCallback` 判定改 typeof、window 动态属性断言经 unknown、translator 对 deepmode 可选导出做安全类型化

## Impact

- 不改变任何运行时行为与 bundle 分割结构（main/deepmode/memoryService/indexedDB 等 chunk 边界保持）
- 验收标准：`npx tsc --noEmit` 0 错误，`npm run build` 通过
