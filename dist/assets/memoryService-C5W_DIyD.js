import{i as l}from"./indexedDB-B3tADfI-.js";const f="kaguya:character:memory",y="kaguya:dialogue:history",p=200,d=1e3;async function g(){try{const e=await l.get(f);if(e)return e.data}catch{}return{memories:[],lastUpdated:Date.now()}}async function w(e){try{await l.set(f,e)}catch{}}async function D(e,o,i,s=5){const t=await g();if(t.memories.some(r=>r.content.toLowerCase().includes(e.toLowerCase())||e.toLowerCase().includes(r.content.toLowerCase()))){console.log("[Memory] 相似记忆已存在，跳过:",e);return}const c={id:`mem_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,content:e,category:o,source:i,timestamp:Date.now(),importance:Math.min(10,Math.max(1,s))};t.memories.push(c),t.memories.sort((r,a)=>a.importance-r.importance),t.memories.length>p&&(t.memories=t.memories.slice(0,p)),t.lastUpdated=Date.now(),await w(t),console.log("[Memory] 新记忆已保存:",e)}async function C(e,o){const i=[{pattern:/喜欢|爱|偏好|感兴趣/g,category:"preference"},{pattern:/讨厌|不喜欢|反感/g,category:"preference"},{pattern:/习惯|经常|总是/g,category:"habit"},{pattern:/觉得|认为|感觉/g,category:"emotion"},{pattern:/知道|了解|记得/g,category:"fact"}];for(const{pattern:s,category:t}of i)if(s.test(e)){const n=e.split(/[。！？\n]/);for(const c of n)s.test(c)&&c.length>5&&c.length<100&&await D(c.trim(),t,o,6)}}async function _(e,o=5){const s=(await g()).memories.map(t=>{let n=t.importance;const c=e.toLowerCase().split(/\s+/),r=t.content.toLowerCase().split(/\s+/);for(const m of c)m.length>1&&r.some(h=>h.includes(m)||m.includes(h))&&(n+=2);const a=(Date.now()-t.timestamp)/(1e3*60*60*24);return n-=a*.1,{...t,score:n}});return s.sort((t,n)=>n.score-t.score),s.slice(0,o)}async function E(e){const o=await g();if(o.memories.length===0)return"";const i=o.memories.sort((r,a)=>a.timestamp-r.timestamp).slice(0,10),s=[],t=[];for(const r of o.memories){if(r.category==="preference"){const a=r.content.match(/对(.+?)感兴趣|搜索(.+?)相关内容|访问(.+?)类网站/);a&&(a[1]||a[2]||a[3])}if(r.category==="habit"){const a=r.content.match(/经常(.+?)|使用(.+?)|访问(.+?)/);a&&(a[1]||a[2]||a[3])}if(r.source.includes("性格")||r.content.includes("性格特征")){const a=r.content.match(/性格特征：(.+?)[\s-]/);a&&!s.includes(a[1])&&s.push(a[1])}if(r.content.includes("类网站")||r.content.includes("感兴趣")){const a=r.content.match(/"([^"]+)"类|对(.+?)感兴趣/);if(a){const m=a[1]||a[2];m&&!t.includes(m)&&t.push(m)}}}let n="";s.length>0&&(n+=`
用户性格：${s.slice(0,3).join("、")}。`),t.length>0&&(n+=`
偏好类别：${t.slice(0,3).join("、")}。`);const c=i.map(r=>`- ${r.content}`).join(`
`);return e==="22"?`

【用户画像】${n}

你记得这些关于用户的事情：
${c}

在回复时：
1) 结合用户性格特征，用适合的方式互动
2) 自然地提及相关记忆，让用户感到被关心和了解
3) 如果用户是技术型，可以多用技术比喻；如果是文艺型，可以更有情感`:`

【用户画像】${n}

你记录的这些信息可能有用：
${c}

在回复时：
1) 结合用户性格特征，给出合适的回应
2) 引用相关记忆展现你的观察力和分析能力
3) 根据用户类型调整建议的风格和深度`}async function u(){try{const e=await l.get(y);if(e)return e.data}catch{}return{messages:[],lastUpdated:Date.now()}}async function M(e){try{await l.set(y,e)}catch{}}async function v(e,o,i){const s=await u(),t={id:`dlg_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,role:e,content:o,timestamp:Date.now(),metadata:i};s.messages.push(t),s.messages.length>d&&(s.messages=s.messages.slice(-d)),s.lastUpdated=Date.now(),await M(s),console.log("[Dialogue] 对话已保存:",e,o.slice(0,50))}async function A(e=20){return(await u()).messages.slice(-e)}async function L(e,o=10){const s=(await u()).messages.slice(-o);if(s.length===0)return"";const t=s.map(n=>{let c="";return n.role==="user"?c="用户":n.role==="assistant22"?c="22":n.role==="assistant33"?c="33":n.role==="system"&&(c="系统"),`${c}: ${n.content}`}).join(`
`);return e==="22"?`

最近的对话记录：
${t}

请结合上下文自然地回复。`:`

最近的对话记录：
${t}

请基于上下文给出合适的回应。`}async function x(e=30){const o=await u(),i=Date.now()-e*24*60*60*1e3,s=o.messages.length;o.messages=o.messages.filter(n=>n.timestamp>i),await M(o);const t=s-o.messages.length;return console.log(`[Dialogue] 清理了 ${t} 条旧对话`),t}async function O(){try{await l.remove(y),console.log("[Dialogue] 所有对话已清除")}catch{}}async function S(e=90){const o=await g(),i=Date.now()-e*24*60*60*1e3,s=o.memories.length;o.memories=o.memories.filter(n=>n.timestamp>i||n.importance>=8),await w(o);const t=s-o.memories.length;return console.log(`[Memory] 清理了 ${t} 条旧记忆`),t}async function U(){const e=await g(),o={};for(const i of e.memories)o[i.category]=(o[i.category]||0)+1;return{total:e.memories.length,byCategory:o}}async function b(){try{await l.remove(f),console.log("[Memory] 所有记忆已清除")}catch{}}export{v as addDialogueMessage,D as addMemory,x as cleanupOldDialogues,S as cleanupOldMemories,O as clearAllDialogues,b as clearAllMemories,L as formatDialogueHistoryForPrompt,E as formatMemoriesForPrompt,g as getCharacterMemory,u as getDialogueHistory,U as getMemoryStats,A as getRecentDialogues,_ as getRelevantMemories,C as learnFromDialogue,w as saveCharacterMemory,M as saveDialogueHistory};
