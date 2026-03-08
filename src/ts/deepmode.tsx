import * as React from 'react';
import type { InitProgressReport, MLCEngineInterface, AppConfig, ModelRecord } from '@mlc-ai/web-llm';

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

const MAX_MESSAGES = 18;
const MAX_CONTEXT_MESSAGES = 10;
const DEFAULT_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const SEARCH_EVAL_DEBOUNCE_MS = 780;
const IDLE_INTERVAL_MS = 18000;
const IDLE_THRESHOLD_MS = 80000;
const LLM_RETRY_COOLDOWN_MS = 12000;
const LLM_STRATEGY_STORAGE_KEY = 'kaguya:webllm:strategy';

type LLMLoadStrategy = {
    id: 'cache-api' | 'cache-api-mirror' | 'indexeddb';
    label: string;
    useIndexedDBCache: boolean;
    useMirror: boolean;
};

const LLM_LOAD_STRATEGIES: LLMLoadStrategy[] = [
    { id: 'cache-api', label: 'CacheAPI', useIndexedDBCache: false, useMirror: false },
    { id: 'cache-api-mirror', label: 'CacheAPI-Mirror', useIndexedDBCache: false, useMirror: true },
    { id: 'indexeddb', label: 'IndexedDB', useIndexedDBCache: true, useMirror: false },
];

const wait = (ms: number): Promise<void> => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

const withMirrorHost = (url: string): string => {
    return url.startsWith('https://huggingface.co/')
        ? url.replace('https://huggingface.co/', 'https://hf-mirror.com/')
        : url;
};

const buildAppConfigWithStrategy = (baseConfig: AppConfig, strategy: LLMLoadStrategy): AppConfig => {
    const modelList = strategy.useMirror
        ? baseConfig.model_list.map((item: ModelRecord) => ({
            ...item,
            model: withMirrorHost(item.model),
        }))
        : baseConfig.model_list.map((item: ModelRecord) => ({ ...item }));

    return {
        model_list: modelList,
        useIndexedDBCache: strategy.useIndexedDBCache,
    };
};

const getStoredStrategyId = (): LLMLoadStrategy['id'] | null => {
    try {
        const value = window.localStorage.getItem(LLM_STRATEGY_STORAGE_KEY);
        if (value === 'cache-api' || value === 'cache-api-mirror' || value === 'indexeddb') {
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

const SYSTEM_PROMPT_22 = '你是2233中的22。风格热情、可爱、主动，每次回复1到2句中文。';
const SYSTEM_PROMPT_33 = '你是2233中的33。风格冷静、克制、理性，每次回复1到2句中文。';

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
    const [isResponding, setIsResponding] = React.useState<boolean>(false);
    const [messages, setMessages] = React.useState<ChatMessage[]>([
        { id: 1, role: 'system', text: '深度交互已就绪：纯文字对话 + 22/33分角色回复。' },
    ]);

    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const nextIdRef = React.useRef<number>(2);
    const openedHintRef = React.useRef<boolean>(false);
    const engineRef = React.useRef<MLCEngineInterface | null>(null);
    const loadingPromiseRef = React.useRef<Promise<MLCEngineInterface | null> | null>(null);
    const searchDebounceRef = React.useRef<number | null>(null);
    const lastSearchKeywordRef = React.useRef<string>('');
    const lastInteractionAtRef = React.useRef<number>(Date.now());
    const idleRunningRef = React.useRef<boolean>(false);
    const lastLoadFailedAtRef = React.useRef<number>(0);

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

    const ensureLLMEngine = React.useCallback(async (): Promise<MLCEngineInterface | null> => {
        if (engineRef.current) {
            return engineRef.current;
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

                const webllm = await import('@mlc-ai/web-llm');
                const hasModel = webllm.prebuiltAppConfig.model_list.some((item) => item.model_id === DEFAULT_MODEL_ID);
                if (!hasModel) {
                    setLlmState('error');
                    setLlmProgress('模型不可用');
                    pushMessage('system', `WebLLM 模型 ${DEFAULT_MODEL_ID} 不在可用列表中。`);
                    return null;
                }

                const storedStrategyId = getStoredStrategyId();
                const strategyOrder = [...LLM_LOAD_STRATEGIES].sort((a, b) => {
                    if (a.id === storedStrategyId) {
                        return -1;
                    }
                    if (b.id === storedStrategyId) {
                        return 1;
                    }
                    return 0;
                });

                let lastErrorText = '';
                for (let strategyIndex = 0; strategyIndex < strategyOrder.length; strategyIndex++) {
                    const strategy = strategyOrder[strategyIndex];
                    const appConfig = buildAppConfigWithStrategy(webllm.prebuiltAppConfig, strategy);
                    const hasCachedModel = await webllm.hasModelInCache(DEFAULT_MODEL_ID, appConfig).catch(() => false);
                    if (hasCachedModel) {
                        setLlmProgress(`命中本地缓存(${strategy.label})，正在恢复...`);
                    }

                    for (let attempt = 1; attempt <= 2; attempt++) {
                        try {
                            const engine = await webllm.CreateMLCEngine(DEFAULT_MODEL_ID, {
                                appConfig,
                                initProgressCallback: (report: InitProgressReport) => {
                                    const percent = Math.max(0, Math.min(100, Math.round(report.progress * 100)));
                                    setLlmProgress(`${percent}% ${report.text}`);
                                },
                            });

                            engineRef.current = engine;
                            setLlmState('ready');
                            setLlmProgress(`模型已就绪(${strategy.label})`);
                            lastLoadFailedAtRef.current = 0;
                            setStoredStrategyId(strategy.id);
                            pushMessage('system', `WebLLM 就绪：${DEFAULT_MODEL_ID}（${strategy.label}）`);
                            return engine;
                        } catch (error) {
                            lastErrorText = error instanceof Error ? error.message : String(error);
                            const canCleanupAndRetry = attempt === 1 && hasCachedModel;
                            if (canCleanupAndRetry) {
                                setLlmProgress(`检测到缓存异常，清理后重试(${strategy.label})...`);
                                await webllm.deleteModelAllInfoInCache(DEFAULT_MODEL_ID, appConfig).catch((): void => {});
                                await wait(220);
                                continue;
                            }
                            break;
                        }
                    }
                }

                setLlmState('error');
                setLlmProgress('加载失败，可稍后自动重试');
                lastLoadFailedAtRef.current = Date.now();
                pushMessage('system', `WebLLM 加载失败，已回退本地规则回复。${lastErrorText ? `（${lastErrorText.slice(0, 70)}）` : ''}`);
                return null;
            } catch (error) {
                const errorText = error instanceof Error ? error.message : String(error);
                setLlmState('error');
                setLlmProgress('加载失败，可稍后重试');
                lastLoadFailedAtRef.current = Date.now();
                pushMessage('system', `WebLLM 加载失败，已自动回退到本地规则回复。${errorText ? `（${errorText.slice(0, 70)}）` : ''}`);
                return null;
            } finally {
                loadingPromiseRef.current = null;
            }
        })();

        return loadingPromiseRef.current;
    }, [llmState, pushMessage]);

    const requestPersonaJson = React.useCallback(async (
        roleTarget: '22' | '33',
        prompt: string,
        fallbackComment: string,
        fallbackAction: Live2DAction,
    ): Promise<PersonaReply> => {
        const engine = await ensureLLMEngine();
        if (!engine) {
            return { text: fallbackComment, action: fallbackAction };
        }

        try {
            const system = roleTarget === '22'
                ? `${SYSTEM_PROMPT_22} 你需要输出 JSON。`
                : `${SYSTEM_PROMPT_33} 你需要输出 JSON。`;

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
                return { text: fallbackComment, action: fallbackAction };
            }

            return { text: parsed.comment, action: parsed.action };
        } catch {
            return { text: fallbackComment, action: fallbackAction };
        }
    }, [ensureLLMEngine]);

    const askModel = React.useCallback(async (roleTarget: '22' | '33', userText: string): Promise<PersonaReply> => {
        const engine = await ensureLLMEngine();
        const history = historyRef.current[roleTarget];
        history.push({ role: 'user', content: userText });

        if (history.length > MAX_CONTEXT_MESSAGES + 1) {
            history.splice(1, history.length - (MAX_CONTEXT_MESSAGES + 1));
        }

        if (!engine) {
            const fallbackText = roleTarget === '22' ? `这个话题我很感兴趣：${userText}` : `收到：${userText}`;
            const fallbackAction = roleTarget === '22' ? 'happy' : 'calm';
            history.push({ role: 'assistant', content: fallbackText });
            return { text: fallbackText, action: fallbackAction };
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
            const fallbackText = roleTarget === '22' ? `这个话题我很感兴趣：${userText}` : `收到：${userText}`;
            history.push({ role: 'assistant', content: fallbackText });
            return {
                text: fallbackText,
                action: roleTarget === '22' ? 'happy' : 'calm',
            };
        }
    }, [ensureLLMEngine]);

    const handleSearchFeedback = React.useCallback(async (keyword: string) => {
        if (!keyword || keyword.length < 2) {
            return;
        }

        markInteraction();

        const [reply22, reply33] = await Promise.all([
            requestPersonaJson(
                '22',
                `用户正在输入搜索词：${keyword}。请给一句热情点评，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                `22觉得“${keyword}”很有意思，快搜一下看看！`,
                'curious',
            ),
            requestPersonaJson(
                '33',
                `用户正在输入搜索词：${keyword}。请给一句偏冷静的点评，并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}`,
                `33建议先明确“${keyword}”的关键词再搜索。`,
                'calm',
            ),
        ]);

        pushMessage('assistant22', `22（搜索）：${reply22.text}`);
        pushMessage('assistant33', `33（搜索）：${reply33.text}`);
        emitAction('22', reply22.action);
        emitAction('33', reply33.action);
        emitBubble('22', reply22.text);
        emitBubble('33', reply33.text);
    }, [emitAction, emitBubble, markInteraction, pushMessage, requestPersonaJson]);

    const triggerIdleInteraction = React.useCallback(async () => {
        if (idleRunningRef.current || llmState !== 'ready') {
            return;
        }

        idleRunningRef.current = true;
        try {
            const [idle22, idle33] = await Promise.all([
                requestPersonaJson(
                    '22',
                    '当前是待机状态，请给一句热情的短句（12字以内）并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}',
                    '22正在待机，随时准备帮你。',
                    'happy',
                ),
                requestPersonaJson(
                    '33',
                    '当前是待机状态，请给一句冷静的短句（12字以内）并返回 JSON：{"comment":"...","action":"happy|curious|thinking|calm|surprised"}',
                    '33待命中。',
                    'calm',
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

        void ensureLLMEngine();
    }, [ensureLLMEngine, panelOpen, pushMessage]);

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
        const timer = window.setInterval(() => {
            const now = Date.now();
            const idleTooLong = now - lastInteractionAtRef.current >= IDLE_THRESHOLD_MS;
            if (idleTooLong) {
                void triggerIdleInteraction();
            }
        }, IDLE_INTERVAL_MS);

        return () => {
            window.clearInterval(timer);
        };
    }, [triggerIdleInteraction]);

    React.useEffect(() => {
        return () => {
            if (searchDebounceRef.current !== null) {
                window.clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
            }
            if (engineRef.current) {
                void engineRef.current.unload();
            }
            engineRef.current = null;
        };
    }, []);

    const llmText = llmState === 'ready'
        ? '就绪'
        : (llmState === 'loading' ? '加载中' : (llmState === 'error' ? '失败' : (llmState === 'unsupported' ? '不支持' : '未加载')));

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
