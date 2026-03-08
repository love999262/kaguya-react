import { jsonpRequest } from './jsonpService';

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

type HotlistAPIResponse = {
    success?: boolean;
    data?: Array<{
        title?: string;
        name?: string;
        url?: string;
    }>;
};

type NewsAPISource = {
    url: string;
    source: string;
    category: NewsItem['category'];
    parser: (data: unknown) => NewsItem[];
};

const NEWS_CACHE_KEY = 'kaguya:news:cache';
const NEWS_CACHE_DURATION = 30 * 60 * 1000;

const parseHotlistResponse = (data: unknown): NewsItem[] => {
    const response = data as HotlistAPIResponse;
    if (!response?.success || !Array.isArray(response?.data)) {
        return [];
    }
    return response.data
        .filter((item) => item.title || item.name)
        .slice(0, 10)
        .map((item) => ({
            title: item.title || item.name || '',
            url: item.url || '',
            source: '',
            category: 'general' as const,
        }));
};

const NEWS_API_SOURCES: NewsAPISource[] = [
    {
        url: 'https://api.vvhan.com/api/hotlist/wbHot',
        source: '微博热搜',
        category: 'social',
        parser: parseHotlistResponse,
    },
    {
        url: 'https://api.vvhan.com/api/hotlist/zhihuHot',
        source: '知乎热榜',
        category: 'tech',
        parser: parseHotlistResponse,
    },
    {
        url: 'https://api.vvhan.com/api/hotlist/toutiao',
        source: '今日头条',
        category: 'entertainment',
        parser: parseHotlistResponse,
    },
    {
        url: 'https://api.vvhan.com/api/hotlist/baiduHot',
        source: '百度热搜',
        category: 'general',
        parser: parseHotlistResponse,
    },
    {
        url: 'https://api.vvhan.com/api/hotlist/douyin',
        source: '抖音热榜',
        category: 'entertainment',
        parser: parseHotlistResponse,
    },
    {
        url: 'https://api.vvhan.com/api/hotlist/bilibili',
        source: 'B站热榜',
        category: 'entertainment',
        parser: parseHotlistResponse,
    },
    {
        url: 'https://api.vvhan.com/api/hotlist/weixin',
        source: '微信热搜',
        category: 'general',
        parser: parseHotlistResponse,
    },
];

const shuffleArray = <T>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

const fetchFromAPI = async (source: NewsAPISource): Promise<NewsItem[]> => {
    try {
        const data = await jsonpRequest(source.url);
        const items = source.parser(data);
        return items.map((item) => ({
            ...item,
            source: item.source || source.source,
            category: item.category || source.category,
        }));
    } catch {
        return [];
    }
};

const getCachedNews = (): NewsResponse | null => {
    try {
        const cached = localStorage.getItem(NEWS_CACHE_KEY);
        if (!cached) {
            return null;
        }
        const parsed = JSON.parse(cached) as NewsResponse;
        if (Date.now() - parsed.timestamp > NEWS_CACHE_DURATION) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

const setCachedNews = (items: NewsItem[]): void => {
    try {
        localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({
            items,
            timestamp: Date.now(),
        }));
    } catch {
    }
};

export const fetchHotNews = async (forceRefresh = false): Promise<NewsItem[]> => {
    if (!forceRefresh) {
        const cached = getCachedNews();
        if (cached && cached.items.length > 0) {
            return cached.items;
        }
    }

    const shuffledSources = shuffleArray(NEWS_API_SOURCES);
    const selectedSources = shuffledSources.slice(0, 4);

    const results = await Promise.allSettled(
        selectedSources.map((source) => fetchFromAPI(source))
    );

    const allNews: NewsItem[] = [];
    results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            allNews.push(...result.value);
        }
    });

    const seen = new Set<string>();
    const deduped = allNews.filter((item) => {
        const key = item.title.toLowerCase().trim();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });

    if (deduped.length > 0) {
        setCachedNews(deduped);
    }

    return deduped.slice(0, 20);
};

export const filterNewsByCategory = (news: NewsItem[], category: NewsItem['category']): NewsItem[] => {
    return news.filter((item) => item.category === category);
};

export const filterEntertainmentNews = (news: NewsItem[]): NewsItem[] => {
    const keywords = ['游戏', '娱乐', '明星', '电影', '电视剧', '动漫', '音乐', '综艺', '直播', '网红'];
    return news.filter((item) => {
        const title = item.title.toLowerCase();
        return keywords.some((kw) => title.includes(kw)) || item.category === 'entertainment';
    });
};

export const filterTechNews = (news: NewsItem[]): NewsItem[] => {
    const keywords = ['科技', 'AI', '人工智能', '手机', '芯片', '互联网', '软件', '编程', '代码', '算法', '时政', '经济', '政策', '国际'];
    return news.filter((item) => {
        const title = item.title.toLowerCase();
        return keywords.some((kw) => title.includes(kw)) || item.category === 'tech';
    });
};

export type { NewsItem, NewsResponse };
