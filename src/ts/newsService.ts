import { indexedDBCache } from './utils/indexedDB';

type NewsItem = {
    title: string;
    url: string;
    source: string;
    category: 'entertainment' | 'tech' | 'social' | 'general';
};

type NewsResponse = {
    items: NewsItem[];
    timestamp: number;
};

type NewsAPISource = {
    url: string;
    source: string;
    category: NewsItem['category'];
    parser: (data: unknown, source: NewsAPISource) => NewsItem[];
};

type Rss2JsonResponse = {
    status?: string;
    items?: Array<{
        title?: string;
        link?: string;
    }>;
};

type HackerNewsResponse = {
    hits?: Array<{
        title?: string;
        url?: string;
        story_url?: string;
    }>;
};

type GithubTrendingResponse = {
    items?: Array<{
        full_name?: string;
        html_url?: string;
        description?: string;
    }>;
};

// 新闻缓存配置 - 3小时
const NEWS_CACHE_KEY = 'kaguya:news:cache';
const NEWS_CACHE_DURATION = 3 * 60 * 60 * 1000; // 3小时

const RSS2JSON_ENDPOINT = 'https://api.rss2json.com/v1/api.json?rss_url=';

const LOCAL_NEWS_FALLBACK: NewsItem[] = [
    { title: '今日热点暂时不可用，稍后自动重试。', url: '', source: '系统兜底', category: 'general' },
    { title: '建议优先查看科技与娱乐模块的最新站点动态。', url: '', source: '系统兜底', category: 'tech' },
    { title: '22/33 会在接口恢复后自动推送新热点评论。', url: '', source: '系统兜底', category: 'entertainment' },
];

const NEWS_API_SOURCES: NewsAPISource[] = [
    {
        url: `${RSS2JSON_ENDPOINT}${encodeURIComponent('https://www.ithome.com/rss/')}`,
        source: 'IT之家',
        category: 'tech',
        parser: parseRss2Json,
    },
    {
        url: `${RSS2JSON_ENDPOINT}${encodeURIComponent('https://www.huxiu.com/rss/0.xml')}`,
        source: '虎嗅',
        category: 'tech',
        parser: parseRss2Json,
    },
    {
        url: `${RSS2JSON_ENDPOINT}${encodeURIComponent('https://www.gcores.com/rss')}`,
        source: '机核',
        category: 'entertainment',
        parser: parseRss2Json,
    },
    {
        url: `${RSS2JSON_ENDPOINT}${encodeURIComponent('https://www.bbc.com/zhongwen/simp/index.xml')}`,
        source: 'BBC 中文',
        category: 'social',
        parser: parseRss2Json,
    },
    {
        url: 'https://hn.algolia.com/api/v1/search?tags=front_page',
        source: 'Hacker News',
        category: 'tech',
        parser: parseHackerNews,
    },
    {
        url: 'https://api.github.com/search/repositories?q=created:%3E2026-01-01&sort=stars&order=desc&per_page=20',
        source: 'GitHub Trending',
        category: 'tech',
        parser: parseGithubTrending,
    },
];

function parseRss2Json(data: unknown, source: NewsAPISource): NewsItem[] {
    const response = data as Rss2JsonResponse;
    if (response?.status !== 'ok' || !Array.isArray(response?.items)) {
        return [];
    }
    return response.items
        .filter((item) => typeof item?.title === 'string' && item.title.trim())
        .slice(0, 12)
        .map((item) => ({
            title: (item.title || '').trim(),
            url: typeof item.link === 'string' ? item.link : '',
            source: source.source,
            category: source.category,
        }));
}

function parseHackerNews(data: unknown, source: NewsAPISource): NewsItem[] {
    const response = data as HackerNewsResponse;
    if (!Array.isArray(response?.hits)) {
        return [];
    }
    return response.hits
        .filter((item) => typeof item?.title === 'string' && item.title.trim())
        .slice(0, 10)
        .map((item) => ({
            title: (item.title || '').trim(),
            url: (item.url || item.story_url || '').trim(),
            source: source.source,
            category: source.category,
        }));
}

function parseGithubTrending(data: unknown, source: NewsAPISource): NewsItem[] {
    const response = data as GithubTrendingResponse;
    if (!Array.isArray(response?.items)) {
        return [];
    }
    return response.items
        .filter((item) => typeof item?.full_name === 'string' && item.full_name.trim())
        .slice(0, 10)
        .map((item) => {
            const description = typeof item.description === 'string' ? item.description.trim() : '';
            const title = description ? `${item.full_name} - ${description}` : (item.full_name || '');
            return {
                title,
                url: (item.html_url || '').trim(),
                source: source.source,
                category: source.category,
            };
        });
}

function shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number = 9000): Promise<unknown | null> {
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
        return await response.json();
    } catch {
        return null;
    } finally {
        window.clearTimeout(timer);
    }
}

async function fetchFromAPI(source: NewsAPISource): Promise<NewsItem[]> {
    const data = await fetchJsonWithTimeout(source.url);
    if (!data) {
        return [];
    }
    try {
        return source.parser(data, source);
    } catch {
        return [];
    }
}

// 从 IndexDB 获取缓存
async function getCachedNews(): Promise<NewsResponse | null> {
    try {
        const entry = await indexedDBCache.get<NewsItem[]>(NEWS_CACHE_KEY);
        if (!entry) return null;

        // 检查是否过期
        if (Date.now() - entry.timestamp > NEWS_CACHE_DURATION) {
            return null;
        }

        return {
            items: entry.data,
            timestamp: entry.timestamp,
        };
    } catch {
        return null;
    }
}

// 设置缓存到 IndexDB
async function setCachedNews(items: NewsItem[]): Promise<void> {
    try {
        await indexedDBCache.set(NEWS_CACHE_KEY, items);
    } catch {
        // ignore storage quota issues
    }
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.title.toLowerCase().trim();
        if (!key || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

export async function fetchHotNews(forceRefresh = false): Promise<NewsItem[]> {
    // 如果不是强制刷新，先检查缓存
    if (!forceRefresh) {
        const cached = await getCachedNews();
        if (cached && cached.items.length > 0) {
            return cached.items;
        }
    }

    const shuffled = shuffleArray(NEWS_API_SOURCES);
    const selected = shuffled.slice(0, 5);
    const results = await Promise.allSettled(selected.map((source) => fetchFromAPI(source)));

    const merged: NewsItem[] = [];
    results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            merged.push(...result.value);
        }
    });

    const deduped = dedupeNews(merged).slice(0, 24);
    if (deduped.length > 0) {
        await setCachedNews(deduped);
        return deduped;
    }

    // 如果获取失败，返回缓存数据（即使已过期）
    const cached = await getCachedNews();
    if (cached && cached.items.length > 0) {
        return cached.items;
    }

    return LOCAL_NEWS_FALLBACK;
}

export function filterNewsByCategory(news: NewsItem[], category: NewsItem['category']): NewsItem[] {
    return news.filter((item) => item.category === category);
}

export function filterEntertainmentNews(news: NewsItem[]): NewsItem[] {
    const keywords = ['游戏', '动漫', '娱乐', '影视', '音乐', '二次元', '直播', '综艺', '电影', '番剧'];
    return news.filter((item) => {
        const title = item.title.toLowerCase();
        return item.category === 'entertainment' || keywords.some((kw) => title.includes(kw));
    });
}

export function filterTechNews(news: NewsItem[]): NewsItem[] {
    const keywords = ['ai', '科技', '芯片', '开源', '编程', '模型', '算法', '软件', '互联网', '工程'];
    return news.filter((item) => {
        const title = item.title.toLowerCase();
        return item.category === 'tech' || keywords.some((kw) => title.includes(kw));
    });
}

export type { NewsItem, NewsResponse };
