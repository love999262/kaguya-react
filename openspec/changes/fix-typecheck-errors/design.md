## Context

deepmode 等模块曾做"纯动态 import"性能改造（WebLLM、小剧场、记忆、历史、indexedDB 等不进主 bundle），改造后留下仅在类型层面失效的悬空引用；另有少量历史遗留类型不匹配。tsc 全量报错 44 处，vite 出包不受影响。

## Decisions

### 1. 悬空引用接线方式：保持代码分割
- 仅类型用途（`SkitEngine` 作为 ref 类型）用 `import type`，编译期擦除，零运行时成本
- 值用途统一在消费函数内 `await import(...)`，或定义模块级 async 包装函数（如 `formatMemoriesForPrompt` 包装），chunk 边界与改造前一致
- 否决：恢复静态 import（会把 memoryService/indexedDB/skit 拉回主 bundle，回退性能改造）

### 2. 改名/签名不符：以现存实现为准
- `STRATEGIES` → `LLM_LOAD_STRATEGIES`（同文件已定义）
- `fetchAllNews` → `fetchHotNews`；`NewsItem` 无 `summary` 字段，topics 直接取 `title`
- `fetchJokeFromAPI` 返回 `string | null`，去掉 `.content` 取值
- 本地 `MLCEngineInterface` 的 create options 补 `top_p?: number`
- `pushMessage` metadata.type 对齐 `DialogueMessage['metadata']` 的联合类型

### 3. 最小类型修正，不重构
- `memorial-days.json` 断言为 `MemorialDay[]`（数据即事实来源）
- `getByIndex` 的 value 参数放宽为 `IDBValidKey | IDBKeyRange`（IDB 索引查询本就支持 range）
- `performance.ts` 用 `typeof window.requestIdleCallback === 'function'` 替代 `in` 检查（避免 Window 类型下 else 分支被收窄为 never）
- `searchengle.tsx` window 动态属性断言经 `unknown`
- `translator.ts` 将 deepmode 动态 import 断言为含可选 `getWebLLMInstance` 的形状；运行时该导出不存在时安全回退（现状行为不变）

## Risks / Trade-offs

- [包装函数增加间接层] → 命名与原名一致，调用点零改动
- [JSON 断言绕过结构校验] → 数据文件稳定，且有 MemorialDay 接口约束字段使用处
