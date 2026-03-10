// 记忆提炼引擎 - 从对话中提取长期记忆

import type {
    ConversationRecord,
    LongTermMemory,
    MemoryExtractionResult,
    MemoryType,
    MemoryOwner,
} from './types';
import { StoreNames } from './types';
import { addRecord, putRecord, getByIndex, getRecentRecords } from './indexedDB';

// 立即提炼触发词（用户明确表达偏好）
const IMMEDIATE_TRIGGERS = [
    /我喜欢?(.+)/,
    /我讨厌(.+)/,
    /我不喜欢(.+)/,
    /我记得(.+)/,
    /以后(.+)/,
    /总是(.+)/,
    /从不(.+)/,
    /我习惯(.+)/,
    /我经常(.+)/,
    /我最爱(.+)/,
    /我最讨厌(.+)/,
    /我觉得(.+)(?:很好|不错|很棒|有意思)/,
    /我对(.+)感兴趣/,
];

// 重要性评分规则
const IMPORTANCE_RULES = [
    { pattern: /喜欢|讨厌|爱|恨/, weight: 0.8 },
    { pattern: /总是|从不|经常|习惯/, weight: 0.7 },
    { pattern: /记得|回忆|以前/, weight: 0.6 },
    { pattern: /重要|关键|必须/, weight: 0.7 },
    { pattern: /生日|纪念日|节日/, weight: 0.5 },
];

// 计算对话重要性
export function scoreImportance(content: string): number {
    let score = 0.3; // 基础分

    for (const rule of IMPORTANCE_RULES) {
        if (rule.pattern.test(content)) {
            score += rule.weight;
        }
    }

    // 长度因子（适中长度更重要）
    const charCount = Array.from(content).length;
    if (charCount >= 10 && charCount <= 100) {
        score += 0.1;
    }

    return Math.min(1, score);
}

// 检查是否需要立即提炼
export function shouldExtractImmediately(content: string): boolean {
    return IMMEDIATE_TRIGGERS.some(pattern => pattern.test(content));
}

// 提取关键词
export function extractKeywords(content: string): string[] {
    const keywords: string[] = [];

    // 简单关键词提取（可后续使用更复杂的 NLP）
    const patterns = [
        /(?:喜欢|讨厌|爱|恨)(?:\s*)([^，。！？,.!?]{2,10})/,
        /(?:对|关于)([^，。！？,.!?]{2,10})(?:感兴趣|有研究|了解)/,
        /(?:经常|总是|习惯)([^，。！？,.!?]{2,10})/,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            keywords.push(match[1].trim());
        }
    }

    // 去重
    return [...new Set(keywords)];
}

// 确定记忆类型
export function determineMemoryType(content: string): MemoryType {
    if (/喜欢|讨厌|爱|恨|感兴趣/.test(content)) {
        return 'preference';
    }
    if (/是|叫|住在|工作在/.test(content) && !/[吗呢？]/.test(content)) {
        return 'fact';
    }
    if (/我们|一起|认识/.test(content)) {
        return 'relationship';
    }
    if (/笑话|搞笑|梗/.test(content)) {
        return 'joke';
    }
    if (/风格|语气|说话/.test(content)) {
        return 'style';
    }
    return 'topic';
}

// 确定记忆所有者
export function determineMemoryOwner(
    content: string,
    speaker: 'user' | '22' | '33'
): MemoryOwner {
    // 如果是角色说的话，通常是共享记忆
    if (speaker !== 'user') {
        return 'shared';
    }

    // 检查内容是否涉及特定角色
    if (/22|22娘/.test(content) && !/33|33娘/.test(content)) {
        return '22';
    }
    if (/33|33娘/.test(content) && !/22|22娘/.test(content)) {
        return '33';
    }

    return 'shared';
}

// 生成记忆 ID
function generateMemoryId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 提炼单条记忆
export async function extractMemory(
    conversation: ConversationRecord
): Promise<LongTermMemory | null> {
    const importance = conversation.importance || scoreImportance(conversation.content);

    // 重要性低于阈值，不提炼
    if (importance < 0.4) {
        return null;
    }

    const type = determineMemoryType(conversation.content);
    const owner = determineMemoryOwner(conversation.content, conversation.role);
    const keywords = extractKeywords(conversation.content);

    // 生成简洁的记忆内容
    const content = summarizeForMemory(conversation.content, type);

    const memory: LongTermMemory = {
        id: generateMemoryId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        type,
        content,
        sourceConversationIds: [conversation.id],
        accessCount: 0,
        lastAccessed: Date.now(),
        owner,
        confidence: importance,
        keywords,
    };

    return memory;
}

// 为记忆生成简洁摘要
function summarizeForMemory(content: string, type: MemoryType): string {
    // 去除语气词和冗余
    let summary = content
        .replace(/[啊呢吧吗嘛]/g, '')
        .replace(/我觉得|我认为|我感觉/g, '')
        .replace(/其实|说实话|说真的/g, '')
        .trim();

    // 根据类型提取核心
    switch (type) {
        case 'preference':
            // 提取"喜欢/讨厌 + 对象"
            const prefMatch = summary.match(/(?:喜欢|讨厌|爱|恨)([^，。！]{1,20})/);
            if (prefMatch) {
                summary = `喜欢${prefMatch[1]}`;
            }
            break;
        case 'fact':
            // 提取陈述句核心
            summary = summary.replace(/[是|为]/, ': ');
            break;
    }

    // 限制长度
    if (summary.length > 80) {
        summary = summary.substring(0, 77) + '...';
    }

    return summary;
}

// 批量提炼记忆
export async function extractMemoriesBatch(
    conversations: ConversationRecord[],
    minImportance = 0.4
): Promise<LongTermMemory[]> {
    const memories: LongTermMemory[] = [];

    for (const conv of conversations) {
        const importance = conv.importance || scoreImportance(conv.content);
        if (importance >= minImportance) {
            const memory = await extractMemory({ ...conv, importance });
            if (memory) {
                memories.push(memory);
            }
        }
    }

    return memories;
}

// 保存记忆到数据库
export async function saveMemory(memory: LongTermMemory): Promise<void> {
    await addRecord(StoreNames.LONG_TERM_MEMORY, memory);
}

// 合并相似记忆
export async function mergeSimilarMemories(
    newMemory: LongTermMemory,
    existingMemories: LongTermMemory[]
): Promise<LongTermMemory | null> {
    // 查找相似记忆（关键词重叠 > 50%）
    const similar = existingMemories.find(mem => {
        const overlap = mem.keywords.filter(k => newMemory.keywords.includes(k));
        return overlap.length / Math.max(mem.keywords.length, newMemory.keywords.length) > 0.5;
    });

    if (similar) {
        // 合并：保留置信度更高的内容
        const merged: LongTermMemory = {
            ...similar,
            content: newMemory.confidence > similar.confidence
                ? newMemory.content
                : similar.content,
            confidence: Math.max(similar.confidence, newMemory.confidence),
            updatedAt: Date.now(),
            sourceConversationIds: [...similar.sourceConversationIds, ...newMemory.sourceConversationIds],
        };
        await putRecord(StoreNames.LONG_TERM_MEMORY, merged);
        return merged;
    }

    return null;
}

// 记忆降权（定期任务）
export async function decayMemories(): Promise<number> {
    const memories = await getByIndex<LongTermMemory>(
        StoreNames.LONG_TERM_MEMORY,
        'confidence',
        IDBKeyRange.lowerBound(0)
    );

    let decayedCount = 0;

    for (const memory of memories) {
        const monthsSinceAccess = (Date.now() - memory.lastAccessed) / (30 * 24 * 3600 * 1000);

        // 指数降权
        const newConfidence = memory.confidence * Math.pow(0.9, monthsSinceAccess);

        if (newConfidence < 0.2) {
            // 置信度低于阈值，删除
            const { deleteRecord } = await import('./indexedDB');
            await deleteRecord(StoreNames.LONG_TERM_MEMORY, memory.id);
        } else if (newConfidence !== memory.confidence) {
            // 更新置信度
            await putRecord(StoreNames.LONG_TERM_MEMORY, {
                ...memory,
                confidence: newConfidence,
            });
            decayedCount++;
        }
    }

    return decayedCount;
}

// 自动提炼任务（每 5 轮对话触发）
let conversationCount = 0;
const EXTRACTION_INTERVAL = 5;

export async function autoExtractIfNeeded(
    conversation: ConversationRecord
): Promise<LongTermMemory | null> {
    conversationCount++;

    // 立即提炼检查
    if (shouldExtractImmediately(conversation.content)) {
        const memory = await extractMemory(conversation);
        if (memory) {
            await saveMemory(memory);
            return memory;
        }
    }

    // 定期批量提炼
    if (conversationCount % EXTRACTION_INTERVAL === 0) {
        const recentConvs = await getRecentRecords<ConversationRecord>(
            StoreNames.CONVERSATIONS,
            EXTRACTION_INTERVAL
        );

        const memories = await extractMemoriesBatch(recentConvs);

        for (const memory of memories) {
            // 检查是否有相似记忆
            const existing = await getByIndex<LongTermMemory>(
                StoreNames.LONG_TERM_MEMORY,
                'keywords',
                memory.keywords[0] || ''
            );

            const merged = await mergeSimilarMemories(memory, existing);
            if (!merged) {
                await saveMemory(memory);
            }
        }
    }

    return null;
}
