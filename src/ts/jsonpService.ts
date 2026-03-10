type JokeAPISource = {
    url: string;
    parse: (raw: unknown) => string | null;
};

const LOCAL_JOKE_FALLBACK: string[] = [
    '程序员最浪漫的情话：你是我唯一不想缓存失效的数据。',
    '22说今天要早睡，33看了下日志：这个需求延期概率 99%。',
    '我问 AI 会不会取代我，它说：先把需求写清楚再聊这个。',
    '开会前：我们要敏捷。开会后：先把会议纪要再开个会同步一下。',
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

// 笑话缓存
const JOKE_CACHE_KEY = 'kaguya:joke:cache';
const JOKE_CACHE_DURATION = 60 * 60 * 1000; // 1小时

interface JokeCache {
    joke: string;
    timestamp: number;
}

// 获取缓存的笑话
export function getCachedJoke(): string | null {
    try {
        const cached = localStorage.getItem(JOKE_CACHE_KEY);
        if (cached) {
            const data: JokeCache = JSON.parse(cached);
            if (Date.now() - data.timestamp < JOKE_CACHE_DURATION) {
                return data.joke;
            }
        }
    } catch {
        // 忽略错误
    }
    return null;
}

// 设置笑话缓存
function setCachedJoke(joke: string): void {
    try {
        const data: JokeCache = {
            joke,
            timestamp: Date.now(),
        };
        localStorage.setItem(JOKE_CACHE_KEY, JSON.stringify(data));
    } catch {
        // 忽略错误
    }
}

export async function fetchJokeFromAPI(): Promise<string | null> {
    // 先检查缓存
    const cached = getCachedJoke();
    if (cached) {
        return cached;
    }

    const shuffledSources = shuffleArray(JOKE_API_SOURCES);
    for (let index = 0; index < shuffledSources.length; index++) {
        const joke = await fetchFromAPI(shuffledSources[index]);
        if (joke) {
            // 缓存新笑话
            setCachedJoke(joke);
            return joke;
        }
    }
    return LOCAL_JOKE_FALLBACK[Math.floor(Math.random() * LOCAL_JOKE_FALLBACK.length)];
}
