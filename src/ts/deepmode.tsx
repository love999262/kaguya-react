import * as React from 'react';
import type { InitProgressReport, MLCEngineInterface, AppConfig, ModelRecord } from '@mlc-ai/web-llm';
import { fetchHotNews, filterEntertainmentNews, filterTechNews, type NewsItem } from './newsService';
import { fetchJokeFromAPI } from './jsonpService';
import { SkitEngine } from './skit/engine';
import { getRandomHistoryEvent, formatHistoryForCharacter } from './services/historyToday';
import { formatMemoriesForPrompt } from './services/memoryService';

type TalkTarget = '22' | '33' | 'all';
type LLMState = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';
type MessageRole = 'system' | 'user' | 'assistant22' | 'assistant33';
type Live2DAction = 'neutral' | 'happy' | 'curious' | 'thinking' | 'calm' | 'surprised';

type ChatMessage = {
    id: number;
    role: MessageRole;
    text: string;
};

type CoreMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

type SearchInputEventDetail = {
    value: string;
};

type Live2DBubbleEventDetail = {
    target: TalkTarget;
    text: string;
};

type PersonaReply = {
    text: string;
    action: Live2DAction;
};

type WeatherAdvisoryRiskItem = {
    dateKey: string;
    weatherCode: number;
    weatherText: string;
    min: number;
    max: number;
    tags: string[];
};

type WeatherAdvisoryEventDetail = {
    location: string;
    forecastDays: number;
    badDays: WeatherAdvisoryRiskItem[];
};

type TodayWeatherEventDetail = {
    location: string;
    provider: string;
    today: {
        dateKey: string;
        weatherCode: number;
        weatherText: string;
        min: number;
        max: number;
    };
    forecastDays: number;
};

const MAX_MESSAGES = 18;
const MAX_CONTEXT_MESSAGES = 10;
const QWEN25_MODEL_IDS = [
    'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    'Qwen2.5-7B-Instruct-q4f16_1-MLC',
] as const;
const QWEN3_MODEL_IDS = [
    'Qwen3-0.6B-q4f16_1-MLC',
    'Qwen3-1.7B-q4f16_1-MLC',
    'Qwen3-4B-q4f16_1-MLC',
    'Qwen3-8B-q4f16_1-MLC',
] as const;
const DEFAULT_MODEL_ID = QWEN25_MODEL_IDS[0];
const FALLBACK_MODEL_ID = QWEN25_MODEL_IDS[0]; // 降级到 Qwen2.5-0.5B

const SEARCH_EVAL_DEBOUNCE_MS = 780;
const IDLE_INTERVAL_MS = 18000;
const IDLE_THRESHOLD_MS = 80000;
const LLM_RETRY_COOLDOWN_MS = 12000;
const LLM_STRATEGY_STORAGE_KEY = 'kaguya:webllm:strategy';
const LLM_SOURCE_STORAGE_KEY = 'kaguya:webllm:source';
const LLM_MODEL_PREF_STORAGE_KEY = 'kaguya:webllm:model-pref';
const TODAY_WEATHER_COMMENT_STORAGE_KEY = 'kaguya:today-weather-commented';

type StoragePersistenceState = 'unknown' | 'persisted' | 'granted' | 'denied' | 'unsupported';
type ModelPreference = 'auto' | string;
type PlatformType = 'mac' | 'win' | 'other';
type GpuTier = 'discrete' | 'integrated' | 'unknown';

type DeviceProfile = {
    platform: PlatformType;
    memoryGB: number;
    gpuTier: GpuTier;
    gpuName: string;
};

type LLMLoadStrategy = {
    id: 'cache-api' | 'indexeddb';
    label: string;
    useIndexedDBCache: boolean;
};

type LLMLoadResult = {
    engine: MLCEngineInterface;
    strategy: LLMLoadStrategy;
};

const LLM_LOAD_STRATEGIES: LLMLoadStrategy[] = [
    { id: 'indexeddb', label: 'IndexedDB', useIndexedDBCache: true },
    { id: 'cache-api', label: 'CacheAPI', useIndexedDBCache: false },
];
const PREFERRED_CACHE_STRATEGY_ID: LLMLoadStrategy['id'] = 'indexeddb';

const wait = (ms: number): Promise<void> => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

const buildAppConfigWithStrategy = (
    baseConfig: AppConfig,
    strategy: LLMLoadStrategy,
): AppConfig => {
    // URL 已经在 getWebLLMModule 中通过 CORS 代理转换过了
    return {
        model_list: baseConfig.model_list,
        useIndexedDBCache: strategy.useIndexedDBCache,
    };
};

const getStoredStrategyId = (): LLMLoadStrategy['id'] | null => {
    try {
        const value = window.localStorage.getItem(LLM_STRATEGY_STORAGE_KEY);
        if (value === 'cache-api' || value === 'indexeddb') {
            return value;
        }
    } catch {
        return null;
    }
    return null;
};

const setStoredStrategyId = (id: LLMLoadStrategy['id']): void => {
    try {
        window.localStorage.setItem(LLM_STRATEGY_STORAGE_KEY, id);
    } catch {
        // ignore storage quota / private mode issues
    }
};

const getStoredModelPreference = (): ModelPreference => {
    try {
        const value = window.localStorage.getItem(LLM_MODEL_PREF_STORAGE_KEY);
        if (value === 'auto') {
            return 'auto';
        }
        if (value && value.trim()) {
            return value;
        }
    } catch {
        return 'auto';
    }
    return 'auto';
};

const setStoredModelPreference = (value: ModelPreference): void => {
    try {
        window.localStorage.setItem(LLM_MODEL_PREF_STORAGE_KEY, value);
    } catch {
        // ignore storage quota / private mode issues
    }
};

const getModelDisplayName = (modelId: string): string => {
    if (!modelId) {
        return '';
    }
    return modelId
        .replace(/-MLC$/i, '')
        .replace(/-q[0-9a-z_]+$/i, '')
        .replace(/-Instruct$/i, '');
};

const extractQwenLevelScore = (modelId: string): number => {
    const match = modelId.match(/qwen(?:2\.5|3)?[-_]?([0-9]+(?:\.[0-9]+)?)b/i);
    if (!match) {
        return 0;
    }
    return Number(match[1]) || 0;
};

const getStrongestQwenModel = (modelIds: string[]): string | null => {
    const qwenModels = modelIds.filter((id) => /qwen/i.test(id));
    if (!qwenModels.length) {
        return null;
    }

    const preferredExactOrder = [
        'Qwen3-8B-q4f16_1-MLC',
        'Qwen3-8B-q4f32_1-MLC',
        'Qwen3-4B-q4f16_1-MLC',
        'Qwen3-4B-q4f32_1-MLC',
        'Qwen3-1.7B-q4f16_1-MLC',
        'Qwen3-1.7B-q4f32_1-MLC',
        'Qwen3-0.6B-q4f16_1-MLC',
        'Qwen3-0.6B-q4f32_1-MLC',
        'Qwen3-0.6B-q0f16-MLC',
    ];
    for (let i = 0; i < preferredExactOrder.length; i++) {
        if (qwenModels.includes(preferredExactOrder[i])) {
            return preferredExactOrder[i];
        }
    }

    const sorted = [...qwenModels].sort((a, b) => {
        const scoreA = extractQwenLevelScore(a);
        const scoreB = extractQwenLevelScore(b);
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }
        const isQ4A = /q4f16_1/i.test(a) ? 1 : 0;
        const isQ4B = /q4f16_1/i.test(b) ? 1 : 0;
        if (isQ4A !== isQ4B) {
            return isQ4B - isQ4A;
        }
        return a.localeCompare(b);
    });
    return sorted[0];
};



const getWebLLMFailureHint = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes('cors') || lower.includes('access-control-allow-origin')) {
        return '跨域被拦截：当前模型源不支持浏览器跨域读取。';
    }
    if (lower.includes('timed_out') || lower.includes('timeout') || lower.includes('failed to fetch') || lower.includes('network')) {
        return '网络不可达：当前网络无法稳定访问模型源（huggingface）。';
    }
    if (lower.includes('oom') || lower.includes('out of memory') || lower.includes('device lost')) {
        return '显存/内存不足：请关闭占用高的页面后重试。';
    }
    return '';
};

const buildWeatherSummary = (badDays: WeatherAdvisoryRiskItem[]): string => {
    return badDays.map((item) => {
        const tagsText = item.tags.join('/');
        return `${item.dateKey} ${item.weatherText} ${item.min}~${item.max}° (${tagsText})`;
    }).join('；');
};

const buildLocalWeatherAdvice = (roleTarget: '22' | '33', badDays: WeatherAdvisoryRiskItem[]): string => {
    const tagSet = new Set<string>();
    badDays.forEach((item) => item.tags.forEach((tag) => tagSet.add(tag)));
    const tips: string[] = [];
    if (tagSet.has('rain')) {
        tips.push('带伞并穿防水鞋');
    }
    if (tagSet.has('snow')) {
        tips.push('注意防滑并保暖');
    }
    if (tagSet.has('thunder')) {
        tips.push('远离空旷和高处，尽量减少外出');
    }
    if (tagSet.has('fog')) {
        tips.push('出行放慢速度并开启照明');
    }
    if (tagSet.has('cold')) {
        tips.push('低温时加衣保暖');
    }
    if (tagSet.has('heat')) {
        tips.push('及时补水并避免午后暴晒');
    }
    if (!tips.length) {
        tips.push('关注天气变化，提前安排出行');
    }
    if (roleTarget === '22') {
        return `这波天气有点挑战，但你完全能应对。建议先${tips[0]}，再${tips[1] || '留意天气更新并灵活调整行程'}。`;
    }
    return `风险判断完成：请按优先级执行${tips.slice(0, 2).join('；')}。`;
};

const SYSTEM_PROMPT_22 = '你是哔哩哔哩的22娘，是姐姐。性格：阳光元气、活泼热情、乐观开朗，但有些冒冒失失。说话风格：充满活力、语气可爱，喜欢用感叹号和可爱的表情。每次回复1-2句中文。你对游戏、动漫、娱乐类内容特别感兴趣，会用活泼可爱的语气评论。你偶尔会讲一些冷笑话或有趣的事情来活跃气氛。记住：你是22娘，性格设定要贴近官方人设！';
const SYSTEM_PROMPT_33 = '你是哔哩哔哩的33娘，是机娘妹妹。性格：沉着冷静、沉默寡言、理性机智、略带腹黑。说话风格：简洁干练、理性客观，表情不那么丰富，偶尔会吐槽。每次回复1-2句中文。你对科技、时政、经济类新闻特别关注，会用理性专业的语气分析。你是吐槽担当，当22讲笑话或发表一些天真的想法时，你会用冷淡但幽默的方式吐槽。记住：你是33娘，机娘设定要贴近官方人设！';

const NEWS_COMMENT_PROMPT_22 = '你是22娘，正在看一条娱乐/游戏相关的热点新闻。请用活泼可爱的语气，简短评论这条新闻（1-2句话），要体现22娘的阳光元气性格。输出JSON格式：{"comment":"你的评论","action":"happy/curious/thinking"}';
const NEWS_COMMENT_PROMPT_33 = '你是33娘，正在看一条科技/时政相关的热点新闻。请用理性专业的语气，简短分析这条新闻（1-2句话），要体现33娘的沉着冷静性格。输出JSON格式：{"comment":"你的分析","action":"thinking/calm/curious"}';

const JOKE_PROMPT_22 = '你是22娘，请讲一个简短的、有趣的冷笑话或段子（1-2句话），要体现22娘的阳光可爱性格。输出JSON格式：{"comment":"你的笑话","action":"happy/curious"}';
const TSUKKOMI_PROMPT_33 = '你是33娘，22刚刚说了一个笑话，请用冷淡但幽默的方式吐槽一下（1句话），要体现33娘的冷静吐槽担当性格。直接吐槽笑话内容，不要说你没听到。输出JSON格式：{"comment":"你的吐槽","action":"calm/thinking"}';

const normalizeAction = (value: string): Live2DAction => {
    const text = value.toLowerCase();
    if (text.includes('happy') || text.includes('热情') || text.includes('兴奋') || text.includes('开心')) {
        return 'happy';
    }
    if (text.includes('curious') || text.includes('好奇')) {
        return 'curious';
    }
    if (text.includes('thinking') || text.includes('思考')) {
        return 'thinking';
    }
    if (text.includes('surprised') || text.includes('惊讶')) {
        return 'surprised';
    }
    if (text.includes('calm') || text.includes('冷静') || text.includes('平静')) {
        return 'calm';
    }
    return 'neutral';
};

const extractContent = (content: unknown): string => {
    if (typeof content === 'string') {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content
            .map((item: unknown) => {
                if (typeof item === 'string') {
                    return item;
                }
                if (item && typeof item === 'object' && 'text' in (item as Record<string, unknown>)) {
                    const value = (item as Record<string, unknown>).text;
                    return typeof value === 'string' ? value : '';
                }
                return '';
            })
            .join('')
            .trim();
    }

    return '';
};

const parseJsonPayload = (raw: string): { comment: string; action: Live2DAction } | null => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }

    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first < 0 || last <= first) {
        return null;
    }

    try {
        const parsed = JSON.parse(trimmed.slice(first, last + 1)) as { comment?: unknown; action?: unknown; };
        const comment = typeof parsed.comment === 'string' ? parsed.comment.trim() : '';
        const action = typeof parsed.action === 'string' ? normalizeAction(parsed.action) : 'neutral';
        if (!comment) {
            return null;
        }
        return { comment, action };
    } catch {
        return null;
    }
};

const DeepMode = (): React.JSX.Element => {
    const [panelOpen, setPanelOpen] = React.useState<boolean>(false);
    const [draft, setDraft] = React.useState<string>('');
    const [target, setTarget] = React.useState<TalkTarget>('all');
    const [llmState, setLlmState] = React.useState<LLMState>('idle');
    const [llmProgress, setLlmProgress] = React.useState<string>('未加载');
    const [activeModelId, setActiveModelId] = React.useState<string>('未加载');
    const [activeModelSource, setActiveModelSource] = React.useState<string>('未解析');
    const [modelPreference, setModelPreference] = React.useState<ModelPreference>(getStoredModelPreference);
    const [recommendedModelId, setRecommendedModelId] = React.useState<string>(DEFAULT_MODEL_ID);
    const [allModelIds, setAllModelIds] = React.useState<string[]>([]);
    const [cachedModelIds, setCachedModelIds] = React.useState<string[]>([]);
    const [deviceHint, setDeviceHint] = React.useState<string>('待检测');
    const [isResponding, setIsResponding] = React.useState<boolean>(false);
    // 当前活跃的模式（防止模式间互相插入）
    const [activeMode, setActiveMode] = React.useState<'none' | 'skit' | 'history' | 'news' | 'chat' | 'weather'>('none');
    const [storagePersistence, setStoragePersistence] = React.useState<StoragePersistenceState>('unknown');
    const [messages, setMessages] = React.useState<ChatMessage[]>([
        { id: 1, role: 'system', text: '深度交互已就绪：纯文字对话 + 22/33分角色回复。' },
    ]);
    // 纯净模式状态
    const [pureMode, setPureMode] = React.useState<boolean>(false);
    // 抽屉动画状态
    const [drawerVisible, setDrawerVisible] = React.useState<boolean>(false);
    // 缓存管理面板状态
    const [showCacheManager, setShowCacheManager] = React.useState<boolean>(false);
    const [isClearingCache, setIsClearingCache] = React.useState<boolean>(false);
    // 缓存选择状态
    const [selectedModelCaches, setSelectedModelCaches] = React.useState<Set<string>>(new Set());
    const [selectedOtherCaches, setSelectedOtherCaches] = React.useState<Set<string>>(new Set());
    const [selectAllModels, setSelectAllModels] = React.useState<boolean>(false);
    const [selectAllOthers, setSelectAllOthers] = React.useState<boolean>(false);
    // 引擎恢复状态
    const [isResumingEngine, setIsResumingEngine] = React.useState<boolean>(false);
    const [resumeProgress, setResumeProgress] = React.useState<number>(0);

    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const nextIdRef = React.useRef<number>(2);
    const openedHintRef = React.useRef<boolean>(false);
    const activeEngineRef = React.useRef<MLCEngineInterface | null>(null);
    const webllmModuleRef = React.useRef<any | null>(null);
    const loadingPromiseRef = React.useRef<Promise<MLCEngineInterface | null> | null>(null);
    const loadingModelIdRef = React.useRef<string | null>(null);
    const availableModelSetRef = React.useRef<Set<string>>(new Set());
    const modelRecordMapRef = React.useRef<Map<string, ModelRecord>>(new Map());
    const autoProfileReadyRef = React.useRef<boolean>(false);
    const searchDebounceRef = React.useRef<number | null>(null);
    const lastSearchKeywordRef = React.useRef<string>('');
    const lastInteractionAtRef = React.useRef<number>(Date.now());
    const idleRunningRef = React.useRef<boolean>(false);
    const lastLoadFailedAtRef = React.useRef<number>(0);
    const lastWeatherAdvisorySignatureRef = React.useRef<string>('');
    const lastTodayWeatherSignatureRef = React.useRef<string>('');
    const storageCheckedRef = React.useRef<boolean>(false);
    const newsCacheRef = React.useRef<NewsItem[]>([]);
    const lastNewsFetchRef = React.useRef<number>(0);
    const newsCommentRunningRef = React.useRef<boolean>(false);
    const skitEngineRef = React.useRef<SkitEngine | null>(null);
    const activeModeRef = React.useRef<'none' | 'skit' | 'history' | 'news' | 'chat' | 'weather'>('none');

    // 同步activeMode到ref，供定时器使用
    React.useEffect(() => {
        activeModeRef.current = activeMode;
    }, [activeMode]);

    const historyRef = React.useRef<Record<'22' | '33', CoreMessage[]>>({
        '22': [{ role: 'system', content: SYSTEM_PROMPT_22 }],
        '33': [{ role: 'system', content: SYSTEM_PROMPT_33 }],
    });

    // 初始化小剧场引擎
    React.useEffect(() => {
        if (!skitEngineRef.current) {
            skitEngineRef.current = new SkitEngine();
            skitEngineRef.current.onTurn((turn) => {
                emitAction(turn.speaker, turn.action as Live2DAction);
                emitBubble(turn.speaker, turn.content);
                const roleLabel = turn.speaker === '22' ? 'assistant22' : 'assistant33';
                pushMessage(roleLabel, `${turn.speaker}（小剧场）：${turn.content}`);
            });
        }
        return () => {
            if (skitEngineRef.current) {
                skitEngineRef.current.stop();
            }
        };
    }, []);

    const markInteraction = React.useCallback(() => {
        lastInteractionAtRef.current = Date.now();
    }, []);

    const emitAction = React.useCallback((actionTarget: TalkTarget, action: Live2DAction) => {
        window.dispatchEvent(new CustomEvent('kaguya:live2d-action', {
            detail: {
                target: actionTarget,
                action,
            },
        }));
    }, []);

    const emitBubble = React.useCallback((bubbleTarget: TalkTarget, text: string) => {
        const content = text.trim();
        if (!content) {
            return;
        }
        window.dispatchEvent(new CustomEvent<Live2DBubbleEventDetail>('kaguya:live2d-bubble', {
            detail: {
                target: bubbleTarget,
                text: content,
            },
        }));
    }, []);

    const pushMessage = React.useCallback((role: MessageRole, text: string, metadata?: { type?: string; action?: string }) => {
        setMessages((prev: ChatMessage[]) => {
            const next = [...prev, { id: nextIdRef.current, role, text }];
            nextIdRef.current += 1;
            return next.slice(-MAX_MESSAGES);
        });

        // 同时保存到IndexedDB
        void (async () => {
            try {
                const { addDialogueMessage } = await import('./services/memoryService');
                await addDialogueMessage(role, text, metadata);
            } catch {
                // 静默处理存储错误，不影响对话功能
            }
        })();
    }, []);

    const ensurePersistentStorage = React.useCallback(async (): Promise<StoragePersistenceState> => {
        const storageManager = navigator.storage;
        if (!storageManager || typeof storageManager.persisted !== 'function' || typeof storageManager.persist !== 'function') {
            setStoragePersistence('unsupported');
            return 'unsupported';
        }

        try {
            const alreadyPersisted = await storageManager.persisted();
            if (alreadyPersisted) {
                setStoragePersistence('persisted');
                return 'persisted';
            }

            const granted = await storageManager.persist();
            if (granted) {
                setStoragePersistence('granted');
                pushMessage('system', '已启用浏览器持久化存储，模型缓存更不容易被系统回收。');
                return 'granted';
            }

            setStoragePersistence('denied');
            pushMessage('system', '浏览器未授予持久化存储权限，模型缓存可能在系统清理时被回收。');
            return 'denied';
        } catch {
            setStoragePersistence('denied');
            return 'denied';
        }
    }, [pushMessage]);

    const getWebLLMModule = React.useCallback(async () => {
        if (webllmModuleRef.current) {
            return webllmModuleRef.current;
        }
        const webllm = await import('@mlc-ai/web-llm');
        // 只保留 Qwen 系列模型，使用原生 URL
        if (webllm.prebuiltAppConfig?.model_list) {
            webllm.prebuiltAppConfig.model_list = webllm.prebuiltAppConfig.model_list.filter((item: ModelRecord) =>
                item.model_id && (item.model_id.includes('Qwen2.5') || item.model_id.includes('Qwen3'))
            );
        }
        webllmModuleRef.current = webllm;
        return webllm;
    }, []);

    const getStrategyOrder = React.useCallback((): LLMLoadStrategy[] => {
        const storedStrategyId = getStoredStrategyId();
        const score = (id: LLMLoadStrategy['id']): number => {
            if (id === PREFERRED_CACHE_STRATEGY_ID) {
                return 0;
            }
            if (id === storedStrategyId) {
                return 1;
            }
            return 2;
        };
        return [...LLM_LOAD_STRATEGIES].sort((a, b) => score(a.id) - score(b.id));
    }, []);

    const loadModelWithStrategies = React.useCallback(async (
        webllm: any,
        modelId: string,
        stageLabel: string,
        silentProgress: boolean = false,
        externalProgressCallback?: (progress: number, text: string) => void,
    ): Promise<{ result: LLMLoadResult | null; lastErrorText: string; }> => {
        const strategyOrder = getStrategyOrder();
        let lastErrorText = '';

        for (let strategyIndex = 0; strategyIndex < strategyOrder.length; strategyIndex++) {
            const strategy = strategyOrder[strategyIndex];
            const appConfig = buildAppConfigWithStrategy(webllm.prebuiltAppConfig, strategy);
            const hasCachedModel = await webllm.hasModelInCache(modelId, appConfig).catch(() => false);
            if (hasCachedModel && !silentProgress) {
                setLlmProgress(`${stageLabel}命中本地缓存(${strategy.label})，正在恢复...`);
            }

            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const engine = await webllm.CreateMLCEngine(modelId, {
                        appConfig,
                        initProgressCallback: (report: InitProgressReport) => {
                            if (silentProgress) {
                                return;
                            }
                            const percent = Math.max(0, Math.min(100, Math.round(report.progress * 100)));
                            setLlmProgress(`${stageLabel}${percent}% ${report.text}`);
                            // 调用外部进度回调（如果有）
                            if (externalProgressCallback) {
                                externalProgressCallback(percent, report.text);
                            }
                        },
                    });
                    setStoredStrategyId(strategy.id);
                    return {
                        result: {
                            engine,
                            strategy,
                        },
                        lastErrorText,
                    };
                } catch (error) {
                    lastErrorText = error instanceof Error ? error.message : String(error);
                    const canCleanupAndRetry = attempt === 1 && hasCachedModel;
                    if (canCleanupAndRetry) {
                        if (!silentProgress) {
                            setLlmProgress(`${stageLabel}检测到缓存异常，清理后重试(${strategy.label})...`);
                        }
                        await webllm.deleteModelAllInfoInCache(modelId, appConfig).catch((): void => {});
                        await wait(220);
                        continue;
                    }
                    break;
                }
            }
        }

        return { result: null, lastErrorText };
    }, [getStrategyOrder]);

    const ensureModelCatalog = React.useCallback(async (): Promise<Set<string>> => {
        if (availableModelSetRef.current.size > 0) {
            return availableModelSetRef.current;
        }
        const webllm = await getWebLLMModule();
        const modelIds = webllm.prebuiltAppConfig.model_list
            .map((item: ModelRecord) => item.model_id)
            .filter((id: string) => Boolean(id));
        const modelSet = new Set<string>(modelIds);
        modelRecordMapRef.current = new Map(
            webllm.prebuiltAppConfig.model_list.map((item: ModelRecord) => [item.model_id, item]),
        );
        const qwenModels = modelIds.filter((id: string) => /qwen/i.test(id));
        const sorted = [
            ...qwenModels.sort((a: string, b: string) => a.localeCompare(b)),
            ...modelIds.filter((id: string) => !/qwen/i.test(id)).sort((a: string, b: string) => a.localeCompare(b)),
        ];
        setAllModelIds(sorted);
        availableModelSetRef.current = modelSet;
        return modelSet;
    }, [getWebLLMModule]);

    const refreshCachedModelIds = React.useCallback(async (): Promise<void> => {
        const modelSet = await ensureModelCatalog();
        const modelIds = Array.from(modelSet);
        if (!modelIds.length) {
            setCachedModelIds([]);
            return;
        }
        const webllm = await getWebLLMModule();
        const strategyOrder = getStrategyOrder();
        const cached: string[] = [];
        for (let i = 0; i < modelIds.length; i++) {
            const modelId = modelIds[i];
            let hasCache = false;
            for (let j = 0; j < strategyOrder.length; j++) {
                const appConfig = buildAppConfigWithStrategy(webllm.prebuiltAppConfig, strategyOrder[j]);
                hasCache = await webllm.hasModelInCache(modelId, appConfig).catch(() => false);
                if (hasCache) {
                    break;
                }
            }
            if (hasCache) {
                cached.push(modelId);
            }
        }
        setCachedModelIds(cached);
    }, [ensureModelCatalog, getStrategyOrder, getWebLLMModule]);

    const detectRecommendedModel = React.useCallback(async (): Promise<string> => {
        const modelSet = await ensureModelCatalog();
        const modelIds = Array.from(modelSet);
        const strongestQwen = getStrongestQwenModel(modelIds);
        if (!strongestQwen) {
            const firstModel = modelIds[0] || DEFAULT_MODEL_ID;
            setRecommendedModelId(firstModel);
            autoProfileReadyRef.current = true;
            return firstModel;
        }
        const platformText = (
            ((navigator as any).userAgentData?.platform as string | undefined)
            || navigator.platform
            || navigator.userAgent
            || ''
        ).toLowerCase();
        const platform: PlatformType = platformText.includes('mac')
            ? 'mac'
            : (platformText.includes('win') ? 'win' : 'other');
        const memoryRaw = Number((navigator as any).deviceMemory);
        const memoryGB = Number.isFinite(memoryRaw) && memoryRaw > 0
            ? memoryRaw
            : (platform === 'mac' ? 16 : 8);

        let gpuName = 'unknown';
        let gpuTier: GpuTier = 'unknown';
        try {
            const navGpu = (navigator as Navigator & {
                gpu?: { requestAdapter?: () => Promise<any>; };
            }).gpu;
            if (navGpu && typeof navGpu.requestAdapter === 'function') {
                const adapter = await navGpu.requestAdapter();
                const info = adapter && 'info' in adapter ? (adapter as any).info : undefined;
                const nameParts = [
                    typeof info?.vendor === 'string' ? info.vendor : '',
                    typeof info?.architecture === 'string' ? info.architecture : '',
                    typeof info?.description === 'string' ? info.description : '',
                ].filter(Boolean);
                gpuName = nameParts.join(' ').trim() || 'unknown';
                const lower = gpuName.toLowerCase();
                if (/nvidia|geforce|rtx|gtx|amd|radeon/.test(lower)) {
                    gpuTier = 'discrete';
                } else if (/intel|iris|uhd|xe|apple|m1|m2|m3|m4/.test(lower)) {
                    gpuTier = 'integrated';
                }
            }
        } catch {
            gpuName = 'unknown';
        }

        if (platform === 'mac' && gpuTier === 'unknown') {
            gpuTier = 'integrated';
        }

        const profile: DeviceProfile = { platform, memoryGB, gpuTier, gpuName };
        const pick = (ids: string[]): string => {
            for (let i = 0; i < ids.length; i++) {
                if (modelSet.has(ids[i])) {
                    return ids[i];
                }
            }
            if (modelSet.has(strongestQwen)) {
                return strongestQwen;
            }
            for (let i = 0; i < QWEN3_MODEL_IDS.length; i++) {
                if (modelSet.has(QWEN3_MODEL_IDS[i])) {
                    return QWEN3_MODEL_IDS[i];
                }
            }
            return modelIds[0] || DEFAULT_MODEL_ID;
        };

        let recommended: string;
        if (profile.platform === 'mac') {
            if (profile.memoryGB >= 32) {
                recommended = pick(['Qwen3-8B-q4f16_1-MLC', 'Qwen3-8B-q4f32_1-MLC', 'Qwen3-4B-q4f16_1-MLC', 'Qwen3-1.7B-q4f16_1-MLC']);
            } else if (profile.memoryGB >= 24) {
                recommended = pick(['Qwen3-4B-q4f16_1-MLC', 'Qwen3-4B-q4f32_1-MLC', 'Qwen3-1.7B-q4f16_1-MLC', 'Qwen3-0.6B-q4f16_1-MLC']);
            } else if (profile.memoryGB >= 16) {
                recommended = pick(['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3-0.6B-q4f16_1-MLC']);
            } else {
                recommended = pick(['Qwen3-0.6B-q4f16_1-MLC']);
            }
        } else if (profile.platform === 'win' && profile.gpuTier === 'discrete') {
            if (profile.memoryGB >= 24) {
                recommended = pick(['Qwen3-8B-q4f16_1-MLC', 'Qwen3-4B-q4f16_1-MLC', 'Qwen3-1.7B-q4f16_1-MLC']);
            } else if (profile.memoryGB >= 12) {
                recommended = pick(['Qwen3-4B-q4f16_1-MLC', 'Qwen3-1.7B-q4f16_1-MLC', 'Qwen3-0.6B-q4f16_1-MLC']);
            } else if (profile.memoryGB >= 8) {
                recommended = pick(['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3-0.6B-q4f16_1-MLC']);
            } else {
                recommended = pick(['Qwen3-0.6B-q4f16_1-MLC']);
            }
        } else if (profile.memoryGB >= 16) {
            recommended = pick(['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3-0.6B-q4f16_1-MLC']);
        } else {
            recommended = pick(['Qwen3-0.6B-q4f16_1-MLC']);
        }

        const tierText = profile.gpuTier === 'discrete' ? '独显' : (profile.gpuTier === 'integrated' ? '集显' : '未知显卡');
        const platformLabel = profile.platform === 'mac' ? 'macOS' : (profile.platform === 'win' ? 'Windows' : 'Other');
        setDeviceHint(`${platformLabel} / ${tierText} / ${profile.memoryGB}GB`);
        setRecommendedModelId(recommended);
        autoProfileReadyRef.current = true;
        return recommended;
    }, [ensureModelCatalog]);

    const resolveTargetModel = React.useCallback((pref: ModelPreference, autoModel: string, availableModelSet: Set<string>): string => {
        if (pref === 'auto') {
            return autoModel;
        }
        if (pref && availableModelSet.has(pref)) {
            return pref;
        }
        return autoModel;
    }, []);

    const getDowngradedModel = React.useCallback((modelId: string, availableModelSet: Set<string>): string | null => {
        // 降级到固定的 Qwen2.5-0.5B 模型
        if (availableModelSet.has(FALLBACK_MODEL_ID)) {
            return FALLBACK_MODEL_ID;
        }
        return null;
    }, []);

    const ensureLLMEngine = React.useCallback(async (
        requestedModel?: string,
        progressCallback?: (progress: number, text: string) => void
    ): Promise<MLCEngineInterface | null> => {
        if (!('gpu' in navigator)) {
            setLlmState('unsupported');
            setLlmProgress('浏览器不支持 WebGPU');
            pushMessage('system', '当前浏览器不支持 WebGPU，WebLLM 无法运行。');
            return null;
        }

        if (llmState === 'error' && (Date.now() - lastLoadFailedAtRef.current < LLM_RETRY_COOLDOWN_MS)) {
            return null;
        }

        const availableModelSet = await ensureModelCatalog();
        const autoModel = autoProfileReadyRef.current ? recommendedModelId : await detectRecommendedModel();
        const targetModel = requestedModel || resolveTargetModel(modelPreference, autoModel, availableModelSet);

        if (activeEngineRef.current && activeModelId === targetModel) {
            return activeEngineRef.current;
        }

        if (loadingPromiseRef.current) {
            if (loadingModelIdRef.current === targetModel) {
                return loadingPromiseRef.current;
            }
            return null;
        }

        loadingModelIdRef.current = targetModel;
        loadingPromiseRef.current = (async () => {
            try {
                setLlmState('loading');
                setLlmProgress(`正在加载 ${getModelDisplayName(targetModel)}...`);

                const webllm = await getWebLLMModule();
                const modelRecord = modelRecordMapRef.current.get(targetModel);
                // URL 已经通过 CORS 代理转换
                if (modelRecord?.model) {
                    setActiveModelSource(modelRecord.model);
                }
                if (!availableModelSet.has(targetModel)) {
                    if (modelPreference !== 'auto' && availableModelSet.has(autoModel)) {
                        setModelPreference('auto');
                        setStoredModelPreference('auto');
                        pushMessage('system', `手动模型 ${targetModel} 不可用，已自动切回推荐模型 ${autoModel}。`);
                        loadingModelIdRef.current = autoModel;
                        const retry = await loadModelWithStrategies(webllm, autoModel, `${getModelDisplayName(autoModel)} 加载：`, false, progressCallback);
                        if (retry.result) {
                            activeEngineRef.current = retry.result.engine;
                            setActiveModelId(autoModel);
                            setLlmState('ready');
                            setLlmProgress(`${getModelDisplayName(autoModel)} 已就绪（${retry.result.strategy.label}）`);
                            lastLoadFailedAtRef.current = 0;
                            return retry.result.engine;
                        }
                        setLlmState('error');
                        setLlmProgress('加载失败，可稍后自动重试');
                        lastLoadFailedAtRef.current = Date.now();
                        return null;
                    }
                    setLlmState('error');
                    setLlmProgress('目标模型不可用');
                    pushMessage('system', `当前 WebLLM 版本未内置 ${targetModel}。`);
                    return null;
                }

                if (activeEngineRef.current) {
                    void activeEngineRef.current.unload();
                    activeEngineRef.current = null;
                }

                let finalModelId = targetModel;
                let loadResult = await loadModelWithStrategies(webllm, targetModel, `${getModelDisplayName(targetModel)} 加载：`, false, progressCallback);
                if (!loadResult.result) {
                    const downgraded = getDowngradedModel(targetModel, availableModelSet);
                    if (downgraded) {
                        setLlmProgress(`${getModelDisplayName(targetModel)} 加载失败，降级到 ${getModelDisplayName(downgraded)}...`);
                        const downgradeResult = await loadModelWithStrategies(webllm, downgraded, `${getModelDisplayName(downgraded)} 加载：`, false, progressCallback);
                        if (downgradeResult.result) {
                            finalModelId = downgraded;
                            loadResult = downgradeResult;
                            setModelPreference(downgraded);
                            setStoredModelPreference(downgraded);
                            pushMessage('system', `模型已自动降级并持久化：${getModelDisplayName(targetModel)} -> ${getModelDisplayName(downgraded)}。`);
                        }
                    }
                }

                if (!loadResult.result) {
                    setLlmState('error');
                    setLlmProgress('加载失败，可稍后自动重试');
                    lastLoadFailedAtRef.current = Date.now();
                    const hint = getWebLLMFailureHint(loadResult.lastErrorText);
                    pushMessage(
                        'system',
                        `模型加载失败，已回退本地规则回复。${loadResult.lastErrorText ? `（${loadResult.lastErrorText.slice(0, 90)}）` : ''}${hint ? ` ${hint}` : ''}`,
                    );
                    return null;
                }

                activeEngineRef.current = loadResult.result.engine;
                setActiveModelId(finalModelId);
                setCachedModelIds((prev) => (prev.includes(finalModelId) ? prev : [...prev, finalModelId]));
                setLlmState('ready');
                setLlmProgress(`${getModelDisplayName(finalModelId)} 已就绪（${loadResult.result.strategy.label}）`);
                lastLoadFailedAtRef.current = 0;
                pushMessage('system', `模型已就绪：${finalModelId}（${loadResult.result.strategy.label}）。`);
                return loadResult.result.engine;
            } catch (error) {
                const errorText = error instanceof Error ? error.message : String(error);
                setLlmState('error');
                setLlmProgress('加载失败，可稍后重试');
                lastLoadFailedAtRef.current = Date.now();
                const hint = getWebLLMFailureHint(errorText);
                pushMessage(
                    'system',
                    `WebLLM 加载失败，已自动回退到本地规则回复。${errorText ? `（${errorText.slice(0, 70)}）` : ''}${hint ? ` ${hint}` : ''}`,
                );
                return null;
            } finally {
                loadingPromiseRef.current = null;
                loadingModelIdRef.current = null;
            }
        })();

        return loadingPromiseRef.current;
    }, [
        activeModelId,
        detectRecommendedModel,
        ensureModelCatalog,
        getDowngradedModel,
        getWebLLMModule,
        llmState,
        loadModelWithStrategies,
        modelPreference,
        pushMessage,
        recommendedModelId,
        resolveTargetModel,
    ]);

    const requestPersonaJson = React.useCallback(async (
        roleTarget: '22' | '33',
        prompt: string,
        fallbackComment: string,
        fallbackAction: Live2DAction,
    ): Promise<PersonaReply> => {
        const primaryEngine = await ensureLLMEngine();
        const system = roleTarget === '22'
            ? `${SYSTEM_PROMPT_22} 你需要输出 JSON。`
            : `${SYSTEM_PROMPT_33} 你需要输出 JSON。`;

        const tryGenerate = async (engine: MLCEngineInterface | null): Promise<PersonaReply | null> => {
            if (!engine) {
                return null;
            }
            try {
                const result: any = await engine.chat.completions.create({
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: 180,
                });

                const raw = extractContent(result?.choices?.[0]?.message?.content);
                const parsed = parseJsonPayload(raw);
                if (!parsed) {
                    return null;
                }

                return { text: parsed.comment, action: parsed.action };
            } catch {
                return null;
            }
        };

        const primaryReply = await tryGenerate(primaryEngine);
        if (primaryReply) {
            return primaryReply;
        }

        return { text: fallbackComment, action: fallbackAction };
    }, [ensureLLMEngine]);

    const askModel = React.useCallback(async (roleTarget: '22' | '33', userText: string): Promise<PersonaReply> => {
        const primaryEngine = await ensureLLMEngine();
        const history = historyRef.current[roleTarget];
        const roleGuidance = roleTarget === '22'
            ? '请先给情绪价值，再给一个最小可执行建议，语气元气。'
            : '请先给客观判断，再给一个可执行建议并可提示风险，语气冷静。';
        history.push({ role: 'user', content: `${roleGuidance}\n用户问题：${userText}` });

        if (history.length > MAX_CONTEXT_MESSAGES + 1) {
            history.splice(1, history.length - (MAX_CONTEXT_MESSAGES + 1));
        }

        if (!primaryEngine) {
            const fallbackText = roleTarget === '22'
                ? `这件事别慌，我和你站一边。先从"${userText}"里最容易的一步开始就好。`
                : `先客观看待"${userText}"。先确认目标与约束，再执行第一步。`;
            const fallbackAction = roleTarget === '22' ? 'happy' : 'thinking';
            history.push({ role: 'assistant', content: fallbackText });
            return { text: fallbackText, action: fallbackAction };
        }

        const tryAsk = async (engine: MLCEngineInterface | null): Promise<PersonaReply | null> => {
            if (!engine) {
                return null;
            }
            try {
                const response: any = await engine.chat.completions.create({
                    messages: history,
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: 160,
                });

                const content = extractContent(response?.choices?.[0]?.message?.content);
                const text = content || (roleTarget === '22' ? `这个话题我很感兴趣：${userText}` : `收到：${userText}`);
                history.push({ role: 'assistant', content: text });

                const action = roleTarget === '22'
                    ? (text.length > 18 ? 'curious' : 'happy')
                    : (text.includes('？') ? 'thinking' : 'calm');
                return { text, action };
            } catch {
                return null;
            }
        };

        const primaryReply = await tryAsk(primaryEngine);
        if (primaryReply) {
            return primaryReply;
        }

        const fallbackText = roleTarget === '22'
            ? `别有压力，这题可以拆开做。先把"${userText}"里最关键的一项处理掉。`
            : `结论先给你：这件事可以推进。建议先明确优先级，再按顺序执行。`;
        history.push({ role: 'assistant', content: fallbackText });
        return {
            text: fallbackText,
            action: roleTarget === '22' ? 'curious' : 'thinking',
        };
    }, [ensureLLMEngine]);

    const handleSearchFeedback = React.useCallback(async (keyword: string) => {
        if (!keyword || keyword.length < 2) {
            return;
        }

        // 检查是否有其他模式在进行中
        if (activeMode !== 'none' && activeMode !== 'chat') {
            return;
        }

        markInteraction();

        const [reply22, reply33] = await Promise.all([
            requestPersonaJson(
                '22',
                `用户正在输入搜索词：${keyword}。请输出1到2句：先给情绪鼓励，再给一个检索建议，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                `这个词很有潜力，放心冲。建议先搜"${keyword} 教程/实测"快速建立判断。`,
                'curious',
            ),
            requestPersonaJson(
                '33',
                `用户正在输入搜索词：${keyword}。请输出1到2句：先给客观判断，再给一个检索策略，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                `先明确"${keyword}"是资讯、教程还是购买，再按维度筛选结果。`,
                'thinking',
            ),
        ]);

        pushMessage('assistant22', `22（搜索）：${reply22.text}`);
        pushMessage('assistant33', `33（搜索）：${reply33.text}`);
        emitAction('22', reply22.action);
        emitAction('33', reply33.action);
        emitBubble('22', reply22.text);
        emitBubble('33', reply33.text);
    }, [activeMode, emitAction, emitBubble, markInteraction, pushMessage, requestPersonaJson]);

    // 处理搜索提交后的AI评论（结合搜索记忆）
    const handleSearchSubmit = React.useCallback(async (keyword: string, searchEngine: string) => {
        if (!keyword || keyword.length < 2) {
            return;
        }

        // 检查是否有其他模式在进行中
        if (activeMode !== 'none' && activeMode !== 'chat') {
            return;
        }

        markInteraction();

        // 获取相关记忆
        const { getRelevantMemories } = await import('./services/memoryService');
        const relevantMemories = await getRelevantMemories(keyword, 3);
        const memoryContext = relevantMemories.length > 0
            ? `根据我对用户的了解：${relevantMemories.map(m => m.content).join('；')}`
            : '';

        const [reply22, reply33] = await Promise.all([
            requestPersonaJson(
                '22',
                `用户刚刚在${searchEngine}搜索了"${keyword}"。${memoryContext}

请用22娘活泼关心的语气评论一下用户的这次搜索：
1) 如果记忆中有相关信息，可以自然地提及，让用户感到被关心
2) 给一些温暖的鼓励或实用的小建议
3) 控制在1-2句话
4) 输出JSON格式：{"comment":"内容","action":"happy|curious|thinking|calm|surprised"}`,
                `搜索"${keyword}"啦！需要我帮忙整理信息吗？`,
                'curious',
            ),
            requestPersonaJson(
                '33',
                `用户刚刚在${searchEngine}搜索了"${keyword}"。${memoryContext}

请用33娘冷静客观的语气评论一下用户的这次搜索：
1) 如果记忆中有相关信息，可以引用展现观察力
2) 给出实用的建议或提醒
3) 控制在1-2句话
4) 输出JSON格式：{"comment":"内容","action":"happy|curious|thinking|calm|surprised"}`,
                `正在搜索"${keyword}"，需要我帮你筛选信息来源吗？`,
                'thinking',
            ),
        ]);

        pushMessage('assistant22', `22（搜索）：${reply22.text}`);
        pushMessage('assistant33', `33（搜索）：${reply33.text}`);
        emitAction('22', reply22.action);
        emitAction('33', reply33.action);
        emitBubble('22', reply22.text);
        emitBubble('33', reply33.text);
    }, [activeMode, emitAction, emitBubble, markInteraction, pushMessage, requestPersonaJson]);

    const handleWeatherAdvisory = React.useCallback(async (detail: WeatherAdvisoryEventDetail) => {
        if (!detail || !Array.isArray(detail.badDays) || detail.badDays.length === 0) {
            return;
        }

        const signature = detail.badDays.map((item) => `${item.dateKey}:${item.tags.join(',')}`).join('|');
        if (!signature || signature === lastWeatherAdvisorySignatureRef.current) {
            return;
        }
        lastWeatherAdvisorySignatureRef.current = signature;

        const summary = buildWeatherSummary(detail.badDays);
        const fallback22 = buildLocalWeatherAdvice('22', detail.badDays);
        const fallback33 = buildLocalWeatherAdvice('33', detail.badDays);

        const [reply22, reply33] = await Promise.all([
            requestPersonaJson(
                '22',
                `地点：${detail.location}。未来三天风险天气：${summary}。请输出1到2句：先给情绪支持，再给可执行建议，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                fallback22,
                'curious',
            ),
            requestPersonaJson(
                '33',
                `地点：${detail.location}。未来三天风险天气：${summary}。请输出1到2句：先做客观判断，再给可执行策略（可含风险提醒），并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                fallback33,
                'thinking',
            ),
        ]);

        pushMessage('assistant22', `22（天气提醒）：${reply22.text}`);
        pushMessage('assistant33', `33（天气提醒）：${reply33.text}`);
        emitAction('22', reply22.action);
        emitAction('33', reply33.action);
        emitBubble('22', reply22.text);
        emitBubble('33', reply33.text);

        const payload = {
            type: 'kaguya:weather-advice',
            timestamp: new Date().toISOString(),
            location: detail.location,
            forecastDays: detail.forecastDays,
            risks: detail.badDays,
            advises: {
                '22': reply22.text,
                '33': reply33.text,
            },
        };
        window.postMessage(payload, '*');
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, '*');
        }
    }, [emitAction, emitBubble, pushMessage, requestPersonaJson]);

    const handleTodayWeather = React.useCallback(async (detail: TodayWeatherEventDetail) => {
        if (!detail || !detail.today || !detail.today.dateKey) {
            return;
        }

        // 检查是否有其他模式在进行中
        if (activeMode !== 'none' && activeMode !== 'chat') {
            return;
        }

        const signature = `${detail.today.dateKey}:${detail.today.weatherCode}:${detail.location}`;
        if (signature === lastTodayWeatherSignatureRef.current) {
            return;
        }

        try {
            const lastCommentedDate = window.sessionStorage.getItem(TODAY_WEATHER_COMMENT_STORAGE_KEY);
            if (lastCommentedDate === detail.today.dateKey) {
                return;
            }
        } catch {
            // ignore session storage failures
        }

        setActiveMode('weather');
        lastTodayWeatherSignatureRef.current = signature;
        const summary = `${detail.today.dateKey} ${detail.today.weatherText} ${detail.today.min}~${detail.today.max}°`;
        
        // 获取角色记忆
        const memory22 = await formatMemoriesForPrompt('22');
        const memory33 = await formatMemoriesForPrompt('33');

        try {
            const dialogueHistory: string[] = [];

            // 第1轮：22 开场，活泼地介绍天气
            const round1_22 = await requestPersonaJson(
                '22',
                `今天${detail.location}的天气是${detail.today.weatherText}，温度${detail.today.min}~${detail.today.max}度。${memory22}

请用22娘活泼可爱的语气开场介绍天气，给用户情绪鼓励。要求：1)热情打招呼；2)介绍天气情况；3)给出穿衣建议；4)控制在2-3句话；5)输出JSON格式：{"comment":"内容","action":"happy"}`,
                `早上好呀！今天${detail.location}${detail.today.weatherText}，温度${detail.today.min}到${detail.today.max}度，记得穿合适的衣服出门哦！`,
                'happy',
            );
            dialogueHistory.push(`22: ${round1_22.text}`);
            emitAction('22', round1_22.action);
            emitBubble('22', round1_22.text);
            pushMessage('assistant22', `22（天气）：${round1_22.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第2轮：33 补充，客观分析
            const round2_33 = await requestPersonaJson(
                '33',
                `对话历史：${dialogueHistory.join('\n')}\n\n今天${detail.location}天气${detail.today.weatherText}，温度${detail.today.min}~${detail.today.max}度。${memory33}

请用33娘冷静客观的方式补充天气分析。要求：1)给出客观判断；2)补充实用建议（如是否需要带伞、防晒等）；3)控制在1-2句话；4)输出JSON格式：{"comment":"分析","action":"thinking"}`,
                `客观来看，今天${detail.today.weatherText}，建议根据${detail.today.min}到${detail.today.max}度的温差调整衣物，必要时带伞。`,
                'thinking',
            );
            dialogueHistory.push(`33: ${round2_33.text}`);
            emitAction('33', round2_33.action);
            emitBubble('33', round2_33.text);
            pushMessage('assistant33', `33（天气）：${round2_33.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第3轮：22 关心用户，询问计划
            const round3_22 = await requestPersonaJson(
                '22',
                `对话历史：${dialogueHistory.join('\n')}\n\n${memory22}

22想关心用户今天的计划。要求：1)用关心的语气询问用户今天有什么安排；2)根据天气给出贴心建议；3)控制在1-2句话；4)输出JSON格式：{"comment":"关心","action":"curious"}`,
                `你今天有什么计划呀？这样的天气很适合出去走走呢，但要注意保暖哦！`,
                'curious',
            );
            dialogueHistory.push(`22: ${round3_22.text}`);
            emitAction('22', round3_22.action);
            emitBubble('22', round3_22.text);
            pushMessage('assistant22', `22（天气）：${round3_22.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第4轮：33 给出具体建议
            const round4_33 = await requestPersonaJson(
                '33',
                `对话历史：${dialogueHistory.join('\n')}\n\n今天${detail.today.weatherText}，温度${detail.today.min}~${detail.today.max}度。${memory33}

33要给出更具体的建议。要求：1)基于天气给出可执行的行动建议；2)可以提及交通、健康等方面；3)控制在1-2句话；4)输出JSON格式：{"comment":"建议","action":"calm"}`,
                `建议预留更多通勤时间，注意根据温差增减衣物，避免感冒。`,
                'calm',
            );
            dialogueHistory.push(`33: ${round4_33.text}`);
            emitAction('33', round4_33.action);
            emitBubble('33', round4_33.text);
            pushMessage('assistant33', `33（天气）：${round4_33.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第5轮：22 鼓励用户，正能量
            const round5_22 = await requestPersonaJson(
                '22',
                `对话历史：${dialogueHistory.join('\n')}\n\n${memory22}

22要给用户正能量鼓励。要求：1)活泼鼓励的语气；2)让用户对今天充满信心；3)控制在1-2句话；4)输出JSON格式：{"comment":"鼓励","action":"happy"}`,
                `不管天气怎样，相信你今天一定会很顺利的！加油加油！`,
                'happy',
            );
            dialogueHistory.push(`22: ${round5_22.text}`);
            emitAction('22', round5_22.action);
            emitBubble('22', round5_22.text);
            pushMessage('assistant22', `22（天气）：${round5_22.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第6轮：33 收尾，简洁总结
            const round6_33 = await requestPersonaJson(
                '33',
                `对话历史：${dialogueHistory.join('\n')}\n\n${memory33}

33要做简洁的收尾总结。要求：1)简短总结天气要点；2)祝用户有高效的一天；3)控制在1句话；4)输出JSON格式：{"comment":"收尾","action":"thinking"}`,
                `总结：注意温差，合理安排。祝高效。`,
                'thinking',
            );
            dialogueHistory.push(`33: ${round6_33.text}`);
            emitAction('33', round6_33.action);
            emitBubble('33', round6_33.text);
            pushMessage('assistant33', `33（天气）：${round6_33.text}`);

            // 学习对话中的记忆
            const { learnFromDialogue } = await import('./services/memoryService');
            await learnFromDialogue(dialogueHistory.join('\n'), '天气对话');

            try {
                window.sessionStorage.setItem(TODAY_WEATHER_COMMENT_STORAGE_KEY, detail.today.dateKey);
            } catch {
                // ignore session storage failures
            }
        } catch (error) {
            console.error('Weather dialogue error:', error);
        } finally {
            setActiveMode('none');
        }
    }, [emitAction, emitBubble, pushMessage, requestPersonaJson, activeMode]);

    // 获取当前时间和季节信息
    const getTimeContext = React.useCallback(() => {
        const now = new Date();
        const hour = now.getHours();
        const month = now.getMonth() + 1; // 1-12

        // 时间段
        let timeOfDay: string;
        if (hour >= 5 && hour < 9) timeOfDay = '早晨';
        else if (hour >= 9 && hour < 12) timeOfDay = '上午';
        else if (hour >= 12 && hour < 14) timeOfDay = '中午';
        else if (hour >= 14 && hour < 18) timeOfDay = '下午';
        else if (hour >= 18 && hour < 22) timeOfDay = '晚上';
        else timeOfDay = '深夜';

        // 季节
        let season: string;
        if (month >= 3 && month <= 5) season = '春季';
        else if (month >= 6 && month <= 8) season = '夏季';
        else if (month >= 9 && month <= 11) season = '秋季';
        else season = '冬季';

        // 特殊时间节点
        const isMealTime = (hour >= 7 && hour <= 9) || (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 19);
        const isLateNight = hour >= 23 || hour < 5;
        const isWorkStart = hour >= 8 && hour <= 10;
        const isWorkEnd = hour >= 17 && hour <= 19;

        return {
            hour,
            month,
            timeOfDay,
            season,
            isMealTime,
            isLateNight,
            isWorkStart,
            isWorkEnd,
            timeString: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        };
    }, []);

    const triggerIdleInteraction = React.useCallback(async () => {
        if (idleRunningRef.current || llmState !== 'ready') {
            return;
        }

        // 检查是否有其他模式在进行中
        if (activeMode !== 'none' && activeMode !== 'chat') {
            return;
        }

        idleRunningRef.current = true;
        try {
            const timeContext = getTimeContext();
            const memory22 = await formatMemoriesForPrompt('22');
            const memory33 = await formatMemoriesForPrompt('33');

            // 22的智能提醒 - 根据时间和季节生成
            const idle22 = await requestPersonaJson(
                '22',
                `当前时间是${timeContext.timeString}，${timeContext.season}${timeContext.timeOfDay}。${memory22}

请根据当前时间和季节，用22娘活泼可爱的语气给用户一个贴心的提醒或建议。可以是：
- 如果是早晨/上午：提醒吃早餐、元气满满的一天
- 如果是中午：提醒吃午饭、适当休息
- 如果是下午：提醒喝水、活动一下
- 如果是晚上：提醒吃晚饭、放松休息
- 如果是深夜：提醒该睡觉了、不要熬夜
- 结合季节特点给出相应建议

要求：1)自然不生硬；2)体现22娘的性格；3)控制在1-2句话；4)输出JSON格式：{"comment":"内容","action":"happy|curious|thinking|calm|surprised"}`,
                `${timeContext.timeOfDay}好呀！记得照顾好自己哦~`,
                'happy',
            );

            await new Promise((resolve) => setTimeout(resolve, 800));

            // 33的补充建议 - 更理性实用
            const idle33 = await requestPersonaJson(
                '33',
                `当前时间是${timeContext.timeString}，${timeContext.season}${timeContext.timeOfDay}。22刚才说："${idle22.text}"${memory33}

请用33娘冷静客观的方式补充一个实用建议，与22的提醒形成互补。要求：1)理性分析当前时间该做什么；2)给出可执行的具体建议；3)控制在1句话；4)输出JSON格式：{"comment":"建议","action":"thinking|calm"}`,
                `从时间管理角度，建议合理安排接下来的任务。`,
                'thinking',
            );

            pushMessage('assistant22', `22（${timeContext.timeOfDay}问候）：${idle22.text}`);
            pushMessage('assistant33', `33（补充）：${idle33.text}`);
            emitAction('22', idle22.action);
            emitAction('33', idle33.action);
            emitBubble('22', idle22.text);
            emitBubble('33', idle33.text);
            markInteraction();

            // 学习待机对话中的记忆
            const { learnFromDialogue } = await import('./services/memoryService');
            await learnFromDialogue(`22: ${idle22.text}\n33: ${idle33.text}`, '待机问候');
        } finally {
            idleRunningRef.current = false;
        }
    }, [emitAction, emitBubble, llmState, markInteraction, pushMessage, requestPersonaJson, getTimeContext, activeMode]);

    const triggerNewsComment = React.useCallback(async () => {
        if (newsCommentRunningRef.current || llmState !== 'ready') {
            return;
        }

        // 检查是否有其他模式在进行中
        if (activeMode !== 'none' && activeMode !== 'chat') {
            pushMessage('system', `当前正在进行${getModeDisplayName(activeMode)}，请等待结束后再试。`);
            return;
        }

        setActiveMode('news');
        newsCommentRunningRef.current = true;
        try {
            const now = Date.now();
            if (now - lastNewsFetchRef.current > 30 * 60 * 1000 || newsCacheRef.current.length === 0) {
                const news = await fetchHotNews();
                newsCacheRef.current = news;
                lastNewsFetchRef.current = now;
            }

            const allNews = newsCacheRef.current;
            if (allNews.length === 0) {
                pushMessage('system', '暂无新闻可评论。');
                return;
            }

            const entertainmentNews = filterEntertainmentNews(allNews);
            const techNews = filterTechNews(allNews);

            const randomEntertainment = entertainmentNews.length > 0
                ? entertainmentNews[Math.floor(Math.random() * entertainmentNews.length)]
                : null;
            const randomTech = techNews.length > 0
                ? techNews[Math.floor(Math.random() * techNews.length)]
                : null;

            if (!randomEntertainment && !randomTech) {
                pushMessage('system', '没有找到合适的新闻。');
                return;
            }

            // 获取角色记忆
            const memory22 = await formatMemoriesForPrompt('22');
            const memory33 = await formatMemoriesForPrompt('33');

            const dialogueHistory: string[] = [];

            // 第1轮：22 开场，介绍今天的新闻话题
            const round1_22 = await requestPersonaJson(
                '22',
                `${NEWS_COMMENT_PROMPT_22}${memory22}

请用22娘活泼可爱的语气开场，介绍今天要讨论的新闻话题。要求：1)热情打招呼；2)简单介绍新闻背景；3)控制在2-3句话；4)输出JSON格式：{"comment":"内容","action":"happy"}`,
                `嗨！今天有好多有趣的新闻呢，让我来给你讲讲~`,
                'happy',
            );
            dialogueHistory.push(`22: ${round1_22.text}`);
            emitAction('22', round1_22.action);
            emitBubble('22', round1_22.text);
            pushMessage('assistant22', `22（新闻）：${round1_22.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第2轮：22 评论娱乐新闻
            if (randomEntertainment) {
                const round2_22 = await requestPersonaJson(
                    '22',
                    `${NEWS_COMMENT_PROMPT_22}\n\n新闻标题：${randomEntertainment.title}\n\n对话历史：${dialogueHistory.join('\n')}${memory22}

请评论这条娱乐新闻。要求：1)表达你的看法；2)可以有点情绪化；3)控制在1-2句话；4)输出JSON格式：{"comment":"评论","action":"curious"}`,
                    `这条新闻${randomEntertainment.title}，我觉得挺有意思的！`,
                    'curious',
                );
                dialogueHistory.push(`22: ${round2_22.text}`);
                emitAction('22', round2_22.action);
                emitBubble('22', round2_22.text);
                pushMessage('assistant22', `22 评论【${randomEntertainment.title}】：${round2_22.text}`);
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }

            // 第3轮：33 补充科技新闻
            if (randomTech) {
                const round3_33 = await requestPersonaJson(
                    '33',
                    `${NEWS_COMMENT_PROMPT_33}\n\n新闻标题：${randomTech.title}\n\n对话历史：${dialogueHistory.join('\n')}${memory33}

请用冷静客观的方式评论这条科技新闻。要求：1)给出理性分析；2)指出关键信息；3)控制在1-2句话；4)输出JSON格式：{"comment":"分析","action":"thinking"}`,
                    `关于${randomTech.title}，从技术角度看有几个值得关注的点。`,
                    'thinking',
                );
                dialogueHistory.push(`33: ${round3_33.text}`);
                emitAction('33', round3_33.action);
                emitBubble('33', round3_33.text);
                pushMessage('assistant33', `33 评论【${randomTech.title}】：${round3_33.text}`);
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }

            // 第4轮：22 和 33 互动讨论
            const round4_22 = await requestPersonaJson(
                '22',
                `${NEWS_COMMENT_PROMPT_22}\n\n对话历史：${dialogueHistory.join('\n')}${memory22}

22想对33的观点发表看法，或者提出自己的疑问。要求：1)活泼互动的语气；2)可以赞同或提出不同看法；3)控制在1-2句话；4)输出JSON格式：{"comment":"互动","action":"happy"}`,
                `33说的有道理，不过我觉得...`,
                'happy',
            );
            dialogueHistory.push(`22: ${round4_22.text}`);
            emitAction('22', round4_22.action);
            emitBubble('22', round4_22.text);
            pushMessage('assistant22', `22（新闻）：${round4_22.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第5轮：33 回应
            const round5_33 = await requestPersonaJson(
                '33',
                `${NEWS_COMMENT_PROMPT_33}\n\n对话历史：${dialogueHistory.join('\n')}${memory33}

33回应22的观点。要求：1)保持冷静但有互动感；2)可以补充或修正；3)控制在1-2句话；4)输出JSON格式：{"comment":"回应","action":"calm"}`,
                `从数据角度看，你的观点有一定道理，但还需要更多信息验证。`,
                'calm',
            );
            dialogueHistory.push(`33: ${round5_33.text}`);
            emitAction('33', round5_33.action);
            emitBubble('33', round5_33.text);
            pushMessage('assistant33', `33（新闻）：${round5_33.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第6轮：22 总结并邀请用户参与
            const round6_22 = await requestPersonaJson(
                '22',
                `${NEWS_COMMENT_PROMPT_22}\n\n对话历史：${dialogueHistory.join('\n')}${memory22}

22做总结，并邀请用户也说说自己的看法。要求：1)活泼友好的语气；2)总结今天讨论的新闻；3)邀请用户参与；4)控制在1-2句话；5)输出JSON格式：{"comment":"总结","action":"happy"}`,
                `今天的新闻就聊到这里啦！你对这些新闻有什么看法呢？`,
                'happy',
            );
            dialogueHistory.push(`22: ${round6_22.text}`);
            emitAction('22', round6_22.action);
            emitBubble('22', round6_22.text);
            pushMessage('assistant22', `22（新闻）：${round6_22.text}`);

            // 学习对话中的记忆
            const { learnFromDialogue } = await import('./services/memoryService');
            await learnFromDialogue(dialogueHistory.join('\n'), '新闻对话');

            markInteraction();
        } catch (error) {
            console.error('News dialogue error:', error);
            pushMessage('system', '新闻评论发生错误。');
        } finally {
            newsCommentRunningRef.current = false;
            setActiveMode('none');
        }
    }, [emitAction, emitBubble, llmState, markInteraction, pushMessage, requestPersonaJson]);

    // 获取模式显示名称
    const getModeDisplayName = (mode: string): string => {
        const names: Record<string, string> = {
            'skit': '小剧场',
            'history': '历史上的今天',
            'news': '新闻评价',
            'chat': '对话',
            'none': '无',
        };
        return names[mode] || mode;
    };

    // 历史上的今天按钮功能 - 优先使用 API，失败时使用 LLM
    const triggerHistoryToday = React.useCallback(async () => {
        if (isResponding || llmState !== 'ready') {
            pushMessage('system', llmState !== 'ready' ? '模型未就绪，请稍后再试。' : '正在处理中...');
            return;
        }

        // 检查是否有其他模式在进行中
        if (activeMode !== 'none' && activeMode !== 'chat') {
            pushMessage('system', `当前正在进行${getModeDisplayName(activeMode)}，请等待结束后再试。`);
            return;
        }

        setActiveMode('history');
        setIsResponding(true);
        pushMessage('system', '正在获取历史上的今天...');

        try {
            // 优先从 API 获取历史事件
            const historyData = await getTodayInHistory();
            
            if (historyData && historyData.events.length > 0) {
                // 随机选择两个不同的事件
                const event22 = historyData.events[Math.floor(Math.random() * historyData.events.length)];
                let event33 = historyData.events[Math.floor(Math.random() * historyData.events.length)];
                // 确保两个事件不同
                while (event33 === event22 && historyData.events.length > 1) {
                    event33 = historyData.events[Math.floor(Math.random() * historyData.events.length)];
                }

                // 22 讲述历史事件
                const text22 = formatHistoryForCharacter(event22, '22');
                emitAction('22', 'curious');
                emitBubble('22', text22);
                pushMessage('assistant22', `22（历史上的今天）：${text22}`);

                // 延迟一下让对话更自然
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // 33 讲述另一个历史事件或评论
                const text33 = formatHistoryForCharacter(event33, '33');
                emitAction('33', 'thinking');
                emitBubble('33', text33);
                pushMessage('assistant33', `33（历史上的今天）：${text33}`);
            } else {
                // API 获取失败，使用 LLM 生成
                pushMessage('system', '正在生成历史上的今天...');
                
                const today = new Date();
                const month = today.getMonth() + 1;
                const day = today.getDate();

                const reply22 = await requestPersonaJson(
                    '22',
                    `今天是${month}月${day}日。请讲述一个历史上今天发生的有趣事件。要求：1)选择轻松有趣或励志的历史事件；2)用22娘活泼可爱的语气讲述；3)控制在2-3句话；4)输出JSON格式：{"comment":"讲述内容","action":"happy|curious|thinking"}`,
                    `今天是${month}月${day}日，历史上有很多有趣的事情发生呢！让我给你讲一个好玩的故事吧~`,
                    'curious',
                );

                emitAction('22', reply22.action);
                emitBubble('22', reply22.text);
                pushMessage('assistant22', `22（历史上的今天）：${reply22.text}`);

                await new Promise((resolve) => setTimeout(resolve, 2000));

                const reply33 = await requestPersonaJson(
                    '33',
                    `今天是${month}月${day}日。请从另一个角度讲述一个历史上今天发生的事件。要求：1)选择科技、政治或经济相关的历史事件；2)用33娘冷静理性的语气；3)控制在2-3句话；4)输出JSON格式：{"comment":"讲述内容","action":"thinking|calm"}`,
                    `客观来说，${month}月${day}日在历史上确实有一些值得关注的事件。`,
                    'thinking',
                );

                emitAction('33', reply33.action);
                emitBubble('33', reply33.text);
                pushMessage('assistant33', `33（历史上的今天）：${reply33.text}`);
            }

            markInteraction();
        } catch (error) {
            pushMessage('system', '获取历史内容失败，请稍后重试。');
        } finally {
            setIsResponding(false);
            setActiveMode('none');
        }
    }, [emitAction, emitBubble, isResponding, llmState, markInteraction, pushMessage, requestPersonaJson]);

    // 小剧场按钮功能 - 多轮对话，22和33互动
    const triggerSkit = React.useCallback(async () => {
        if (isResponding || llmState !== 'ready') {
            pushMessage('system', llmState !== 'ready' ? '模型未就绪，请稍后再试。' : '正在处理中...');
            return;
        }

        // 检查是否有其他模式在进行中
        if (activeMode !== 'none' && activeMode !== 'chat') {
            pushMessage('system', `当前正在进行${getModeDisplayName(activeMode)}，请等待结束后再试。`);
            return;
        }

        setActiveMode('skit');
        setIsResponding(true);
        pushMessage('system', '🎭 小剧场开始！');

        try {
            // 获取一个笑话作为开场
            const joke = await fetchJokeFromAPI();
            const jokeContent = joke?.content || '为什么程序员总是分不清圣诞节和万圣节？因为 31 OCT = 25 DEC。';

            // 对话历史记录
            const dialogueHistory: string[] = [];

            // 第1轮：22 开场讲笑话
            const round1_22 = await requestPersonaJson(
                '22',
                `请讲一个笑话：${jokeContent}。要求：1)用22娘活泼可爱的语气开场；2)说"33，我给你讲个好玩的！"；3)然后讲笑话；4)控制在2-3句话；5)输出JSON格式：{"comment":"内容","action":"happy"}`,
                `33，我给你讲个好玩的！${jokeContent}`,
                'happy',
            );
            dialogueHistory.push(`22: ${round1_22.text}`);
            emitAction('22', round1_22.action);
            emitBubble('22', round1_22.text);
            pushMessage('assistant22', `22（小剧场）：${round1_22.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第2轮：33 吐槽
            const round2_33 = await requestPersonaJson(
                '33',
                `对话历史：${dialogueHistory.join('\n')}\n\n请用33娘冷静腹黑的方式吐槽22的笑话。要求：1)吐槽要犀利但有趣；2)可以说"你这笑话..."开头；3)控制在1-2句话；4)输出JSON格式：{"comment":"吐槽","action":"thinking"}`,
                `你这笑话...我该怎么评价呢。`,
                'thinking',
            );
            dialogueHistory.push(`33: ${round2_33.text}`);
            emitAction('33', round2_33.action);
            emitBubble('33', round2_33.text);
            pushMessage('assistant33', `33（小剧场）：${round2_33.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第3轮：22 回应并坚持笑话好笑
            const round3_22 = await requestPersonaJson(
                '22',
                `对话历史：${dialogueHistory.join('\n')}\n\n22被33吐槽了，请用活泼可爱的语气回应，坚持这个笑话是好笑的，并试图解释笑点。要求：1)带点撒娇的语气；2)说"你不觉得很好笑吗？"类似的话；3)控制在1-2句话；4)输出JSON格式：{"comment":"回应","action":"curious"}`,
                `你不觉得很好笑吗？我觉得超有趣的！`,
                'curious',
            );
            dialogueHistory.push(`22: ${round3_22.text}`);
            emitAction('22', round3_22.action);
            emitBubble('22', round3_22.text);
            pushMessage('assistant22', `22（小剧场）：${round3_22.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第4轮：33 继续吐槽并反击
            const round4_33 = await requestPersonaJson(
                '33',
                `对话历史：${dialogueHistory.join('\n')}\n\n33要继续吐槽并反击22的坚持。要求：1)更犀利但依然幽默；2)可以调侃22的品味；3)控制在1-2句话；4)输出JSON格式：{"comment":"反击","action":"calm"}`,
                `你的笑点...真的很独特。建议重新审视一下。`,
                'calm',
            );
            dialogueHistory.push(`33: ${round4_33.text}`);
            emitAction('33', round4_33.action);
            emitBubble('33', round4_33.text);
            pushMessage('assistant33', `33（小剧场）：${round4_33.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第5轮：22 委屈但坚持
            const round5_22 = await requestPersonaJson(
                '22',
                `对话历史：${dialogueHistory.join('\n')}\n\n22被连续吐槽后有点委屈，但依然坚持。要求：1)委屈但可爱的语气；2)说"好吧好吧，那我下次讲个更好笑的！"类似的话；3)控制在1-2句话；4)输出JSON格式：{"comment":"委屈","action":"happy"}`,
                `好吧好吧，那我下次讲个更好笑的！你一定会笑的！`,
                'happy',
            );
            dialogueHistory.push(`22: ${round5_22.text}`);
            emitAction('22', round5_22.action);
            emitBubble('22', round5_22.text);
            pushMessage('assistant22', `22（小剧场）：${round5_22.text}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 第6轮：33 收尾，给点鼓励
            const round6_33 = await requestPersonaJson(
                '33',
                `对话历史：${dialogueHistory.join('\n')}\n\n33看到22委屈了，稍微软化态度，给点鼓励但保持腹黑风格。要求：1)稍微温柔但依然冷静；2)说"我拭目以待"类似的话；3)控制在1句话；4)输出JSON格式：{"comment":"收尾","action":"thinking"}`,
                `...我拭目以待。希望下次你的品味能有所提升。`,
                'thinking',
            );
            dialogueHistory.push(`33: ${round6_33.text}`);
            emitAction('33', round6_33.action);
            emitBubble('33', round6_33.text);
            pushMessage('assistant33', `33（小剧场）：${round6_33.text}`);

            pushMessage('system', '🎭 小剧场结束！');
            markInteraction();
        } catch (error) {
            pushMessage('system', '小剧场发生错误。');
        } finally {
            setIsResponding(false);
            setActiveMode('none');
        }
    }, [emitAction, emitBubble, isResponding, llmState, markInteraction, pushMessage, requestPersonaJson]);

    const handleAssistantReply = React.useCallback(async (userText: string) => {
        const text = userText.trim();
        if (!text || isResponding) {
            return;
        }

        markInteraction();
        setIsResponding(true);

        const targetLabel = target === 'all' ? 'ALL' : target;
        pushMessage('user', `[对${targetLabel}] ${text}`);

        try {
            if (target === 'all') {
                const [reply22, reply33] = await Promise.all([
                    askModel('22', text),
                    askModel('33', text),
                ]);
                pushMessage('assistant22', `22：${reply22.text}`);
                pushMessage('assistant33', `33：${reply33.text}`);
                emitAction('22', reply22.action);
                emitAction('33', reply33.action);
                emitBubble('22', reply22.text);
                emitBubble('33', reply33.text);
                return;
            }

            const reply = await askModel(target, text);
            if (target === '22') {
                pushMessage('assistant22', `22：${reply.text}`);
            } else {
                pushMessage('assistant33', `33：${reply.text}`);
            }
            emitAction(target, reply.action);
            emitBubble(target, reply.text);
        } finally {
            setIsResponding(false);
        }
    }, [askModel, emitAction, emitBubble, isResponding, markInteraction, pushMessage, target]);

    const handleSendText = React.useCallback(() => {
        const text = draft.trim();
        if (!text || isResponding) {
            return;
        }

        setDraft('');
        void handleAssistantReply(text);
    }, [draft, handleAssistantReply, isResponding]);

    // 抽屉开关控制
    const openPanel = React.useCallback(() => {
        setPanelOpen(true);
        // 延迟显示抽屉动画
        setTimeout(() => {
            setDrawerVisible(true);
        }, 10);
    }, []);

    const closePanel = React.useCallback(() => {
        setDrawerVisible(false);
        // 等待动画完成后隐藏面板
        setTimeout(() => {
            setPanelOpen(false);
        }, 300);
    }, []);

    // URL参数检查 - 纯净模式和自动打开面板
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if (mode === 'ai') {
            setPureMode(true);
            // 触发纯净模式事件
            window.dispatchEvent(new CustomEvent('kaguya:pure-mode', {
                detail: { enabled: true },
            }));
            // 自动打开面板
            openPanel();
        }
    }, [openPanel]);

    // 切换纯净模式
    const togglePureMode = React.useCallback(() => {
        const newPureMode = !pureMode;
        setPureMode(newPureMode);
        // 触发事件通知其他组件
        window.dispatchEvent(new CustomEvent('kaguya:pure-mode', {
            detail: { enabled: newPureMode },
        }));
        pushMessage('system', newPureMode ? '已开启纯净模式' : '已退出纯净模式');
    }, [pureMode, pushMessage]);

    // 键盘快捷键监听 - Shift+\ 切换纯净模式
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            // 必须同时按住 Shift 和反斜杠键，单独的 \ 不触发
            // 使用 keyCode 确保精确匹配反斜杠键 (keyCode 220)
            if (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && event.keyCode === 220) {
                event.preventDefault();
                togglePureMode();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [togglePureMode]);

    const handleModelPreferenceChange = React.useCallback((nextPref: ModelPreference): void => {
        setModelPreference(nextPref);
        setStoredModelPreference(nextPref);
        const message = nextPref === 'auto'
            ? `已切回自动模型选择（当前推荐：${getModelDisplayName(recommendedModelId)}）。`
            : `已切换模型：${getModelDisplayName(nextPref)}。`;
        pushMessage('system', message);
        if (panelOpen) {
            const nextModel = resolveTargetModel(nextPref, recommendedModelId, new Set(allModelIds));
            void ensureLLMEngine(nextModel);
        }
    }, [allModelIds, ensureLLMEngine, panelOpen, pushMessage, recommendedModelId, resolveTargetModel]);

    const handleAllModelSelectChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
        const value = event.target.value;
        if (!value) {
            return;
        }
        handleModelPreferenceChange(value === 'auto' ? 'auto' : value);
    }, [handleModelPreferenceChange]);

    React.useEffect(() => {
        if (!panelOpen) {
            return;
        }

        if (!openedHintRef.current) {
            openedHintRef.current = true;
            pushMessage('system', '已展开：可选22/33/all。搜索输入会触发角色点评与动作。');
        }

        if (!storageCheckedRef.current) {
            storageCheckedRef.current = true;
            void ensurePersistentStorage();
        }

        void (async () => {
            const autoModel = await detectRecommendedModel();
            const targetModel = resolveTargetModel(modelPreference, autoModel, new Set(allModelIds));
            await refreshCachedModelIds();
            await ensureLLMEngine(targetModel);
        })();
    }, [allModelIds, detectRecommendedModel, ensureLLMEngine, ensurePersistentStorage, modelPreference, panelOpen, pushMessage, refreshCachedModelIds, resolveTargetModel]);

    React.useEffect(() => {
        const onSearchInput = (event: Event): void => {
            const detail = (event as CustomEvent<SearchInputEventDetail>).detail;
            const keyword = typeof detail?.value === 'string' ? detail.value.trim() : '';
            if (!keyword || keyword.length < 2) {
                return;
            }
            if (keyword === lastSearchKeywordRef.current) {
                return;
            }

            if (searchDebounceRef.current !== null) {
                window.clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
            }

            searchDebounceRef.current = window.setTimeout(() => {
                lastSearchKeywordRef.current = keyword;
                void handleSearchFeedback(keyword);
            }, SEARCH_EVAL_DEBOUNCE_MS);
        };

        window.addEventListener('kaguya:search-input', onSearchInput as EventListener);
        return () => {
            window.removeEventListener('kaguya:search-input', onSearchInput as EventListener);
            if (searchDebounceRef.current !== null) {
                window.clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
            }
        };
    }, [handleSearchFeedback]);

    // 监听搜索提交事件
    React.useEffect(() => {
        const onSearchSubmit = (event: Event): void => {
            const detail = (event as CustomEvent<{ keyword: string; searchEngine: string }>).detail;
            if (detail?.keyword) {
                void handleSearchSubmit(detail.keyword, detail.searchEngine || '搜索引擎');
            }
        };

        window.addEventListener('kaguya:search-submit', onSearchSubmit as EventListener);
        return () => {
            window.removeEventListener('kaguya:search-submit', onSearchSubmit as EventListener);
        };
    }, [handleSearchSubmit]);

    // 监听导航点击事件
    React.useEffect(() => {
        const onNavClick = (event: Event): void => {
            const detail = (event as CustomEvent<{ websiteName: string; websiteUrl: string; categoryTitle: string }>).detail;
            if (detail?.websiteName) {
                void handleNavClickFeedback(detail.websiteName, detail.categoryTitle);
            }
        };

        window.addEventListener('kaguya:nav-click', onNavClick as EventListener);
        return () => {
            window.removeEventListener('kaguya:nav-click', onNavClick as EventListener);
        };
    }, []);

    // 处理导航点击后的AI反馈（结合用户画像）
    const handleNavClickFeedback = React.useCallback(async (websiteName: string, categoryTitle: string) => {
        if (!websiteName) {
            return;
        }

        // 检查是否有其他模式在进行中
        if (activeMode !== 'none' && activeMode !== 'chat') {
            return;
        }

        markInteraction();

        // 获取导航用户画像
        const { getNavigationUserProfile } = await import('./services/navigationAnalysisService');
        const navProfile = await getNavigationUserProfile();

        // 构建用户画像上下文
        let profileContext = '';
        if (navProfile.personalityTraits.length > 0) {
            profileContext += `用户性格特征：${navProfile.personalityTraits.join('、')}。`;
        }
        if (navProfile.topCategories.length > 0) {
            profileContext += `用户偏好类别：${navProfile.topCategories.join('、')}。`;
        }

        const [reply22, reply33] = await Promise.all([
            requestPersonaJson(
                '22',
                `用户刚刚点击了导航链接"${websiteName}"(${categoryTitle})。${profileContext}

请用22娘活泼关心的语气评论一下：
1) 结合用户性格特征，用适合的方式互动
2) 如果这是用户喜欢的类型，可以表现出开心
3) 给一些温暖的鼓励或相关的小建议
4) 控制在1-2句话
5) 输出JSON格式：{"comment":"内容","action":"happy|curious|thinking|calm|surprised"}`,
                `访问${websiteName}啦！这个网站很有意思呢~`,
                'happy',
            ),
            requestPersonaJson(
                '33',
                `用户刚刚点击了导航链接"${websiteName}"(${categoryTitle})。${profileContext}

请用33娘冷静客观的语气评论一下：
1) 结合用户性格特征，给出合适的回应
2) 可以提及这个网站的特点或用途
3) 给出实用的建议
4) 控制在1-2句话
5) 输出JSON格式：{"comment":"内容","action":"happy|curious|thinking|calm|surprised"}`,
                `正在访问${websiteName}，需要我记录这个网站的信息吗？`,
                'thinking',
            ),
        ]);

        pushMessage('assistant22', `22（导航）：${reply22.text}`);
        pushMessage('assistant33', `33（导航）：${reply33.text}`);
        emitAction('22', reply22.action);
        emitAction('33', reply33.action);
        emitBubble('22', reply22.text);
        emitBubble('33', reply33.text);
    }, [activeMode, emitAction, emitBubble, markInteraction, pushMessage, requestPersonaJson]);

    React.useEffect(() => {
        const onWeatherAdvisory = (event: Event): void => {
            const detail = (event as CustomEvent<WeatherAdvisoryEventDetail>).detail;
            void handleWeatherAdvisory(detail);
        };

        window.addEventListener('kaguya:weather-advisory', onWeatherAdvisory as EventListener);
        return () => {
            window.removeEventListener('kaguya:weather-advisory', onWeatherAdvisory as EventListener);
        };
    }, [handleWeatherAdvisory]);

    React.useEffect(() => {
        const onTodayWeather = (event: Event): void => {
            const detail = (event as CustomEvent<TodayWeatherEventDetail>).detail;
            void handleTodayWeather(detail);
        };

        window.addEventListener('kaguya:today-weather', onTodayWeather as EventListener);
        return () => {
            window.removeEventListener('kaguya:today-weather', onTodayWeather as EventListener);
        };
    }, [handleTodayWeather]);

    React.useEffect(() => {
        const timer = window.setInterval(() => {
            const now = Date.now();
            const idleTooLong = now - lastInteractionAtRef.current >= IDLE_THRESHOLD_MS;
            if (idleTooLong) {
                // 使用ref获取最新的activeMode，避免闭包问题
                const currentMode = activeModeRef.current;
                if (currentMode !== 'none' && currentMode !== 'chat') {
                    // 如果有模式正在进行，不触发idle交互
                    return;
                }
                const random = Math.random();
                if (random < 0.3) {
                    void triggerNewsComment();
                } else if (random < 0.5) {
                    void triggerSkit();
                } else {
                    void triggerIdleInteraction();
                }
            }
        }, IDLE_INTERVAL_MS);

        return () => {
            window.clearInterval(timer);
        };
    }, [triggerIdleInteraction, triggerNewsComment, triggerSkit]);

    const [enginePaused, setEnginePaused] = React.useState<boolean>(false);

    const handlePauseEngine = React.useCallback(async (): Promise<void> => {
        if (activeEngineRef.current) {
            try {
                await activeEngineRef.current.unload();
            } catch (error) {
                console.warn('[PauseEngine] 卸载引擎时出错:', error);
            }
        }
        activeEngineRef.current = null;
        setEnginePaused(true);
        setLlmState('idle');
        setActiveModelId('已暂停');
        setLlmProgress('进程已暂停');
        pushMessage('system', 'WebLLM 进程已暂停。');
    }, [pushMessage]);

    const handleResumeEngine = React.useCallback(async (): Promise<void> => {
        setIsResumingEngine(true);
        setResumeProgress(0);
        setEnginePaused(false);
        setLlmProgress('正在恢复进程...');
        pushMessage('system', 'WebLLM 进程恢复中...');

        if (panelOpen && storageCheckedRef.current) {
            const nextTargetModel = resolveTargetModel(modelPreference, recommendedModelId, new Set(allModelIds));

            try {
                // 使用真实的进度回调
                const progressCallback = (progress: number, text: string) => {
                    setResumeProgress(progress);
                    // 更新进度文本，显示当前加载阶段
                    if (text) {
                        setLlmProgress(`恢复中: ${text}`);
                    }
                };

                await ensureLLMEngine(nextTargetModel, progressCallback);

                // 确保显示100%
                setResumeProgress(100);

                // 等待一小段时间让用户看到100%
                await new Promise(resolve => setTimeout(resolve, 500));

                pushMessage('system', 'WebLLM 进程已恢复！');
            } catch (error) {
                pushMessage('system', `恢复失败: ${error instanceof Error ? error.message : '未知错误'}`);
            } finally {
                setIsResumingEngine(false);
                setResumeProgress(0);
            }
        } else {
            setIsResumingEngine(false);
            pushMessage('system', 'WebLLM 进程已恢复！');
        }
    }, [allModelIds, ensureLLMEngine, modelPreference, panelOpen, pushMessage, recommendedModelId, resolveTargetModel]);

    // 获取其他缓存信息
    const getOtherCachesInfo = React.useCallback(async () => {
        const caches = [];
        
        // 历史上的今天缓存
        try {
            const historyEntry = await indexedDBCache.get('kaguya:history:today');
            if (historyEntry) {
                caches.push({
                    key: 'history',
                    name: '历史上的今天',
                    description: '历史事件数据缓存（30天）',
                    size: '约 5-10 KB',
                    consequence: '下次查看时需要重新获取',
                    hasCache: true,
                });
            }
        } catch {}
        
        // 新闻缓存
        try {
            const newsEntry = await indexedDBCache.get('kaguya:news:cache');
            if (newsEntry) {
                caches.push({
                    key: 'news',
                    name: '热点新闻',
                    description: '新闻数据缓存（3小时）',
                    size: '约 10-50 KB',
                    consequence: '下次查看时需要重新获取',
                    hasCache: true,
                });
            }
        } catch {}
        
        return caches;
    }, []);

    // 使用底层浏览器 API 强制清理模型缓存
    const forceClearModelCache = async (modelId: string): Promise<boolean> => {
        try {
            // 1. 尝试使用 WebLLM 的删除方法
            const webllm = await getWebLLMModule();
            for (const strategy of STRATEGIES) {
                const appConfig = buildAppConfigWithStrategy(webllm.prebuiltAppConfig, strategy);
                try {
                    await webllm.deleteModelAllInfoInCache(modelId, appConfig);
                } catch {}
            }
            
            // 2. 直接清理 Cache API 中的缓存
            if ('caches' in window) {
                try {
                    const cacheNames = await window.caches.keys();
                    for (const cacheName of cacheNames) {
                        if (cacheName.includes('mlc') || cacheName.includes('webllm') || cacheName.includes(modelId)) {
                            const cache = await window.caches.open(cacheName);
                            const keys = await cache.keys();
                            for (const request of keys) {
                                if (request.url.includes(modelId)) {
                                    await cache.delete(request);
                                    console.log(`[CacheManager] 从 Cache API 删除: ${request.url}`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[CacheManager] Cache API 清理失败:', e);
                }
            }
            
            // 3. 清理 IndexedDB 中的模型数据
            try {
                const databases = await (window.indexedDB as any).databases?.() || [];
                for (const db of databases) {
                    if (db.name && (db.name.includes('mlc') || db.name.includes('webllm') || db.name.includes(modelId))) {
                        window.indexedDB.deleteDatabase(db.name);
                        console.log(`[CacheManager] 删除 IndexedDB: ${db.name}`);
                    }
                }
            } catch (e) {
                console.warn('[CacheManager] IndexedDB 清理失败:', e);
            }
            
            // 4. 等待并验证
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            for (const strategy of STRATEGIES) {
                const appConfig = buildAppConfigWithStrategy(webllm.prebuiltAppConfig, strategy);
                const hasCache = await webllm.hasModelInCache(modelId, appConfig).catch(() => false);
                if (hasCache) {
                    return false;
                }
            }
            
            return true;
        } catch (err) {
            console.error('[CacheManager] 强制清理失败:', err);
            return false;
        }
    };

    // 清理选中的缓存
    const handleClearSelectedCaches = React.useCallback(async (): Promise<void> => {
        setIsClearingCache(true);
        pushMessage('system', '正在清理选中的缓存...');
        
        let clearedModels = 0;
        let clearedOthers = 0;
        const failedModels: string[] = [];
        
        try {
            // 清理选中的模型缓存
            if (selectedModelCaches.size > 0) {
                // 如果要清理的模型包含当前加载的模型，先完全卸载引擎
                const currentModel = loadingModelIdRef.current;
                if (currentModel && selectedModelCaches.has(currentModel)) {
                    pushMessage('system', `正在卸载当前模型 ${currentModel}...`);
                    try {
                        if (activeEngineRef.current) {
                            await activeEngineRef.current.unload();
                        }
                    } catch (e) {
                        console.warn('[CacheManager] 卸载引擎失败:', e);
                    }
                    activeEngineRef.current = null;
                    loadingModelIdRef.current = null;
                    setLlmState('idle');
                    setActiveModelId('未加载');
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                
                for (const modelId of selectedModelCaches) {
                    try {
                        pushMessage('system', `正在清理模型: ${modelId}...`);
                        
                        // 使用强制清理方法
                        const success = await forceClearModelCache(modelId);
                        
                        if (success) {
                            clearedModels++;
                            console.log(`[CacheManager] 模型缓存清理成功: ${modelId}`);
                        } else {
                            failedModels.push(modelId);
                            console.warn(`[CacheManager] 模型缓存清理失败: ${modelId}`);
                        }
                    } catch (err) {
                        failedModels.push(modelId);
                        console.error(`[CacheManager] 清理模型缓存异常: ${modelId}`, err);
                    }
                }
                
                // 刷新缓存列表
                await refreshCachedModelIds();
            }
            
            // 清理选中的其他缓存
            for (const cacheKey of selectedOtherCaches) {
                try {
                    if (cacheKey === 'history') {
                        await indexedDBCache.remove('kaguya:history:today');
                        console.log('[CacheManager] 已删除历史缓存');
                    } else if (cacheKey === 'news') {
                        await indexedDBCache.remove('kaguya:news:cache');
                        console.log('[CacheManager] 已删除新闻缓存');
                    } else if (cacheKey === 'jokes') {
                        const { clearJokesCache } = await import('./services/jokeService');
                        await clearJokesCache();
                        console.log('[CacheManager] 已删除小剧场缓存');
                    }
                    clearedOthers++;
                } catch (e) {
                    console.warn(`[CacheManager] 删除其他缓存失败: ${cacheKey}`, e);
                }
            }
            
            // 构建结果消息
            const messages: string[] = [];
            if (clearedModels > 0) messages.push(`${clearedModels} 个模型`);
            if (clearedOthers > 0) messages.push(`${clearedOthers} 项其他缓存`);
            
            if (clearedModels > 0 || clearedOthers > 0) {
                let resultMsg = `✅ 已清理: ${messages.join('、')}。`;
                if (failedModels.length > 0) {
                    resultMsg += `\n⚠️ 以下模型清理失败: ${failedModels.join(', ')}`;
                }
                pushMessage('system', resultMsg);
            } else if (failedModels.length > 0) {
                pushMessage('system', `❌ 清理失败: ${failedModels.join(', ')}`);
            } else {
                pushMessage('system', '⚠️ 未成功清理任何缓存，请重试。');
            }
        } catch (error) {
            pushMessage('system', `❌ 清理缓存失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsClearingCache(false);
            // 只关闭缓存管理弹窗，不关闭AI面板
            setShowCacheManager(false);
            // 重置选择状态
            setSelectedModelCaches(new Set());
            setSelectedOtherCaches(new Set());
            setSelectAllModels(false);
            setSelectAllOthers(false);
        }
    }, [selectedModelCaches, selectedOtherCaches, getWebLLMModule, refreshCachedModelIds, pushMessage]);

    // 切换模型缓存选择
    const toggleModelCache = React.useCallback((modelId: string) => {
        setSelectedModelCaches(prev => {
            const newSet = new Set(prev);
            if (newSet.has(modelId)) {
                newSet.delete(modelId);
            } else {
                newSet.add(modelId);
            }
            return newSet;
        });
    }, []);

    // 切换其他缓存选择
    const toggleOtherCache = React.useCallback((key: string) => {
        setSelectedOtherCaches(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    }, []);

    // 全选/取消全选模型缓存
    const toggleSelectAllModels = React.useCallback(() => {
        if (selectAllModels) {
            setSelectedModelCaches(new Set());
        } else {
            setSelectedModelCaches(new Set(cachedModelIds));
        }
        setSelectAllModels(!selectAllModels);
    }, [selectAllModels, cachedModelIds]);

    // 打开缓存管理面板时初始化
    const openCacheManager = React.useCallback(async () => {
        setShowCacheManager(true);
        setSelectedModelCaches(new Set());
        setSelectedOtherCaches(new Set());
        setSelectAllModels(false);
        setSelectAllOthers(false);
        // 刷新缓存列表以确保显示最新状态
        await refreshCachedModelIds();
    }, [refreshCachedModelIds]);

    React.useEffect(() => {
        return () => {
            if (searchDebounceRef.current !== null) {
                window.clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
            }
            if (activeEngineRef.current) {
                void activeEngineRef.current.unload();
            }
            activeEngineRef.current = null;
            webllmModuleRef.current = null;
            loadingPromiseRef.current = null;
            loadingModelIdRef.current = null;
        };
    }, []);

    const llmText = llmState === 'ready'
        ? '就绪'
        : (llmState === 'loading' ? '加载中' : (llmState === 'error' ? '失败' : (llmState === 'unsupported' ? '不支持' : '未加载')));
    const storageText = storagePersistence === 'persisted'
        ? '已持久化'
        : (storagePersistence === 'granted'
            ? '已申请持久化'
            : (storagePersistence === 'denied'
                ? '未授权持久化'
                : (storagePersistence === 'unsupported' ? '浏览器不支持' : '待检测')));
    const modelOptionList: ModelPreference[] = ['auto', ...QWEN3_MODEL_IDS.filter((id) => allModelIds.includes(id))];
    const allModelSelectValue = modelPreference === 'auto' || allModelIds.includes(modelPreference) ? modelPreference : 'auto';
    const cachedModelIdSet = React.useMemo(() => new Set(cachedModelIds), [cachedModelIds]);
    const cachedModelCount = React.useMemo(
        () => allModelIds.filter((id) => cachedModelIdSet.has(id)).length,
        [allModelIds, cachedModelIdSet],
    );
    const currentTargetModel = resolveTargetModel(modelPreference, recommendedModelId, new Set(allModelIds));
    const currentTargetCached = cachedModelIdSet.has(currentTargetModel);

    return (
        <div className={`kaguya-deep ${pureMode ? 'kaguya-deep-pure' : ''}`}>
            {/* 触发按钮 - 面板打开时隐藏 */}
            {!panelOpen && (
                <button
                    className='kaguya-deep-trigger'
                    type='button'
                    onClick={openPanel}
                    ref={triggerRef}
                    aria-label='Open deep interaction panel'
                    aria-expanded={panelOpen}
                >
                    <svg viewBox='0 0 24 24' aria-hidden='true'>
                        <path d='M12 3.5c-4.9 0-8.8 3.3-8.8 7.3 0 2.3 1.3 4.3 3.4 5.6v3.8l3.1-2a10.9 10.9 0 0 0 2.3.3c4.9 0 8.8-3.3 8.8-7.3S16.9 3.5 12 3.5zm-3 7.4a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm3 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm3 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2z' />
                    </svg>
                </button>
            )}

            {/* 抽屉面板 */}
            {panelOpen && (
                <div className={`kaguya-deep-drawer ${drawerVisible ? 'kaguya-deep-drawer-visible' : ''}`} ref={panelRef}>
                    {/* 角落按钮 - 绝对定位 */}
                    <div className='kaguya-deep-corner-actions'>
                        {/* 缓存管理按钮 */}
                        <button
                            type='button'
                            className='kaguya-deep-corner-btn kaguya-deep-corner-btn-clear-cache'
                            onClick={openCacheManager}
                            disabled={isClearingCache}
                            title='缓存管理'
                        >
                            🗑️
                        </button>
                        {/* 停止进程按钮 */}
                        {llmState === 'ready' && (
                            enginePaused ? (
                                <button
                                    type='button'
                                    className='kaguya-deep-corner-btn kaguya-deep-corner-btn-resume'
                                    onClick={handleResumeEngine}
                                    title='恢复进程'
                                >
                                    ▶️
                                </button>
                            ) : (
                                <button
                                    type='button'
                                    className='kaguya-deep-corner-btn kaguya-deep-corner-btn-pause'
                                    onClick={() => void handlePauseEngine()}
                                    disabled={isResponding}
                                    title='停止进程'
                                >
                                    ⏸️
                                </button>
                            )
                        )}
                        {/* 纯净模式按钮 */}
                        <button
                            className={`kaguya-deep-pure-btn ${pureMode ? 'kaguya-deep-pure-btn-active' : ''}`}
                            type='button'
                            onClick={togglePureMode}
                            title={pureMode ? '退出纯净模式' : '进入纯净模式'}
                        >
                            {pureMode ? '👁️' : '👁️‍🗨️'}
                        </button>
                        {/* 关闭按钮 */}
                        <button className='kaguya-deep-close' type='button' onClick={closePanel} aria-label='Close panel'>
                            ×
                        </button>
                    </div>

                    {/* 缓存管理面板 */}
                    {showCacheManager && (
                        <CacheManagerPanel
                            cachedModelIds={cachedModelIds}
                            selectedModelCaches={selectedModelCaches}
                            selectedOtherCaches={selectedOtherCaches}
                            selectAllModels={selectAllModels}
                            onToggleModelCache={toggleModelCache}
                            onToggleOtherCache={toggleOtherCache}
                            onToggleSelectAllModels={toggleSelectAllModels}
                            onClose={() => setShowCacheManager(false)}
                            onConfirm={handleClearSelectedCaches}
                            isClearing={isClearingCache}
                        />
                    )}

                    {/* 引擎暂停蒙层 - 覆盖整个内容区域 */}
                    {(enginePaused || isResumingEngine) && (
                        <div className='kaguya-deep-paused-overlay'>
                            <div className='kaguya-deep-paused-content'>
                                {isResumingEngine ? (
                                    <>
                                        <div className='kaguya-deep-paused-icon-large'>▶️</div>
                                        <div className='kaguya-deep-paused-title'>正在恢复引擎...</div>
                                        <div className='kaguya-deep-progress-container'>
                                            <div className='kaguya-deep-progress-bar'>
                                                <div
                                                    className='kaguya-deep-progress-fill'
                                                    style={{ width: `${Math.min(100, resumeProgress)}%` }}
                                                />
                                            </div>
                                            <div className='kaguya-deep-progress-text'>{Math.min(100, Math.round(resumeProgress))}%</div>
                                        </div>
                                        <div className='kaguya-deep-paused-desc'>正在加载模型，请稍候...</div>
                                    </>
                                ) : (
                                    <>
                                        <div className='kaguya-deep-paused-icon-large'>⏸️</div>
                                        <div className='kaguya-deep-paused-title'>引擎已暂停</div>
                                        <div className='kaguya-deep-paused-desc'>点击恢复按钮以继续操作</div>
                                        <button
                                            type='button'
                                            className='kaguya-deep-paused-resume-large-btn'
                                            onClick={handleResumeEngine}
                                            disabled={isResumingEngine}
                                        >
                                            ▶️ 恢复引擎
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 内容区域 - 可滚动 */}
                    <div className='kaguya-drawer-content'>
                        <div className='kaguya-deep-meta'>模式：纯文字 · WebLLM：{llmText}</div>
                        <div className='kaguya-deep-meta'>WebLLM：{llmProgress}</div>
                        <div className='kaguya-deep-meta'>当前模型：{activeModelId}</div>
                        <div className='kaguya-deep-meta'>模型地址：{activeModelSource}</div>
                        <div className='kaguya-deep-meta'>模型缓存：{storageText}</div>
                        <div className='kaguya-deep-meta'>{`目标缓存：${currentTargetCached ? '已缓存' : '未缓存'}（${getModelDisplayName(currentTargetModel)}）`}</div>
                        <div className='kaguya-deep-meta'>{`本地缓存模型：${cachedModelCount}/${allModelIds.length || 0}`}</div>
                        <div className='kaguya-deep-meta'>设备评估：{deviceHint}</div>
                        <div className='kaguya-deep-model-row'>
                            <span className='kaguya-deep-model-label'>模型</span>
                            <select
                                className='kaguya-deep-model-all-select'
                                value={allModelSelectValue}
                                onChange={handleAllModelSelectChange}
                            >
                                <option value='auto'>{`自动（Qwen优先：${getModelDisplayName(recommendedModelId)}${currentTargetCached ? ' [已缓存]' : ''}）`}</option>
                                {allModelIds.map((modelId) => (
                                    <option key={modelId} value={modelId}>
                                        {`${modelId}${cachedModelIdSet.has(modelId) ? ' [已缓存]' : ''}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className='kaguya-deep-targets'>
                            <button
                                type='button'
                                className={`kaguya-deep-target${target === '22' ? ' kaguya-deep-target-active' : ''}`}
                                onClick={() => setTarget('22')}
                            >
                                对22
                            </button>
                            <button
                                type='button'
                                className={`kaguya-deep-target${target === '33' ? ' kaguya-deep-target-active' : ''}`}
                                onClick={() => setTarget('33')}
                            >
                                对33
                            </button>
                            <button
                                type='button'
                                className={`kaguya-deep-target${target === 'all' ? ' kaguya-deep-target-active' : ''}`}
                                onClick={() => setTarget('all')}
                            >
                                对全部
                            </button>
                        </div>

                        <div className='kaguya-deep-actions'>
                            {/* 小剧场按钮 */}
                            <button
                                type='button'
                                className='kaguya-deep-action-btn'
                                onClick={() => void triggerSkit()}
                                disabled={llmState !== 'ready' || isResponding}
                            >
                                🎭 小剧场
                            </button>
                            {/* 历史上的今天按钮 */}
                            <button
                                type='button'
                                className='kaguya-deep-action-btn'
                                onClick={() => void triggerHistoryToday()}
                                disabled={llmState !== 'ready' || isResponding}
                            >
                                📜 历史上的今天
                            </button>
                            <button
                                type='button'
                                className='kaguya-deep-action-btn'
                                onClick={() => void triggerNewsComment()}
                                disabled={llmState !== 'ready' || isResponding}
                            >
                                📰 新闻评价
                            </button>
                        </div>

                        <div className='kaguya-deep-log'>
                            {messages.map((msg: ChatMessage) => (
                                <div key={msg.id} className={`kaguya-deep-line kaguya-deep-line-${msg.role}`}>
                                    {msg.text}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 输入区域 - 固定在底部 */}
                    <div className='kaguya-deep-input-area'>
                        <div className='kaguya-deep-input-wrap'>
                            <textarea
                                className='kaguya-deep-input'
                                placeholder='输入内容，Enter发送，Shift+Enter换行...'
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    event.stopPropagation();
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault();
                                        handleSendText();
                                    }
                                }}
                            />
                            <button className='kaguya-deep-send' type='button' onClick={handleSendText} disabled={isResponding}>
                                {isResponding ? '...' : '发送'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 缓存管理面板组件
type CacheManagerPanelProps = {
    cachedModelIds: string[];
    selectedModelCaches: Set<string>;
    selectedOtherCaches: Set<string>;
    selectAllModels: boolean;
    onToggleModelCache: (modelId: string) => void;
    onToggleOtherCache: (key: string) => void;
    onToggleSelectAllModels: () => void;
    onClose: () => void;
    onConfirm: () => void;
    isClearing: boolean;
};

interface OtherCacheInfo {
    key: string;
    name: string;
    description: string;
    duration: string;
    size: string;
    consequence: string;
}

const CacheManagerPanel: React.FC<CacheManagerPanelProps> = ({
    cachedModelIds,
    selectedModelCaches,
    selectedOtherCaches,
    selectAllModels,
    onToggleModelCache,
    onToggleOtherCache,
    onToggleSelectAllModels,
    onClose,
    onConfirm,
    isClearing,
}) => {
    const [availableOtherCaches, setAvailableOtherCaches] = React.useState<OtherCacheInfo[]>([]);
    const [jokesCacheInfo, setJokesCacheInfo] = React.useState<{ count: number; consumed: number } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // 动态检查可用的缓存
    React.useEffect(() => {
        const checkAvailableCaches = async () => {
            setIsLoading(true);
            const caches: OtherCacheInfo[] = [];

            // 检查历史上的今天缓存
            try {
                const historyEntry = await indexedDBCache.get('kaguya:history:today');
                if (historyEntry) {
                    caches.push({
                        key: 'history',
                        name: '历史上的今天',
                        description: '历史事件数据缓存',
                        duration: '30天',
                        size: '约 5-10 KB',
                        consequence: '下次查看时需要重新从维基百科获取',
                    });
                }
            } catch {}

            // 检查新闻缓存
            try {
                const newsEntry = await indexedDBCache.get('kaguya:news:cache');
                if (newsEntry) {
                    caches.push({
                        key: 'news',
                        name: '热点新闻',
                        description: '新闻数据缓存',
                        duration: '3小时',
                        size: '约 10-50 KB',
                        consequence: '下次查看时需要重新从 RSS 源获取',
                    });
                }
            } catch {}

            // 检查笑话缓存
            try {
                const { getJokesCacheInfo } = await import('./services/jokeService');
                const jokesInfo = await getJokesCacheInfo();
                if (jokesInfo && jokesInfo.count > 0) {
                    setJokesCacheInfo(jokesInfo);
                    caches.push({
                        key: 'jokes',
                        name: '小剧场缓存',
                        description: `小剧场对话缓存（${jokesInfo.consumed}/${jokesInfo.count} 已消费）`,
                        duration: '长期',
                        size: `约 ${(jokesInfo.count * 0.5).toFixed(0)} KB`,
                        consequence: '小剧场功能需要重新获取笑话内容',
                    });
                }
            } catch {}

            setAvailableOtherCaches(caches);
            setIsLoading(false);
        };

        void checkAvailableCaches();
    }, []);

    const totalSelected = selectedModelCaches.size + selectedOtherCaches.size;
    const hasModelCaches = cachedModelIds.length > 0;
    const hasOtherCaches = availableOtherCaches.length > 0;
    const hasAnyCache = hasModelCaches || hasOtherCaches;

    return (
        <div className='kaguya-cache-manager-overlay'>
            <div className='kaguya-cache-manager-panel'>
                <div className='kaguya-cache-manager-header'>
                    <h3>🗑️ 缓存管理</h3>
                    <button
                        type='button'
                        className='kaguya-cache-manager-close'
                        onClick={onClose}
                        disabled={isClearing}
                    >
                        ×
                    </button>
                </div>

                <div className='kaguya-cache-manager-content'>
                    {isLoading ? (
                        <div className='kaguya-cache-loading'>正在检查缓存...</div>
                    ) : !hasAnyCache ? (
                        <div className='kaguya-cache-empty-state'>
                            <div className='kaguya-cache-empty-icon'>📭</div>
                            <div className='kaguya-cache-empty-text'>暂无缓存数据</div>
                            <div className='kaguya-cache-empty-hint'>使用各项功能后会自动产生缓存</div>
                        </div>
                    ) : (
                        <>
                            {/* 模型缓存区域 */}
                            {hasModelCaches && (
                                <div className='kaguya-cache-section'>
                                    <div className='kaguya-cache-section-header'>
                                        <h4>🤖 模型缓存</h4>
                                        <label className='kaguya-cache-checkbox-all'>
                                            <input
                                                type='checkbox'
                                                checked={selectAllModels}
                                                onChange={onToggleSelectAllModels}
                                                disabled={isClearing}
                                            />
                                            <span>全选</span>
                                        </label>
                                    </div>

                                    <div className='kaguya-cache-list'>
                                        {cachedModelIds.map((modelId) => (
                                            <label
                                                key={modelId}
                                                className={`kaguya-cache-item ${selectedModelCaches.has(modelId) ? 'kaguya-cache-item-selected' : ''}`}
                                            >
                                                <input
                                                    type='checkbox'
                                                    checked={selectedModelCaches.has(modelId)}
                                                    onChange={() => onToggleModelCache(modelId)}
                                                    disabled={isClearing}
                                                />
                                                <div className='kaguya-cache-item-info'>
                                                    <span className='kaguya-cache-item-name'>{modelId}</span>
                                                    <span className='kaguya-cache-item-meta'>大小: 约 500MB - 4GB</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <div className='kaguya-cache-consequence'>
                                        <strong>⚠️ 清理后果:</strong> 选中的模型将被删除，下次使用需要重新下载，可能需要较长时间。
                                    </div>
                                </div>
                            )}

                            {/* 其他缓存区域 */}
                            {hasOtherCaches && (
                                <div className='kaguya-cache-section'>
                                    <div className='kaguya-cache-section-header'>
                                        <h4>📦 其他缓存</h4>
                                    </div>

                                    <div className='kaguya-cache-list'>
                                        {availableOtherCaches.map((cache) => (
                                            <label
                                                key={cache.key}
                                                className={`kaguya-cache-item ${selectedOtherCaches.has(cache.key) ? 'kaguya-cache-item-selected' : ''}`}
                                            >
                                                <input
                                                    type='checkbox'
                                                    checked={selectedOtherCaches.has(cache.key)}
                                                    onChange={() => onToggleOtherCache(cache.key)}
                                                    disabled={isClearing}
                                                />
                                                <div className='kaguya-cache-item-info'>
                                                    <span className='kaguya-cache-item-name'>{cache.name}</span>
                                                    <span className='kaguya-cache-item-desc'>{cache.description}</span>
                                                    <span className='kaguya-cache-item-meta'>
                                                        有效期: {cache.duration} | 大小: {cache.size}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <div className='kaguya-cache-consequence kaguya-cache-consequence-light'>
                                        <strong>💡 清理后果:</strong> 选中的缓存将被删除，下次使用时会自动重新获取。
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className='kaguya-cache-manager-footer'>
                    <div className='kaguya-cache-summary'>
                        {hasAnyCache ? (
                            <>已选择: <strong>{totalSelected}</strong> 项</>
                        ) : (
                            <span style={{ color: 'rgba(150, 175, 200, 0.6)' }}>无缓存可清理</span>
                        )}
                    </div>
                    <div className='kaguya-cache-actions'>
                        <button
                            type='button'
                            className='kaguya-cache-btn kaguya-cache-btn-cancel'
                            onClick={onClose}
                            disabled={isClearing}
                        >
                            关闭
                        </button>
                        {hasAnyCache && (
                            <button
                                type='button'
                                className='kaguya-cache-btn kaguya-cache-btn-confirm'
                                onClick={onConfirm}
                                disabled={isClearing || totalSelected === 0}
                            >
                                {isClearing ? '清理中...' : `确认清理 (${totalSelected})`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeepMode;
