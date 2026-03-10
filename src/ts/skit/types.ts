// 小剧场/轻相声模式类型定义

export type SkitTopicType = 'news' | 'history' | 'holiday' | 'tech' | 'joke' | 'custom';

export interface SkitTopic {
    type: SkitTopicType;
    title: string;
    content: string;
    source?: string;
}

export interface SkitTurn {
    speaker: '22' | '33';
    content: string;
    action: string;
    timestamp: number;
}

export interface SkitConfig {
    maxDuration: number;      // 最大持续时间 (毫秒)
    maxTurns: number;         // 最大轮数
    minTurns: number;         // 最小轮数
    autoStart: boolean;       // 是否自动开始
    topicSource?: SkitTopicType[]; // 允许的话题来源
}

export interface SkitSession {
    id: string;
    startTime: number;
    endTime?: number;
    topic: SkitTopic;
    turns: SkitTurn[];
    isActive: boolean;
    userReaction?: 'like' | 'neutral' | 'skip' | 'laugh';
}

export interface SkitEngineState {
    currentSession: SkitSession | null;
    isRunning: boolean;
    currentTurn: number;
}

// 默认配置
export const DEFAULT_SKIT_CONFIG: SkitConfig = {
    maxDuration: 90 * 1000,    // 90秒
    maxTurns: 8,               // 最多8轮
    minTurns: 4,               // 最少4轮
    autoStart: false,
    topicSource: ['news', 'history', 'holiday', 'tech', 'joke'],
};

// 角色台词风格配置
export const SKIT_PERSONA = {
    '22': {
        // 22娘：逗哏，吐槽，活跃气氛
        openingStyle: '活泼开场，引出话题',
        responseStyle: '接话吐槽，搞笑推进',
        closingStyle: '活泼收尾',
        actionPreference: ['happy', 'curious', 'surprised'],
    },
    '33': {
        // 33娘：捧哏，冷静吐槽，圆场
        openingStyle: '冷静回应，略带吐槽',
        responseStyle: '理性分析，偶尔反杀',
        closingStyle: '冷静总结',
        actionPreference: ['calm', 'thinking', 'neutral'],
    },
};
