import * as React from 'react';
import type { InitProgressReport, MLCEngineInterface, AppConfig, ModelRecord } from '@mlc-ai/web-llm';
import utils from './utils';
import { fetchHotNews, filterEntertainmentNews, filterTechNews, type NewsItem } from './newsService';
import { fetchJokeFromAPI } from './jsonpService';

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
const FALLBACK_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q0f16-MLC';
const PREMIUM_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
const SEARCH_EVAL_DEBOUNCE_MS = 780;
const IDLE_INTERVAL_MS = 18000;
const IDLE_THRESHOLD_MS = 80000;
const LLM_RETRY_COOLDOWN_MS = 12000;
const PREMIUM_RETRY_COOLDOWN_MS = 60000;
const LLM_STRATEGY_STORAGE_KEY = 'kaguya:webllm:strategy';
const TODAY_WEATHER_COMMENT_STORAGE_KEY = 'kaguya:today-weather-commented';

type StoragePersistenceState = 'unknown' | 'persisted' | 'granted' | 'denied' | 'unsupported';
type ModelTier = 'none' | 'fallback' | 'premium';

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

const buildAppConfigWithStrategy = (baseConfig: AppConfig, strategy: LLMLoadStrategy): AppConfig => {
    const modelList = baseConfig.model_list.map((item: ModelRecord) => ({ ...item }));

    return {
        model_list: modelList,
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

const DeepMode = (): JSX.Element => {
    const [panelOpen, setPanelOpen] = React.useState<boolean>(false);
    const [draft, setDraft] = React.useState<string>('');
    const [target, setTarget] = React.useState<TalkTarget>('all');
    const [llmState, setLlmState] = React.useState<LLMState>('idle');
    const [llmProgress, setLlmProgress] = React.useState<string>('未加载');
    const [activeModelTier, setActiveModelTier] = React.useState<ModelTier>('none');
    const [activeModelId, setActiveModelId] = React.useState<string>('未加载');
    const [isResponding, setIsResponding] = React.useState<boolean>(false);
    const [storagePersistence, setStoragePersistence] = React.useState<StoragePersistenceState>('unknown');
    const [messages, setMessages] = React.useState<ChatMessage[]>([
        { id: 1, role: 'system', text: '深度交互已就绪：纯文字对话 + 22/33分角色回复。' },
    ]);

    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const nextIdRef = React.useRef<number>(2);
    const openedHintRef = React.useRef<boolean>(false);
    const activeEngineRef = React.useRef<MLCEngineInterface | null>(null);
    const fallbackEngineRef = React.useRef<MLCEngineInterface | null>(null);
    const premiumEngineRef = React.useRef<MLCEngineInterface | null>(null);
    const webllmModuleRef = React.useRef<any | null>(null);
    const loadingPromiseRef = React.useRef<Promise<MLCEngineInterface | null> | null>(null);
    const premiumLoadingPromiseRef = React.useRef<Promise<void> | null>(null);
    const searchDebounceRef = React.useRef<number | null>(null);
    const lastSearchKeywordRef = React.useRef<string>('');
    const lastInteractionAtRef = React.useRef<number>(Date.now());
    const idleRunningRef = React.useRef<boolean>(false);
    const lastLoadFailedAtRef = React.useRef<number>(0);
    const premiumLastLoadFailedAtRef = React.useRef<number>(0);
    const lastWeatherAdvisorySignatureRef = React.useRef<string>('');
    const lastTodayWeatherSignatureRef = React.useRef<string>('');
    const storageCheckedRef = React.useRef<boolean>(false);
    const newsCacheRef = React.useRef<NewsItem[]>([]);
    const lastNewsFetchRef = React.useRef<number>(0);
    const newsCommentRunningRef = React.useRef<boolean>(false);

    const historyRef = React.useRef<Record<'22' | '33', CoreMessage[]>>({
        '22': [{ role: 'system', content: SYSTEM_PROMPT_22 }],
        '33': [{ role: 'system', content: SYSTEM_PROMPT_33 }],
    });

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
        webllmModuleRef.current = webllm;
        return webllm;
    }, []);

    const getStrategyOrder = React.useCallback((): LLMLoadStrategy[] => {
        const storedStrategyId = getStoredStrategyId();
        return [...LLM_LOAD_STRATEGIES].sort((a, b) => {
            if (a.id === PREFERRED_CACHE_STRATEGY_ID) {
                return -1;
            }
            if (b.id === PREFERRED_CACHE_STRATEGY_ID) {
                return 1;
            }
            if (a.id === storedStrategyId) {
                return -1;
            }
            if (b.id === storedStrategyId) {
                return 1;
            }
            return 0;
        });
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

    const hasModelInAnyStrategy = React.useCallback(async (webllm: any, modelId: string): Promise<boolean> => {
        const strategyOrder = getStrategyOrder();
        for (let index = 0; index < strategyOrder.length; index++) {
            const strategy = strategyOrder[index];
            const appConfig = buildAppConfigWithStrategy(webllm.prebuiltAppConfig, strategy);
            const hasCache = await webllm.hasModelInCache(modelId, appConfig).catch(() => false);
            if (hasCache) {
                return true;
            }
        }
        return false;
    }, [getStrategyOrder]);

    const warmupPremiumModel = React.useCallback(async (): Promise<void> => {
        if (premiumEngineRef.current || premiumLoadingPromiseRef.current) {
            return;
        }

        const now = Date.now();
        if (premiumLastLoadFailedAtRef.current && (now - premiumLastLoadFailedAtRef.current < PREMIUM_RETRY_COOLDOWN_MS)) {
            return;
        }

        premiumLoadingPromiseRef.current = (async () => {
            try {
                const webllm = await getWebLLMModule();
                const hasPremiumModel = webllm.prebuiltAppConfig.model_list.some((item: ModelRecord) => item.model_id === PREMIUM_MODEL_ID);
                if (!hasPremiumModel) {
                    pushMessage('system', `优质模型不可用：${PREMIUM_MODEL_ID} 不在可用列表。`);
                    return;
                }

                const hasPremiumCache = await hasModelInAnyStrategy(webllm, PREMIUM_MODEL_ID);
                if (storagePersistence === 'denied' && !hasPremiumCache) {
                    setLlmProgress('已启用兜底模型（未授权持久化，已跳过优质模型预热）');
                    pushMessage('system', '当前浏览器未授权持久化，且优质模型未缓存：为避免每次刷新重复下载，已自动跳过优质模型预热。');
                    return;
                }

                setLlmProgress((prev) => {
                    if (!prev || prev === '未加载') {
                        if (hasPremiumCache) {
                            return '已启用兜底模型，检测到优质模型缓存，正在激活...';
                        }
                        return '已启用兜底模型，优质模型预热中...';
                    }
                    if (prev.includes('优质模型预热中') || prev.includes('优质模型缓存')) {
                        return prev;
                    }
                    if (hasPremiumCache) {
                        return `${prev} · 检测到优质模型缓存，正在激活...`;
                    }
                    return `${prev} · 优质模型预热中...`;
                });

                const { result, lastErrorText } = await loadModelWithStrategies(webllm, PREMIUM_MODEL_ID, '优质模型预热：', true);
                if (!result) {
                    premiumLastLoadFailedAtRef.current = Date.now();
                    const hint = getWebLLMFailureHint(lastErrorText);
                    pushMessage(
                        'system',
                        `优质模型预热失败，继续使用兜底模型。${lastErrorText ? `（${lastErrorText.slice(0, 70)}）` : ''}${hint ? ` ${hint}` : ''}`,
                    );
                    return;
                }

                premiumEngineRef.current = result.engine;
                activeEngineRef.current = result.engine;
                setActiveModelTier('premium');
                setActiveModelId(PREMIUM_MODEL_ID);
                setLlmState('ready');
                setLlmProgress(`优质模型已就绪(${result.strategy.label})，已自动切换`);
                pushMessage('system', `优质模型已就绪：${PREMIUM_MODEL_ID}（${result.strategy.label}），当前优先使用优质模型。`);
                premiumLastLoadFailedAtRef.current = 0;
            } catch (error) {
                premiumLastLoadFailedAtRef.current = Date.now();
                const errorText = error instanceof Error ? error.message : String(error);
                const hint = getWebLLMFailureHint(errorText);
                pushMessage(
                    'system',
                    `优质模型预热失败，继续使用兜底模型。${errorText ? `（${errorText.slice(0, 70)}）` : ''}${hint ? ` ${hint}` : ''}`,
                );
            } finally {
                premiumLoadingPromiseRef.current = null;
            }
        })();

        await premiumLoadingPromiseRef.current;
    }, [getWebLLMModule, hasModelInAnyStrategy, loadModelWithStrategies, pushMessage, storagePersistence]);

    const ensureLLMEngine = React.useCallback(async (): Promise<MLCEngineInterface | null> => {
        if (premiumEngineRef.current) {
            activeEngineRef.current = premiumEngineRef.current;
            setActiveModelTier('premium');
            setActiveModelId(PREMIUM_MODEL_ID);
            return premiumEngineRef.current;
        }

        if (activeEngineRef.current) {
            if (!premiumEngineRef.current) {
                void warmupPremiumModel();
            }
            return activeEngineRef.current;
        }

        if (loadingPromiseRef.current) {
            return loadingPromiseRef.current;
        }

        if (llmState === 'unsupported') {
            return null;
        }

        if (llmState === 'error' && (Date.now() - lastLoadFailedAtRef.current < LLM_RETRY_COOLDOWN_MS)) {
            return null;
        }

        if (!('gpu' in navigator)) {
            setLlmState('unsupported');
            setLlmProgress('浏览器不支持 WebGPU');
            pushMessage('system', '当前浏览器不支持 WebGPU，WebLLM 无法运行。');
            return null;
        }

        loadingPromiseRef.current = (async () => {
            try {
                setLlmState('loading');
                setLlmProgress('正在加载 WebLLM...');

                const webllm = await getWebLLMModule();
                const hasFallbackModel = webllm.prebuiltAppConfig.model_list.some((item: ModelRecord) => item.model_id === FALLBACK_MODEL_ID);
                if (!hasFallbackModel) {
                    setLlmState('error');
                    setLlmProgress('兜底模型不可用');
                    pushMessage('system', `兜底模型 ${FALLBACK_MODEL_ID} 不在可用列表中。`);
                    return null;
                }

                const { result, lastErrorText } = await loadModelWithStrategies(webllm, FALLBACK_MODEL_ID, '兜底模型加载：');
                if (!result) {
                    setLlmState('error');
                    setLlmProgress('加载失败，可稍后自动重试');
                    lastLoadFailedAtRef.current = Date.now();
                    const hint = getWebLLMFailureHint(lastErrorText);
                    pushMessage(
                        'system',
                        `兜底模型加载失败，已回退本地规则回复。${lastErrorText ? `（${lastErrorText.slice(0, 70)}）` : ''}${hint ? ` ${hint}` : ''}`,
                    );
                    return null;
                }

                fallbackEngineRef.current = result.engine;
                activeEngineRef.current = result.engine;
                setActiveModelTier('fallback');
                setActiveModelId(FALLBACK_MODEL_ID);
                setLlmState('ready');
                setLlmProgress(`兜底模型已就绪(${result.strategy.label})，优质模型后台预热中...`);
                lastLoadFailedAtRef.current = 0;
                pushMessage('system', `兜底模型已就绪：${FALLBACK_MODEL_ID}（${result.strategy.label}），开始后台预热优质模型。`);
                void warmupPremiumModel();
                return result.engine;
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
            }
        })();

        return loadingPromiseRef.current;
    }, [getWebLLMModule, llmState, loadModelWithStrategies, pushMessage, warmupPremiumModel]);

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

        const backupReply = await tryGenerate(fallbackEngineRef.current);
        if (backupReply) {
            if (activeModelTier === 'premium') {
                pushMessage('system', '优质模型本次响应失败，已自动回退兜底模型继续回复。');
            }
            return backupReply;
        }

        return { text: fallbackComment, action: fallbackAction };
    }, [activeModelTier, ensureLLMEngine, pushMessage]);

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
                ? `这件事别慌，我和你站一边。先从“${userText}”里最容易的一步开始就好。`
                : `先客观看待“${userText}”。先确认目标与约束，再执行第一步。`;
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

        const backupReply = await tryAsk(fallbackEngineRef.current);
        if (backupReply) {
            if (activeModelTier === 'premium') {
                pushMessage('system', '优质模型本次响应失败，已自动回退兜底模型继续回复。');
            }
            return backupReply;
        }

        const fallbackText = roleTarget === '22'
            ? `别有压力，这题可以拆开做。先把“${userText}”里最关键的一项处理掉。`
            : `结论先给你：这件事可以推进。建议先明确优先级，再按顺序执行。`;
        history.push({ role: 'assistant', content: fallbackText });
        return {
            text: fallbackText,
            action: roleTarget === '22' ? 'curious' : 'thinking',
        };
    }, [activeModelTier, ensureLLMEngine, pushMessage]);

    const handleSearchFeedback = React.useCallback(async (keyword: string) => {
        if (!keyword || keyword.length < 2) {
            return;
        }

        markInteraction();

        const [reply22, reply33] = await Promise.all([
            requestPersonaJson(
                '22',
                `用户正在输入搜索词：${keyword}。请输出1到2句：先给情绪鼓励，再给一个检索建议，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                `这个词很有潜力，放心冲。建议先搜“${keyword} 教程/实测”快速建立判断。`,
                'curious',
            ),
            requestPersonaJson(
                '33',
                `用户正在输入搜索词：${keyword}。请输出1到2句：先给客观判断，再给一个检索策略，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                `先明确“${keyword}”是资讯、教程还是购买，再按维度筛选结果。`,
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
                const comment22 = await requestPersonaJson('22', `${NEWS_COMMENT_PROMPT_22}\n\n新闻标题：${randomEntertainment.title}`);
                if (comment22) {
                    emitAction('22', comment22.action);
                    emitBubble('22', comment22.text);
                    pushMessage('assistant22', `22 评论【${randomEntertainment.title}】：${comment22.text}`);
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));

            if (randomTech) {
                const comment33 = await requestPersonaJson('33', `${NEWS_COMMENT_PROMPT_33}\n\n新闻标题：${randomTech.title}`);
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

    const triggerJokeAndTsukkomi = React.useCallback(async () => {
        if (llmState !== 'ready') {
            return;
        }

        try {
            let jokeText: string | null = null;
            try {
                jokeText = await fetchJokeFromAPI();
            } catch {
            }

            let joke22: PersonaReply | null = null;
            if (jokeText) {
                const comment = jokeText;
                const action: Live2DAction = 'happy';
                joke22 = { text: comment, action };
            } else {
                joke22 = await requestPersonaJson('22', JOKE_PROMPT_22);
            }

            if (joke22) {
                emitAction('22', joke22.action);
                emitBubble('22', joke22.text);
                pushMessage('assistant22', `22：${joke22.text}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 1500));

            const tsukkomi33 = await requestPersonaJson('33', TSUKKOMI_PROMPT_33);
            if (tsukkomi33) {
                emitAction('33', tsukkomi33.action);
                emitBubble('33', tsukkomi33.text);
                pushMessage('assistant33', `33：${tsukkomi33.text}`);
            }

            markInteraction();
        } catch {
        }
    }, [emitAction, emitBubble, llmState, markInteraction, pushMessage, requestPersonaJson]);

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

    const togglePanel = React.useCallback(() => {
        setPanelOpen((prev: boolean) => !prev);
    }, []);

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

        void ensureLLMEngine();
    }, [ensureLLMEngine, ensurePersistentStorage, panelOpen, pushMessage]);

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
                    void triggerJokeAndTsukkomi();
                } else {
                    void triggerIdleInteraction();
                }
            }
        }, IDLE_INTERVAL_MS);

        return () => {
            window.clearInterval(timer);
        };
    }, [triggerIdleInteraction, triggerNewsComment, triggerJokeAndTsukkomi]);

    const wasPageVisibleRef = React.useRef<boolean>(true);
    const enginesPausedRef = React.useRef<boolean>(false);

    React.useEffect(() => {
        const unloadEngines = (): void => {
            const engineList = [
                activeEngineRef.current,
                fallbackEngineRef.current,
                premiumEngineRef.current,
            ].filter((item): item is MLCEngineInterface => Boolean(item));
            const uniqueEngineList = Array.from(new Set(engineList));
            uniqueEngineList.forEach((engine) => {
                void engine.unload();
            });
            activeEngineRef.current = null;
            fallbackEngineRef.current = null;
            premiumEngineRef.current = null;
            enginesPausedRef.current = true;
            setLlmState('idle');
            setActiveModelTier('none');
            setActiveModelId('已暂停（页面不可见）');
        };

        const handleVisibilityChange = (isVisible: boolean): void => {
            if (isVisible && !wasPageVisibleRef.current && enginesPausedRef.current) {
                enginesPausedRef.current = false;
                setLlmProgress('页面已激活，正在恢复...');
                if (panelOpen && storageCheckedRef.current) {
                    void ensureLLMEngine();
                }
            } else if (!isVisible && wasPageVisibleRef.current && llmState === 'ready') {
                unloadEngines();
                pushMessage('system', '页面不可见，已暂停 WebLLM 以节省内存。');
            }
            wasPageVisibleRef.current = isVisible;
        };

        const removeListener = utils.addVisibilityListener(handleVisibilityChange);
        return removeListener;
    }, [ensureLLMEngine, panelOpen, pushMessage, llmState]);

    React.useEffect(() => {
        return () => {
            if (searchDebounceRef.current !== null) {
                window.clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
            }
            const engineList = [
                activeEngineRef.current,
                fallbackEngineRef.current,
                premiumEngineRef.current,
            ].filter((item): item is MLCEngineInterface => Boolean(item));
            const uniqueEngineList = Array.from(new Set(engineList));
            uniqueEngineList.forEach((engine) => {
                void engine.unload();
            });
            activeEngineRef.current = null;
            fallbackEngineRef.current = null;
            premiumEngineRef.current = null;
            webllmModuleRef.current = null;
            loadingPromiseRef.current = null;
            premiumLoadingPromiseRef.current = null;
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
    const modelTierText = activeModelTier === 'premium'
        ? '优质模型'
        : (activeModelTier === 'fallback' ? '兜底模型' : '未启用');

    return (
        <div className='kaguya-deep'>
            <button
                className={`kaguya-deep-trigger${panelOpen ? ' kaguya-deep-trigger-active' : ''}`}
                type='button'
                onClick={togglePanel}
                ref={triggerRef}
                aria-label='Open deep interaction panel'
                aria-expanded={panelOpen}
            >
                <svg viewBox='0 0 24 24' aria-hidden='true'>
                    <path d='M12 3.5c-4.9 0-8.8 3.3-8.8 7.3 0 2.3 1.3 4.3 3.4 5.6v3.8l3.1-2a10.9 10.9 0 0 0 2.3.3c4.9 0 8.8-3.3 8.8-7.3S16.9 3.5 12 3.5zm-3 7.4a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm3 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm3 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2z' />
                </svg>
            </button>

            <div className={`kaguya-deep-panel${panelOpen ? ' kaguya-deep-panel-visible' : ''}`} ref={panelRef}>
                <div className='kaguya-deep-head'>
                    <div className='kaguya-deep-title'>深度交互</div>
                    <button className='kaguya-deep-close' type='button' onClick={() => setPanelOpen(false)} aria-label='Close panel'>
                        ×
                    </button>
                </div>

                <div className='kaguya-deep-meta'>模式：纯文字 · WebLLM：{llmText}</div>
                <div className='kaguya-deep-meta'>WebLLM：{llmProgress}</div>
                <div className='kaguya-deep-meta'>当前模型：{activeModelId}（{modelTierText}）</div>
                <div className='kaguya-deep-meta'>模型缓存：{storageText}</div>

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
                    <button
                        type='button'
                        className='kaguya-deep-action-btn'
                        onClick={() => void triggerJokeAndTsukkomi()}
                        disabled={llmState !== 'ready' || isResponding}
                    >
                        🎭 讲笑话+吐槽
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
    );
};

export default DeepMode;
