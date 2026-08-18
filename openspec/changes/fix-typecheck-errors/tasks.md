## 1. deepmode.tsx 悬空引用

- [x] 1.1 `import type { SkitEngine } from './skit/engine'`
- [x] 1.2 模块级 async 包装 `formatMemoriesForPrompt`（内部动态 import memoryService）
- [x] 1.3 历史模式函数内动态 import `getTodayInHistory`/`formatHistoryForCharacter`
- [x] 1.4 三处消费函数内动态 import `indexedDBCache`（getOtherCachesInfo / handleClearSelectedCaches / CachePanel checkAvailableCaches）
- [x] 1.5 `STRATEGIES` → `LLM_LOAD_STRATEGIES`（2 处）

## 2. deepmode.tsx 类型对齐

- [x] 2.1 `MLCEngineInterface` create options 补 `top_p?: number`
- [x] 2.2 `pushMessage` metadata.type 改为联合类型
- [x] 2.3 `joke?.content` → `joke`（fetchJokeFromAPI 返回 string | null）

## 3. 其余文件

- [x] 3.1 `memory/indexedDB.ts` getByIndex value 放宽 `IDBValidKey | IDBKeyRange`
- [x] 3.2 `searchengle.tsx` window 断言经 unknown
- [x] 3.3 `utils/performance.ts` requestIdleCallback 改 typeof 判定
- [x] 3.4 `utils/date.ts` memorialDaysData 断言 `MemorialDay[]`（2 处）
- [x] 3.5 `services/searchAnalysisService.ts` / `navigationAnalysisService.ts` 局部 async 包装 addMemory（type-only 引 MemoryItem）
- [x] 3.6 `services/translator.ts` deepmode 可选导出安全类型化
- [x] 3.7 `skit/topics.ts` fetchAllNews → fetchHotNews，content 取 title

## 4. 校验

- [x] 4.1 `npx tsc --noEmit` 0 错误
- [x] 4.2 `npm run build` 通过
