// 笑话服务 - 支持批量缓存和消费

import { indexedDBCache } from '../utils/indexedDB';

const JOKES_CACHE_KEY = 'kaguya:jokes:batch';
const JOKES_FAIL_COUNT_KEY = 'kaguya:jokes:failCount';
const JOKES_LAST_FETCH_KEY = 'kaguya:jokes:lastFetch';
const MAX_JOKES_CACHE = 100; // 最大缓存100条
const MAX_FAIL_COUNT = 3; // 失败3次后停止缓存
const FETCH_COOLDOWN = 60 * 60 * 1000; // 冷却时间1小时（失败后）

interface JokesBatchCache {
    jokes: string[];
    consumed: number; // 已消费的索引
    timestamp: number;
}

// 笑话API源
type JokeAPISource = {
    url: string;
    parse: (raw: unknown) => string | null;
};

const LOCAL_JOKE_FALLBACK: string[] = [
    '程序员最浪漫的情话：你是我唯一不想缓存失效的数据。',
    '22说今天要早睡，33看了下日志：这个需求延期概率 99%。',
    '我问 AI 会不会取代我，它说：先把需求写清楚再聊这个。',
    '开会前：我们要敏捷。开会后：先把会议纪要再开个会同步一下。',
    '产品经理：这个需求很简单。程序员：那你自己写吧。',
    '22：我代码写完了。33：你确定不是代码写完了你？',
];

function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function parseItheimaJoke(raw: unknown): string | null {
    if (typeof raw === 'string') {
        const text = normalizeText(raw);
        return text.length > 0 ? text : null;
    }
    return null;
}

function parseLolimiJoke(raw: unknown): string | null {
    if (typeof raw === 'string') {
        const text = normalizeText(raw);
        return text.length > 0 ? text : null;
    }
    return null;
}

function parseJokeApiDev(raw: unknown): string | null {
    const payload = raw as {
        error?: boolean;
        type?: string;
        joke?: string;
        setup?: string;
        delivery?: string;
    };
    if (payload?.error) {
        return null;
    }
    if (payload?.type === 'single' && typeof payload.joke === 'string') {
        return normalizeText(payload.joke);
    }
    if (payload?.type === 'twopart' && typeof payload.setup === 'string' && typeof payload.delivery === 'string') {
        return normalizeText(`${payload.setup} ${payload.delivery}`);
    }
    return null;
}

const JOKE_API_SOURCES: JokeAPISource[] = [
    {
        url: 'https://api-vue-base.itheima.net/api/joke',
        parse: parseItheimaJoke,
    },
    {
        url: 'https://api.lolimi.cn/API/xiaohua/api.php',
        parse: parseLolimiJoke,
    },
    {
        url: 'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit',
        parse: parseJokeApiDev,
    },
];

function shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

async function fetchWithTimeout(url: string, timeoutMs: number = 9000): Promise<Response | null> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: 'application/json, text/plain, */*',
            },
        });
        if (!response.ok) {
            return null;
        }
        return response;
    } catch {
        return null;
    } finally {
        window.clearTimeout(timer);
    }
}

async function fetchFromAPI(source: JokeAPISource): Promise<string | null> {
    const response = await fetchWithTimeout(source.url);
    if (!response) {
        return null;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    try {
        const raw = contentType.includes('application/json')
            ? await response.json()
            : await response.text();
        const joke = source.parse(raw);
        if (!joke) {
            return null;
        }
        if (joke.length < 4 || joke.length > 280) {
            return null;
        }
        return joke;
    } catch {
        return null;
    }
}

// 获取失败次数
async function getFailCount(): Promise<number> {
    try {
        const entry = await indexedDBCache.get<number>(JOKES_FAIL_COUNT_KEY);
        return entry?.data || 0;
    } catch {
        return 0;
    }
}

// 设置失败次数
async function setFailCount(count: number): Promise<void> {
    try {
        await indexedDBCache.set(JOKES_FAIL_COUNT_KEY, count);
    } catch {}
}

// 增加失败次数
async function incrementFailCount(): Promise<number> {
    const count = await getFailCount();
    const newCount = count + 1;
    await setFailCount(newCount);
    return newCount;
}

// 重置失败次数（当成功获取笑话时调用）
async function resetFailCount(): Promise<void> {
    await setFailCount(0);
}

// 获取缓存的笑话批次
async function getJokesCache(): Promise<JokesBatchCache | null> {
    try {
        const entry = await indexedDBCache.get<JokesBatchCache>(JOKES_CACHE_KEY);
        if (!entry) return null;
        return entry.data;
    } catch {
        return null;
    }
}

// 设置笑话缓存
async function setJokesCache(cache: JokesBatchCache): Promise<void> {
    try {
        await indexedDBCache.set(JOKES_CACHE_KEY, cache);
    } catch {}
}

// 批量获取笑话并缓存
async function fetchAndCacheJokes(): Promise<boolean> {
    // 检查失败次数
    const failCount = await getFailCount();
    if (failCount >= MAX_FAIL_COUNT) {
        console.log('[JokeService] 失败次数已达上限，停止缓存');
        return false;
    }

    console.log('[JokeService] 开始批量获取笑话...');
    const jokes: string[] = [];
    const shuffledSources = shuffleArray(JOKE_API_SOURCES);
    let consecutiveFails = 0;

    // 尝试获取100条笑话
    while (jokes.length < MAX_JOKES_CACHE && consecutiveFails < 10) {
        let fetched = false;
        for (const source of shuffledSources) {
            const joke = await fetchFromAPI(source);
            if (joke) {
                jokes.push(joke);
                consecutiveFails = 0;
                fetched = true;
                if (jokes.length >= MAX_JOKES_CACHE) break;
            }
        }
        if (!fetched) {
            consecutiveFails++;
        }
    }

    if (jokes.length === 0) {
        const newFailCount = await incrementFailCount();
        console.log(`[JokeService] 获取笑话失败，当前失败次数: ${newFailCount}`);
        return false;
    }

    // 缓存成功，重置失败次数
    await resetFailCount();
    await setJokesCache({
        jokes,
        consumed: 0,
        timestamp: Date.now(),
    });
    console.log(`[JokeService] 成功缓存 ${jokes.length} 条笑话`);
    return true;
}

// 获取一个笑话（消费缓存）
export async function getCachedJoke(): Promise<string | null> {
    const cache = await getJokesCache();

    // 如果有缓存且还有未消费的
    if (cache && cache.consumed < cache.jokes.length) {
        const joke = cache.jokes[cache.consumed];
        cache.consumed++;
        await setJokesCache(cache);
        console.log(`[JokeService] 消费笑话 ${cache.consumed}/${cache.jokes.length}`);

        // 如果消费完了，后台静默补充缓存
        if (cache.consumed >= cache.jokes.length) {
            console.log('[JokeService] 笑话已消费完，后台补充缓存...');
            setTimeout(() => {
                fetchAndCacheJokes().catch(() => {});
            }, 100);
        }

        return joke;
    }

    // 没有缓存或已消费完，尝试获取新的
    const success = await fetchAndCacheJokes();
    if (success) {
        const newCache = await getJokesCache();
        if (newCache && newCache.jokes.length > 0) {
            newCache.consumed = 1;
            await setJokesCache(newCache);
            return newCache.jokes[0];
        }
    }

    // 获取失败，使用本地兜底
    console.log('[JokeService] 使用本地兜底笑话');
    return LOCAL_JOKE_FALLBACK[Math.floor(Math.random() * LOCAL_JOKE_FALLBACK.length)];
}

// 检查是否有笑话缓存
export async function hasJokesCache(): Promise<boolean> {
    const cache = await getJokesCache();
    return cache !== null && cache.jokes.length > 0;
}

// 获取笑话缓存信息
export async function getJokesCacheInfo(): Promise<{ count: number; consumed: number } | null> {
    const cache = await getJokesCache();
    if (!cache) return null;
    return {
        count: cache.jokes.length,
        consumed: cache.consumed,
    };
}

// 清理笑话缓存
export async function clearJokesCache(): Promise<void> {
    try {
        await indexedDBCache.remove(JOKES_CACHE_KEY);
        await indexedDBCache.remove(JOKES_FAIL_COUNT_KEY);
        console.log('[JokeService] 笑话缓存已清理');
    } catch {}
}

// 预加载笑话（后台静默获取）
export async function preloadJokes(): Promise<void> {
    const cache = await getJokesCache();
    if (cache && cache.consumed < cache.jokes.length) {
        // 还有未消费的，不需要预加载
        return;
    }

    // 尝试获取新缓存
    await fetchAndCacheJokes();
}

export { LOCAL_JOKE_FALLBACK };
