// 本地翻译服务 - 使用 WebLLM 翻译英文内容

export interface TranslationRequest {
    text: string;
    sourceLang: string;
    targetLang: string;
    context?: string;
}

export interface TranslationResult {
    translatedText: string;
    originalText: string;
    success: boolean;
    error?: string;
}

// 翻译缓存
const TRANSLATION_CACHE_PREFIX = 'kaguya:translation:';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天

interface TranslationCache {
    original: string;
    translated: string;
    timestamp: number;
}

// 生成缓存键
function getCacheKey(text: string, targetLang: string): string {
    // 简单哈希
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `${TRANSLATION_CACHE_PREFIX}${targetLang}_${hash}`;
}

// 获取缓存
function getCachedTranslation(text: string, targetLang: string): string | null {
    try {
        const key = getCacheKey(text, targetLang);
        const cached = localStorage.getItem(key);
        if (cached) {
            const data: TranslationCache = JSON.parse(cached);
            if (Date.now() - data.timestamp < CACHE_DURATION) {
                return data.translated;
            }
        }
    } catch {
        // 忽略错误
    }
    return null;
}

// 设置缓存
function setCachedTranslation(
    original: string,
    translated: string,
    targetLang: string
): void {
    try {
        const key = getCacheKey(original, targetLang);
        const data: TranslationCache = {
            original,
            translated,
            timestamp: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(data));
    } catch {
        // 忽略错误
    }
}

// 检测文本语言
export function detectLanguage(text: string): 'zh' | 'en' | 'other' {
    // 简单检测：如果包含大量中文字符，认为是中文
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
    const chineseRatio = chineseChars ? chineseChars.length / text.length : 0;

    if (chineseRatio > 0.3) {
        return 'zh';
    }

    // 检测英文
    const englishChars = text.match(/[a-zA-Z]/g);
    const englishRatio = englishChars ? englishChars.length / text.length : 0;

    if (englishRatio > 0.5) {
        return 'en';
    }

    return 'other';
}

// 判断是否需要翻译
export function shouldTranslate(text: string, targetLang: string = 'zh'): boolean {
    const detected = detectLanguage(text);

    if (targetLang === 'zh' && detected === 'en') {
        return true;
    }

    if (targetLang === 'en' && detected === 'zh') {
        return true;
    }

    return false;
}

// 使用 WebLLM 翻译
async function translateWithWebLLM(
    text: string,
    targetLang: string = 'zh'
): Promise<string | null> {
    try {
        // 检查 WebLLM 是否可用
        const { getWebLLMInstance } = await import('../deepmode');
        const webLLM = getWebLLMInstance?.();

        if (!webLLM || !webLLM.isReady?.()) {
            return null;
        }

        // 构建翻译 Prompt
        const prompt = buildTranslationPrompt(text, targetLang);

        // 调用 WebLLM
        const response = await webLLM.chat?.(prompt);

        if (response) {
            // 提取翻译结果
            const translated = extractTranslation(response);
            return translated;
        }
    } catch (error) {
        console.warn('WebLLM translation failed:', error);
    }

    return null;
}

// 构建翻译 Prompt
function buildTranslationPrompt(text: string, targetLang: string): string {
    const targetLangName = targetLang === 'zh' ? '中文' : 'English';

    return `请将以下文本翻译成${targetLangName}。只返回翻译结果，不要添加任何解释：

${text}

翻译：`;
}

// 提取翻译结果
function extractTranslation(response: string): string {
    // 去除可能的额外内容
    return response
        .replace(/^翻译[:：]\s*/i, '')
        .replace(/["""]/g, '')
        .trim();
}

// 主翻译函数
export async function translate(
    text: string,
    options: {
        targetLang?: string;
        useCache?: boolean;
        context?: string;
    } = {}
): Promise<TranslationResult> {
    const { targetLang = 'zh', useCache = true, context } = options;

    // 检查是否需要翻译
    if (!shouldTranslate(text, targetLang)) {
        return {
            translatedText: text,
            originalText: text,
            success: true,
        };
    }

    // 检查缓存
    if (useCache) {
        const cached = getCachedTranslation(text, targetLang);
        if (cached) {
            return {
                translatedText: cached,
                originalText: text,
                success: true,
            };
        }
    }

    // 使用 WebLLM 翻译
    const translated = await translateWithWebLLM(text, targetLang);

    if (translated) {
        // 缓存结果
        if (useCache) {
            setCachedTranslation(text, translated, targetLang);
        }

        return {
            translatedText: translated,
            originalText: text,
            success: true,
        };
    }

    // 翻译失败，返回原文
    return {
        translatedText: text,
        originalText: text,
        success: false,
        error: 'Translation service unavailable',
    };
}

// 批量翻译
export async function translateBatch(
    texts: string[],
    options: {
        targetLang?: string;
        useCache?: boolean;
    } = {}
): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];

    for (const text of texts) {
        const result = await translate(text, options);
        results.push(result);
    }

    return results;
}

// 翻译新闻内容
export async function translateNews(news: {
    title: string;
    summary?: string;
}): Promise<{ title: string; summary?: string }> {
    const [titleResult, summaryResult] = await Promise.all([
        translate(news.title, { targetLang: 'zh' }),
        news.summary ? translate(news.summary, { targetLang: 'zh' }) : null,
    ]);

    return {
        title: titleResult.translatedText,
        summary: summaryResult?.translatedText,
    };
}

// 翻译历史事件
export async function translateHistoryEvent(event: {
    title: string;
    description?: string;
}): Promise<{ title: string; description?: string }> {
    const [titleResult, descResult] = await Promise.all([
        translate(event.title, { targetLang: 'zh' }),
        event.description ? translate(event.description, { targetLang: 'zh' }) : null,
    ]);

    return {
        title: titleResult.translatedText,
        description: descResult?.translatedText,
    };
}

// 清理过期缓存
export function cleanTranslationCache(): void {
    try {
        const keysToRemove: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(TRANSLATION_CACHE_PREFIX)) {
                const cached = localStorage.getItem(key);
                if (cached) {
                    try {
                        const data: TranslationCache = JSON.parse(cached);
                        if (Date.now() - data.timestamp > CACHE_DURATION) {
                            keysToRemove.push(key);
                        }
                    } catch {
                        keysToRemove.push(key);
                    }
                }
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
        // 忽略错误
    }
}
