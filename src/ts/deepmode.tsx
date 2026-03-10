import * as React from 'react';
import type { InitProgressReport, MLCEngineInterface, AppConfig, ModelRecord } from '@mlc-ai/web-llm';
import { fetchHotNews, filterEntertainmentNews, filterTechNews, type NewsItem } from './newsService';
import { fetchJokeFromAPI } from './jsonpService';
import { SkitEngine } from './skit/engine';
import { getRandomHistoryEvent, formatHistoryForCharacter } from './services/historyToday';

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
    const [storagePersistence, setStoragePersistence] = React.useState<StoragePersistenceState>('unknown');
    const [messages, setMessages] = React.useState<ChatMessage[]>([
        { id: 1, role: 'system', text: '深度交互已就绪：纯文字对话 + 22/33分角色回复。' },
    ]);
    // 纯净模式状态
    const [pureMode, setPureMode] = React.useState<boolean>(false);
    // 抽屉动画状态
    const [drawerVisible, setDrawerVisible] = React.useState<boolean>(false);

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

    const pushMessage = React.useCallback((role: MessageRole, text: string) => {
        setMessages((prev: ChatMessage[]) => {
            const next = [...prev, { id: nextIdRef.current, role, text }];
            nextIdRef.current += 1;
            return next.slice(-MAX_MESSAGES);
        });
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

    const ensureLLMEngine = React.useCallback(async (requestedModel?: string): Promise<MLCEngineInterface | null> => {
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
                        const retry = await loadModelWithStrategies(webllm, autoModel, `${getModelDisplayName(autoModel)} 加载：`);
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
                let loadResult = await loadModelWithStrategies(webllm, targetModel, `${getModelDisplayName(targetModel)} 加载：`);
                if (!loadResult.result) {
                    const downgraded = getDowngradedModel(targetModel, availableModelSet);
                    if (downgraded) {
                        setLlmProgress(`${getModelDisplayName(targetModel)} 加载失败，降级到 ${getModelDisplayName(downgraded)}...`);
                        const downgradeResult = await loadModelWithStrategies(webllm, downgraded, `${getModelDisplayName(downgraded)} 加载：`);
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
    }, [emitAction, emitBubble, markInteraction, pushMessage, requestPersonaJson]);

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

        lastTodayWeatherSignatureRef.current = signature;
        const summary = `${detail.today.dateKey} ${detail.today.weatherText} ${detail.today.min}~${detail.today.max}°`;
        const fallback22 = `今天${detail.location}${detail.today.weatherText}，但节奏别乱，你状态在线。建议按${detail.today.min}到${detail.today.max}度调整穿搭再出门。`;
        const fallback33 = `客观结论：今天${summary}。建议按温差准备衣物，并预留通勤缓冲时间。`;

        const [reply22, reply33] = await Promise.all([
            requestPersonaJson(
                '22',
                `请基于今天的天气输出1到2句：先给情绪鼓励，再给可执行建议。地点：${detail.location}；天气：${summary}；数据源：${detail.provider}。输出 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                fallback22,
                'happy',
            ),
            requestPersonaJson(
                '33',
                `请基于今天的天气输出1到2句：先给客观判断，再给可执行策略。地点：${detail.location}；天气：${summary}；数据源：${detail.provider}。输出 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                fallback33,
                'thinking',
            ),
        ]);

        pushMessage('assistant22', `22（今天天气）：${reply22.text}`);
        pushMessage('assistant33', `33（今天天气）：${reply33.text}`);
        emitAction('22', reply22.action);
        emitAction('33', reply33.action);
        emitBubble('22', reply22.text);
        emitBubble('33', reply33.text);

        try {
            window.sessionStorage.setItem(TODAY_WEATHER_COMMENT_STORAGE_KEY, detail.today.dateKey);
        } catch {
            // ignore session storage failures
        }
    }, [emitAction, emitBubble, pushMessage, requestPersonaJson]);

    const triggerIdleInteraction = React.useCallback(async () => {
        if (idleRunningRef.current || llmState !== 'ready') {
            return;
        }

        idleRunningRef.current = true;
        try {
            const [idle22, idle33] = await Promise.all([
                requestPersonaJson(
                    '22',
                    '当前是待机状态，请给1到2句短句：先给情绪价值，再给一个可执行小建议，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}',
                    '我在这儿陪你，状态拉满。想推进事情时，先做一个最小动作就好。',
                    'happy',
                ),
                requestPersonaJson(
                    '33',
                    '当前是待机状态，请给1到2句短句：先给客观判断，再给一个可执行小建议，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}',
                    '当前无异常，节奏可控。建议先确定下一件最高优先级任务。',
                    'thinking',
                ),
            ]);

            pushMessage('assistant22', `22（待机）：${idle22.text}`);
            pushMessage('assistant33', `33（待机）：${idle33.text}`);
            emitAction('22', idle22.action);
            emitAction('33', idle33.action);
            emitBubble('22', idle22.text);
            emitBubble('33', idle33.text);
            markInteraction();
        } finally {
            idleRunningRef.current = false;
        }
    }, [emitAction, emitBubble, llmState, markInteraction, pushMessage, requestPersonaJson]);

    const triggerNewsComment = React.useCallback(async () => {
        if (newsCommentRunningRef.current || llmState !== 'ready') {
            return;
        }

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

            if (randomEntertainment) {
                const comment22 = await requestPersonaJson(
                    '22',
                    `${NEWS_COMMENT_PROMPT_22}\n\n新闻标题：${randomEntertainment.title}`,
                    `这条新闻有点意思，我先记下重点：${randomEntertainment.title}`,
                    'curious',
                );
                if (comment22) {
                    emitAction('22', comment22.action);
                    emitBubble('22', comment22.text);
                    pushMessage('assistant22', `22 评论【${randomEntertainment.title}】：${comment22.text}`);
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));

            if (randomTech) {
                const comment33 = await requestPersonaJson(
                    '33',
                    `${NEWS_COMMENT_PROMPT_33}\n\n新闻标题：${randomTech.title}`,
                    `这条信息的核心在于可验证性与影响范围：${randomTech.title}`,
                    'thinking',
                );
                if (comment33) {
                    emitAction('33', comment33.action);
                    emitBubble('33', comment33.text);
                    pushMessage('assistant33', `33 评论【${randomTech.title}】：${comment33.text}`);
                }
            }

            markInteraction();
        } finally {
            newsCommentRunningRef.current = false;
        }
    }, [emitAction, emitBubble, llmState, markInteraction, pushMessage, requestPersonaJson]);

    // 历史上的今天按钮功能 - 使用 LLM 生成
    const triggerHistoryToday = React.useCallback(async () => {
        if (isResponding || llmState !== 'ready') {
            pushMessage('system', llmState !== 'ready' ? '模型未就绪，请稍后再试。' : '正在处理中...');
            return;
        }

        setIsResponding(true);
        pushMessage('system', '正在生成历史上的今天...');

        try {
            const today = new Date();
            const month = today.getMonth() + 1;
            const day = today.getDate();

            // 22 用活泼的方式讲述历史
            const reply22 = await requestPersonaJson(
                '22',
                `今天是${month}月${day}日。请讲述一个历史上今天发生的有趣事件。要求：1)选择轻松有趣或励志的历史事件；2)用22娘活泼可爱的语气讲述；3)控制在2-3句话；4)输出JSON格式：{"comment":"讲述内容","action":"happy|curious|thinking"}`,
                `今天是${month}月${day}日，历史上有很多有趣的事情发生呢！让我给你讲一个好玩的故事吧~`,
                'curious',
            );

            emitAction('22', reply22.action);
            emitBubble('22', reply22.text);
            pushMessage('assistant22', `22（历史上的今天）：${reply22.text}`);

            // 延迟一下让对话更自然
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 33 用冷静的方式补充或评论
            const reply33 = await requestPersonaJson(
                '33',
                `今天是${month}月${day}日。请从另一个角度讲述一个历史上今天发生的事件，或者对22刚才讲的内容进行冷静客观的补充/分析。要求：1)选择科技、政治或经济相关的历史事件；2)用33娘冷静理性的语气；3)控制在2-3句话；4)输出JSON格式：{"comment":"讲述内容","action":"thinking|calm"}`,
                `客观来说，${month}月${day}日在历史上确实有一些值得关注的事件。建议从多个维度了解历史。`,
                'thinking',
            );

            emitAction('33', reply33.action);
            emitBubble('33', reply33.text);
            pushMessage('assistant33', `33（历史上的今天）：${reply33.text}`);

            markInteraction();
        } catch (error) {
            pushMessage('system', '生成历史内容失败，请稍后重试。');
        } finally {
            setIsResponding(false);
        }
    }, [emitAction, emitBubble, isResponding, llmState, markInteraction, pushMessage, requestPersonaJson]);

    // 小剧场按钮功能 - 使用笑话接口 + LLM 生成对话
    const triggerSkit = React.useCallback(async () => {
        if (isResponding || llmState !== 'ready') {
            pushMessage('system', llmState !== 'ready' ? '模型未就绪，请稍后再试。' : '正在处理中...');
            return;
        }

        setIsResponding(true);
        pushMessage('system', '小剧场即将开始...');

        try {
            // 获取一个笑话
            const joke = await fetchJokeFromAPI();
            const jokeContent = joke?.content || '为什么程序员总是分不清圣诞节和万圣节？因为 31 OCT = 25 DEC。';

            // 22 用活泼的方式讲笑话
            const reply22 = await requestPersonaJson(
                '22',
                `请讲一个笑话：${jokeContent}。要求：1)用22娘活泼可爱的语气讲述；2)可以适当发挥，让笑话更有趣；3)控制在2-3句话；4)输出JSON格式：{"comment":"笑话内容","action":"happy|curious"}`,
                `哈哈，我给你讲个好玩的！${jokeContent}`,
                'happy',
            );

            emitAction('22', reply22.action);
            emitBubble('22', reply22.text);
            pushMessage('assistant22', `22（小剧场）：${reply22.text}`);

            // 延迟一下让吐槽更自然
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 33 用冷静的方式吐槽
            const reply33 = await requestPersonaJson(
                '33',
                `22刚才讲了这个笑话："${reply22.text}"。请用33娘冷静理性带点腹黑的方式吐槽。要求：1)吐槽要犀利但幽默；2)可以指出笑点或者逻辑漏洞；3)控制在1-2句话；4)输出JSON格式：{"comment":"吐槽内容","action":"thinking|calm"}`,
                `...这个笑话的逻辑有待商榷。不过，你开心就好。`,
                'thinking',
            );

            emitAction('33', reply33.action);
            emitBubble('33', reply33.text);
            pushMessage('assistant33', `33（小剧场）：${reply33.text}`);

            markInteraction();
        } catch (error) {
            pushMessage('system', '小剧场发生错误。');
        } finally {
            setIsResponding(false);
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

    const handlePauseEngine = React.useCallback((): void => {
        if (activeEngineRef.current) {
            void activeEngineRef.current.unload();
        }
        activeEngineRef.current = null;
        setEnginePaused(true);
        setLlmState('idle');
        setActiveModelId('已暂停');
        setLlmProgress('进程已暂停');
        pushMessage('system', 'WebLLM 进程已暂停。');
    }, [pushMessage]);

    const handleResumeEngine = React.useCallback((): void => {
        setEnginePaused(false);
        setLlmProgress('正在恢复进程...');
        if (panelOpen && storageCheckedRef.current) {
            const nextTargetModel = resolveTargetModel(modelPreference, recommendedModelId, new Set(allModelIds));
            void ensureLLMEngine(nextTargetModel);
        }
        pushMessage('system', 'WebLLM 进程恢复中...');
    }, [allModelIds, ensureLLMEngine, modelPreference, panelOpen, pushMessage, recommendedModelId, resolveTargetModel]);

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
                                    onClick={handlePauseEngine}
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
                                disabled={isResponding}
                            >
                                🎭 小剧场
                            </button>
                            {/* 历史上的今天按钮 */}
                            <button
                                type='button'
                                className='kaguya-deep-action-btn'
                                onClick={() => void triggerHistoryToday()}
                                disabled={isResponding}
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

export default DeepMode;
