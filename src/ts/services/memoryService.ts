// 角色记忆学习服务 - 存储对话中学习到的有用信息

import { indexedDBCache } from '../utils/indexedDB';

const MEMORY_CACHE_KEY = 'kaguya:character:memory';
const MAX_MEMORY_ITEMS = 200; // 最多存储200条记忆

export interface MemoryItem {
    id: string;
    content: string; // 记忆内容
    category: 'preference' | 'fact' | 'habit' | 'emotion' | 'other';
    source: string; // 来源（如：天气对话、历史对话等）
    timestamp: number;
    importance: number; // 1-10，重要性评分
}

export interface CharacterMemory {
    memories: MemoryItem[];
    lastUpdated: number;
}

// 获取角色记忆
export async function getCharacterMemory(): Promise<CharacterMemory> {
    try {
        const entry = await indexedDBCache.get<CharacterMemory>(MEMORY_CACHE_KEY);
        if (entry) {
            return entry.data;
        }
    } catch {}
    
    return {
        memories: [],
        lastUpdated: Date.now(),
    };
}

// 保存角色记忆
export async function saveCharacterMemory(memory: CharacterMemory): Promise<void> {
    try {
        await indexedDBCache.set(MEMORY_CACHE_KEY, memory);
    } catch {}
}

// 添加新记忆
export async function addMemory(
    content: string,
    category: MemoryItem['category'],
    source: string,
    importance: number = 5
): Promise<void> {
    const memory = await getCharacterMemory();
    
    // 检查是否已存在相似记忆（简单去重）
    const exists = memory.memories.some(m => 
        m.content.toLowerCase().includes(content.toLowerCase()) ||
        content.toLowerCase().includes(m.content.toLowerCase())
    );
    
    if (exists) {
        console.log('[Memory] 相似记忆已存在，跳过:', content);
        return;
    }
    
    const newMemory: MemoryItem = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        category,
        source,
        timestamp: Date.now(),
        importance: Math.min(10, Math.max(1, importance)),
    };
    
    memory.memories.push(newMemory);
    
    // 按重要性排序，保留最重要的
    memory.memories.sort((a, b) => b.importance - a.importance);
    
    // 限制数量
    if (memory.memories.length > MAX_MEMORY_ITEMS) {
        memory.memories = memory.memories.slice(0, MAX_MEMORY_ITEMS);
    }
    
    memory.lastUpdated = Date.now();
    await saveCharacterMemory(memory);
    
    console.log('[Memory] 新记忆已保存:', content);
}

// 从对话内容中提取和学习记忆
export async function learnFromDialogue(
    dialogue: string,
    source: string
): Promise<void> {
    // 提取用户偏好
    const preferencePatterns = [
        { pattern: /喜欢|爱|偏好|感兴趣/g, category: 'preference' as const },
        { pattern: /讨厌|不喜欢|反感/g, category: 'preference' as const },
        { pattern: /习惯|经常|总是/g, category: 'habit' as const },
        { pattern: /觉得|认为|感觉/g, category: 'emotion' as const },
        { pattern: /知道|了解|记得/g, category: 'fact' as const },
    ];
    
    for (const { pattern, category } of preferencePatterns) {
        if (pattern.test(dialogue)) {
            // 提取包含关键词的句子
            const sentences = dialogue.split(/[。！？\n]/);
            for (const sentence of sentences) {
                if (pattern.test(sentence) && sentence.length > 5 && sentence.length < 100) {
                    await addMemory(sentence.trim(), category, source, 6);
                }
            }
        }
    }
}

// 获取相关记忆（用于角色回复时参考）
export async function getRelevantMemories(
    context: string,
    limit: number = 5
): Promise<MemoryItem[]> {
    const memory = await getCharacterMemory();
    
    // 简单相关性评分
    const scored = memory.memories.map(mem => {
        let score = mem.importance;
        
        // 检查关键词匹配
        const contextWords = context.toLowerCase().split(/\s+/);
        const memWords = mem.content.toLowerCase().split(/\s+/);
        
        for (const word of contextWords) {
            if (word.length > 1 && memWords.some(mw => mw.includes(word) || word.includes(mw))) {
                score += 2;
            }
        }
        
        // 时间衰减（较新的记忆更重要）
        const daysAgo = (Date.now() - mem.timestamp) / (1000 * 60 * 60 * 24);
        score -= daysAgo * 0.1;
        
        return { ...mem, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
}

// 格式化记忆为角色提示
export async function formatMemoriesForPrompt(character: '22' | '33'): Promise<string> {
    const memory = await getCharacterMemory();

    if (memory.memories.length === 0) {
        return '';
    }

    // 获取最近的记忆
    const recentMemories = memory.memories
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

    // 提取用户画像信息
    const preferences: string[] = [];
    const habits: string[] = [];
    const personalityTraits: string[] = [];
    const favoriteCategories: string[] = [];

    for (const mem of memory.memories) {
        // 提取偏好
        if (mem.category === 'preference') {
            const match = mem.content.match(/对(.+?)感兴趣|搜索(.+?)相关内容|访问(.+?)类网站/);
            if (match) {
                const item = match[1] || match[2] || match[3];
                if (item && !preferences.includes(item)) {
                    preferences.push(item);
                }
            }
        }

        // 提取习惯
        if (mem.category === 'habit') {
            const match = mem.content.match(/经常(.+?)|使用(.+?)|访问(.+?)/);
            if (match) {
                const item = match[1] || match[2] || match[3];
                if (item && !habits.includes(item)) {
                    habits.push(item);
                }
            }
        }

        // 提取性格特征
        if (mem.source.includes('性格') || mem.content.includes('性格特征')) {
            const match = mem.content.match(/性格特征：(.+?)[\s-]/);
            if (match && !personalityTraits.includes(match[1])) {
                personalityTraits.push(match[1]);
            }
        }

        // 提取喜欢的分类
        if (mem.content.includes('类网站') || mem.content.includes('感兴趣')) {
            const match = mem.content.match(/"([^"]+)"类|对(.+?)感兴趣/);
            if (match) {
                const cat = match[1] || match[2];
                if (cat && !favoriteCategories.includes(cat)) {
                    favoriteCategories.push(cat);
                }
            }
        }
    }

    // 构建用户画像摘要
    let profileSummary = '';
    if (personalityTraits.length > 0) {
        profileSummary += `\n用户性格：${personalityTraits.slice(0, 3).join('、')}。`;
    }
    if (favoriteCategories.length > 0) {
        profileSummary += `\n偏好类别：${favoriteCategories.slice(0, 3).join('、')}。`;
    }

    const memText = recentMemories.map(m => `- ${m.content}`).join('\n');

    if (character === '22') {
        return `\n\n【用户画像】${profileSummary}\n\n你记得这些关于用户的事情：\n${memText}\n\n在回复时：\n1) 结合用户性格特征，用适合的方式互动\n2) 自然地提及相关记忆，让用户感到被关心和了解\n3) 如果用户是技术型，可以多用技术比喻；如果是文艺型，可以更有情感`;
    } else {
        return `\n\n【用户画像】${profileSummary}\n\n你记录的这些信息可能有用：\n${memText}\n\n在回复时：\n1) 结合用户性格特征，给出合适的回应\n2) 引用相关记忆展现你的观察力和分析能力\n3) 根据用户类型调整建议的风格和深度`;
    }
}

// 清理旧记忆
export async function cleanupOldMemories(keepDays: number = 90): Promise<number> {
    const memory = await getCharacterMemory();
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    
    const originalCount = memory.memories.length;
    memory.memories = memory.memories.filter(m => 
        m.timestamp > cutoff || m.importance >= 8 // 保留重要记忆
    );
    
    await saveCharacterMemory(memory);
    
    const removed = originalCount - memory.memories.length;
    console.log(`[Memory] 清理了 ${removed} 条旧记忆`);
    return removed;
}

// 获取记忆统计
export async function getMemoryStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
}> {
    const memory = await getCharacterMemory();
    
    const byCategory: Record<string, number> = {};
    for (const mem of memory.memories) {
        byCategory[mem.category] = (byCategory[mem.category] || 0) + 1;
    }
    
    return {
        total: memory.memories.length,
        byCategory,
    };
}

// 导出供缓存管理面板使用
export async function clearAllMemories(): Promise<void> {
    try {
        await indexedDBCache.remove(MEMORY_CACHE_KEY);
        console.log('[Memory] 所有记忆已清除');
    } catch {}
}
