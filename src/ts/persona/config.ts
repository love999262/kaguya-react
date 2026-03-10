// 角色发言频率与调度配置

export type ModelId = '22' | '33';

export interface SpeechFrequencyConfig {
    // 主动发言冷却时间 (毫秒)
    cooldownMs: {
        min: number;
        max: number;
        default: number;
    };

    // 用户交互后的静默期
    postInteractionSilenceMs: number;

    // 单次主动对话轮数
    turnsPerSession: {
        min: number;
        max: number;
        default: number;
    };

    // 角色发言倾向
    roleBias: {
        '22': {
            openingChance: number;      // 开场概率
            continuationChance: number; // 接话概率
        };
        '33': {
            openingChance: number;
            continuationChance: number;
        };
    };

    // 话题触发权重
    topicWeights: {
        holiday: number;
        weather: number;
        history: number;
        news: number;
        joke: number;
        idle: number;
    };

    // 是否启用自发对话
    enabled: boolean;
}

// 默认配置
export const DEFAULT_SPEECH_CONFIG: SpeechFrequencyConfig = {
    cooldownMs: {
        min: 3 * 60 * 1000,   // 最少 3 分钟
        max: 8 * 60 * 1000,   // 最多 8 分钟
        default: 5 * 60 * 1000, // 默认 5 分钟
    },
    postInteractionSilenceMs: 30 * 1000, // 用户交互后 30 秒静默
    turnsPerSession: {
        min: 2,
        max: 4,
        default: 3,
    },
    roleBias: {
        '22': {
            openingChance: 0.7,    // 70% 概率开场（22 更活泼）
            continuationChance: 0.5,
        },
        '33': {
            openingChance: 0.3,    // 30% 概率开场
            continuationChance: 0.5,
        },
    },
    topicWeights: {
        holiday: 1.0,      // 节日最高优先级
        weather: 0.8,
        history: 0.6,
        news: 0.5,
        joke: 0.4,
        idle: 0.2,
    },
    enabled: true,
};

// 本地存储键
const SPEECH_CONFIG_KEY = 'kaguya:speech:config';

// 加载配置
export function loadSpeechConfig(): SpeechFrequencyConfig {
    try {
        const saved = localStorage.getItem(SPEECH_CONFIG_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_SPEECH_CONFIG, ...parsed };
        }
    } catch {
        // 忽略解析错误
    }
    return DEFAULT_SPEECH_CONFIG;
}

// 保存配置
export function saveSpeechConfig(config: Partial<SpeechFrequencyConfig>): void {
    try {
        const current = loadSpeechConfig();
        const merged = { ...current, ...config };
        localStorage.setItem(SPEECH_CONFIG_KEY, JSON.stringify(merged));
    } catch {
        // 忽略存储错误
    }
}

// 重置为默认配置
export function resetSpeechConfig(): void {
    try {
        localStorage.removeItem(SPEECH_CONFIG_KEY);
    } catch {
        // 忽略错误
    }
}

// 获取随机冷却时间
export function getRandomCooldown(config: SpeechFrequencyConfig): number {
    const { min, max } = config.cooldownMs;
    return Math.floor(min + Math.random() * (max - min));
}

// 根据配置选择下一个说话角色
export function selectNextSpeaker(
    config: SpeechFrequencyConfig,
    lastSpeaker?: ModelId
): ModelId {
    if (!lastSpeaker) {
        // 开场：根据概率选择
        const random = Math.random();
        return random < config.roleBias['22'].openingChance ? '22' : '33';
    }

    // 接话：默认交替，但可根据配置调整
    const nextSpeaker = lastSpeaker === '22' ? '33' : '22';

    // 检查当前角色是否有继续说话的倾向
    const currentBias = config.roleBias[lastSpeaker].continuationChance;
    if (Math.random() < currentBias - 0.5) {
        // 如果随机值小于倾向差值，同一角色继续
        return lastSpeaker;
    }

    return nextSpeaker;
}

// 角色人设配置
export interface PersonaConfig {
    id: ModelId;
    name: string;
    personality: string;
    speakingStyle: string;
    preferredTopics: string[];
    jokeType: 'warm' | 'cold' | 'witty';
    actionPreference: {
        default: string;
        happy: string[];
        thinking: string[];
    };
}

export const PERSONA_22: PersonaConfig = {
    id: '22',
    name: '22娘',
    personality: '元气活泼、阳光热情、乐观开朗、有点冒失',
    speakingStyle: '充满活力、语气可爱、喜欢用感叹号和表情、直球表达',
    preferredTopics: ['游戏', '动漫', '娱乐', '美食', '日常'],
    jokeType: 'warm',
    actionPreference: {
        default: 'happy',
        happy: ['happy', 'curious', 'surprised'],
        thinking: ['curious', 'thinking'],
    },
};

export const PERSONA_33: PersonaConfig = {
    id: '33',
    name: '33娘',
    personality: '吐槽毒舌、沉稳冷静、理性机智、略带腹黑',
    speakingStyle: '简洁干练、理性客观、冷淡幽默、偶尔吐槽',
    preferredTopics: ['科技', '历史', '政治', '经济', 'AI'],
    jokeType: 'cold',
    actionPreference: {
        default: 'calm',
        happy: ['calm', 'thinking'],
        thinking: ['thinking', 'calm', 'curious'],
    },
};

export const PERSONA_MAP: Record<ModelId, PersonaConfig> = {
    '22': PERSONA_22,
    '33': PERSONA_33,
};
