// IndexedDB 长期记忆系统类型定义

export const DB_NAME = 'KaguyaMemoryDB';
export const DB_VERSION = 1;

export enum StoreNames {
    CONVERSATIONS = 'conversations',         // 原始对话记录
    LONG_TERM_MEMORY = 'longTermMemory',     // 提炼后的长期记忆
    SKIT_HISTORY = 'skitHistory',            // 小剧场历史
    USER_PREFERENCES = 'userPreferences',    // 用户偏好
}

// 原始对话记录
export interface ConversationRecord {
    id: string;                      // UUID
    timestamp: number;               // 时间戳
    role: 'user' | '22' | '33';
    content: string;
    topic?: string;                  // 自动标签
    importance?: number;             // 重要性评分 (0-1)
    sessionId?: string;              // 所属会话ID
}

// 长期记忆类型
export type MemoryType = 'preference' | 'fact' | 'relationship' | 'joke' | 'style' | 'topic';

// 记忆所有者
export type MemoryOwner = 'shared' | '22' | '33';

// 长期记忆
export interface LongTermMemory {
    id: string;
    createdAt: number;
    updatedAt: number;
    type: MemoryType;
    content: string;                 // 记忆内容 (简短，< 100 字)
    sourceConversationIds: string[]; // 来源对话
    accessCount: number;             // 访问次数 (用于权重)
    lastAccessed: number;            // 最后访问时间
    owner: MemoryOwner;              // 共享或私有
    confidence: number;              // 置信度 (0-1)
    expiration?: number;             // 过期时间 (可选)
    keywords: string[];              // 关键词，用于检索
}

// 用户偏好
export interface UserPreference {
    key: string;
    value: string;
    category: 'topic' | 'style' | 'habit' | 'dislike' | 'like';
    learnedAt: number;
    reinforcedCount: number;
    lastReinforced: number;
    owner: MemoryOwner;
}

// 小剧场历史
export interface SkitRecord {
    id: string;
    timestamp: number;
    topic: string;
    topicType: string;
    turns: Array<{
        speaker: '22' | '33';
        content: string;
        action: string;
    }>;
    userReaction?: 'like' | 'neutral' | 'skip' | 'laugh';
    duration: number;                // 持续时间 (毫秒)
}

// 记忆检索结果
export interface MemoryRetrievalResult {
    memories: LongTermMemory[];
    preferences: UserPreference[];
    relevantConversations: ConversationRecord[];
}

// 记忆检索选项
export interface MemoryRetrievalOptions {
    query?: string;
    types?: MemoryType[];
    owners?: MemoryOwner[];
    limit?: number;
    timeRange?: {
        start?: number;
        end?: number;
    };
    minConfidence?: number;
}

// 记忆提炼结果
export interface MemoryExtractionResult {
    shouldExtract: boolean;
    type?: MemoryType;
    content?: string;
    owner?: MemoryOwner;
    confidence?: number;
    keywords?: string[];
}

// 会话上下文
export interface SessionContext {
    sessionId: string;
    startTime: number;
    recentConversations: ConversationRecord[];
    relevantMemories: LongTermMemory[];
    userPreferences: UserPreference[];
}

// 数据库初始化配置
export interface DBConfig {
    name: string;
    version: number;
    stores: StoreConfig[];
}

export interface StoreConfig {
    name: StoreNames;
    keyPath: string;
    indexes: IndexConfig[];
}

export interface IndexConfig {
    name: string;
    keyPath: string | string[];
    unique?: boolean;
    multiEntry?: boolean;
}
