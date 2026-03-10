// 记忆检索模块 - 从 IndexedDB 检索相关记忆

import type {
    ConversationRecord,
    LongTermMemory,
    UserPreference,
    MemoryRetrievalOptions,
    MemoryRetrievalResult,
    SessionContext,
    MemoryOwner,
    MemoryType,
} from './types';
import { StoreNames } from './types';
import { getRecentRecords, getByIndex, getAllRecords, putRecord } from './indexedDB';

// 默认检索选项
const DEFAULT_RETRIEVAL_OPTIONS: MemoryRetrievalOptions = {
    limit: 10,
    minConfidence: 0.4,
};

// 检索相关记忆
export async function retrieveMemories(
    options: MemoryRetrievalOptions = {}
): Promise<MemoryRetrievalResult> {
    const opts = { ...DEFAULT_RETRIEVAL_OPTIONS, ...options };

    const [memories, preferences, conversations] = await Promise.all([
        retrieveLongTermMemories(opts),
        retrieveUserPreferences(opts),
        retrieveRecentConversations(opts.limit || 10),
    ]);

    return {
        memories,
        preferences,
        relevantConversations: conversations,
    };
}

// 检索长期记忆
async function retrieveLongTermMemories(
    options: MemoryRetrievalOptions
): Promise<LongTermMemory[]> {
    let memories: LongTermMemory[] = [];

    // 如果有关键词查询，使用关键词索引
    if (options.query) {
        const keywords = extractQueryKeywords(options.query);
        for (const keyword of keywords) {
            const results = await getByIndex<LongTermMemory>(
                StoreNames.LONG_TERM_MEMORY,
                'keywords',
                keyword
            );
            memories.push(...results);
        }
        // 去重
        memories = [...new Map(memories.map(m => [m.id, m])).values()];
    } else {
        // 获取所有记忆
        memories = await getAllRecords<LongTermMemory>(StoreNames.LONG_TERM_MEMORY);
    }

    // 过滤
    memories = memories.filter(mem => {
        // 类型过滤
        if (options.types && !options.types.includes(mem.type)) {
            return false;
        }
        // 所有者过滤
        if (options.owners && !options.owners.includes(mem.owner)) {
            return false;
        }
        // 置信度过滤
        if (options.minConfidence && mem.confidence < options.minConfidence) {
            return false;
        }
        // 时间范围过滤
        if (options.timeRange) {
            if (options.timeRange.start && mem.createdAt < options.timeRange.start) {
                return false;
            }
            if (options.timeRange.end && mem.createdAt > options.timeRange.end) {
                return false;
            }
        }
        return true;
    });

    // 按相关性和置信度排序
    memories = memories.sort((a, b) => {
        const scoreA = calculateMemoryScore(a, options.query);
        const scoreB = calculateMemoryScore(b, options.query);
        return scoreB - scoreA;
    });

    // 限制数量
    if (options.limit) {
        memories = memories.slice(0, options.limit);
    }

    // 更新访问计数
    for (const memory of memories) {
        await updateMemoryAccess(memory);
    }

    return memories;
}

// 计算记忆分数（用于排序）
function calculateMemoryScore(memory: LongTermMemory, query?: string): number {
    let score = memory.confidence;

    // 访问频率加成
    score += Math.min(0.2, memory.accessCount * 0.02);

    // 时效性（越近越好）
    const daysSinceAccess = (Date.now() - memory.lastAccessed) / (24 * 3600 * 1000);
    score += Math.max(0, 0.1 - daysSinceAccess * 0.01);

    // 查询匹配度
    if (query) {
        const queryKeywords = extractQueryKeywords(query);
        const matchCount = queryKeywords.filter(k =>
            memory.keywords.some(mk => mk.includes(k) || k.includes(mk))
        ).length;
        score += matchCount * 0.15;
    }

    return score;
}

// 更新记忆访问信息
async function updateMemoryAccess(memory: LongTermMemory): Promise<void> {
    const updated: LongTermMemory = {
        ...memory,
        accessCount: memory.accessCount + 1,
        lastAccessed: Date.now(),
    };
    await putRecord(StoreNames.LONG_TERM_MEMORY, updated);
}

// 检索用户偏好
async function retrieveUserPreferences(
    options: MemoryRetrievalOptions
): Promise<UserPreference[]> {
    let prefs: UserPreference[] = [];

    if (options.owners) {
        for (const owner of options.owners) {
            const results = await getByIndex<UserPreference>(
                StoreNames.USER_PREFERENCES,
                'owner',
                owner
            );
            prefs.push(...results);
        }
    } else {
        prefs = await getAllRecords<UserPreference>(StoreNames.USER_PREFERENCES);
    }

    // 按强化次数排序
    prefs = prefs.sort((a, b) => b.reinforcedCount - a.reinforcedCount);

    if (options.limit) {
        prefs = prefs.slice(0, options.limit);
    }

    return prefs;
}

// 检索最近对话
async function retrieveRecentConversations(limit: number): Promise<ConversationRecord[]> {
    return getRecentRecords<ConversationRecord>(StoreNames.CONVERSATIONS, limit);
}

// 提取查询关键词
function extractQueryKeywords(query: string): string[] {
    // 简单分词，可后续使用更复杂的分词器
    return query
        .replace(/[，。！？,.!?]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2)
        .slice(0, 5);
}

// 构建会话上下文
export async function buildSessionContext(sessionId?: string): Promise<SessionContext> {
    const id = sessionId || `session_${Date.now()}`;

    const [recentConvs, memories, prefs] = await Promise.all([
        retrieveRecentConversations(10),
        retrieveMemories({ limit: 5 }),
        retrieveUserPreferences({ limit: 5 }),
    ]);

    return {
        sessionId: id,
        startTime: Date.now(),
        recentConversations: recentConvs,
        relevantMemories: memories.memories,
        userPreferences: prefs,
    };
}

// 格式化记忆为 Prompt 上下文
export function formatMemoriesForPrompt(
    context: SessionContext,
    speaker: '22' | '33'
): string {
    const lines: string[] = [];

    // 共享记忆
    const sharedMemories = context.relevantMemories.filter(m => m.owner === 'shared');
    if (sharedMemories.length > 0) {
        lines.push('【共同记忆】');
        sharedMemories.forEach(m => {
            lines.push(`- ${m.content}`);
        });
    }

    // 角色私有记忆
    const privateMemories = context.relevantMemories.filter(m => m.owner === speaker);
    if (privateMemories.length > 0) {
        lines.push(`【${speaker}的私有记忆】`);
        privateMemories.forEach(m => {
            lines.push(`- ${m.content}`);
        });
    }

    // 用户偏好
    if (context.userPreferences.length > 0) {
        lines.push('【用户偏好】');
        context.userPreferences.forEach(p => {
            lines.push(`- ${p.key}: ${p.value}`);
        });
    }

    // 最近对话
    if (context.recentConversations.length > 0) {
        lines.push('【最近对话】');
        context.recentConversations.slice(-5).forEach(c => {
            const role = c.role === 'user' ? '用户' : c.role;
            lines.push(`${role}: ${c.content}`);
        });
    }

    return lines.join('\n');
}

// 保存用户偏好
export async function saveUserPreference(
    key: string,
    value: string,
    category: UserPreference['category'],
    owner: MemoryOwner = 'shared'
): Promise<void> {
    const existing = await getByIndex<UserPreference>(
        StoreNames.USER_PREFERENCES,
        'owner',
        owner
    );

    const found = existing.find(p => p.key === key);

    if (found) {
        // 更新现有偏好
        const updated: UserPreference = {
            ...found,
            value,
            reinforcedCount: found.reinforcedCount + 1,
            lastReinforced: Date.now(),
        };
        await putRecord(StoreNames.USER_PREFERENCES, updated);
    } else {
        // 创建新偏好
        const pref: UserPreference = {
            key,
            value,
            category,
            learnedAt: Date.now(),
            reinforcedCount: 1,
            lastReinforced: Date.now(),
            owner,
        };
        await putRecord(StoreNames.USER_PREFERENCES, pref);
    }
}

// 保存对话记录
export async function saveConversation(
    role: 'user' | '22' | '33',
    content: string,
    sessionId?: string
): Promise<ConversationRecord> {
    const record: ConversationRecord = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        role,
        content,
        sessionId,
    };

    const { addRecord } = await import('./indexedDB');
    await addRecord(StoreNames.CONVERSATIONS, record);

    return record;
}

// 获取角色特定的记忆
export async function getMemoriesForRole(
    role: '22' | '33',
    limit = 5
): Promise<LongTermMemory[]> {
    const allMemories = await getAllRecords<LongTermMemory>(StoreNames.LONG_TERM_MEMORY);

    // 筛选共享或角色私有记忆
    const relevant = allMemories.filter(m => m.owner === 'shared' || m.owner === role);

    // 按置信度和访问次数排序
    return relevant
        .sort((a, b) => {
            const scoreA = a.confidence + a.accessCount * 0.05;
            const scoreB = b.confidence + b.accessCount * 0.05;
            return scoreB - scoreA;
        })
        .slice(0, limit);
}
