// 历史上的今天服务

export interface HistoryEvent {
    year: string;
    title: string;
    description: string;
    type?: 'politics' | 'science' | 'culture' | 'sports' | 'other';
}

export interface TodayInHistory {
    date: string;
    events: HistoryEvent[];
}

// 本地缓存
const CACHE_KEY = 'kaguya:history:today';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

interface CacheData {
    date: string;
    data: TodayInHistory;
    timestamp: number;
}

// 获取缓存
function getCache(): CacheData | null {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data: CacheData = JSON.parse(cached);
            // 检查是否过期
            if (Date.now() - data.timestamp < CACHE_DURATION) {
                return data;
            }
        }
    } catch {
        // 忽略解析错误
    }
    return null;
}

// 设置缓存
function setCache(data: TodayInHistory): void {
    try {
        const cacheData: CacheData = {
            date: data.date,
            data,
            timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch {
        // 忽略存储错误
    }
}

// 从 Wikipedia API 获取历史上的今天
async function fetchFromWikipedia(): Promise<TodayInHistory | null> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    try {
        // Wikipedia API 端点
        const url = `https://zh.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.events || !Array.isArray(data.events)) {
            return null;
        }

        // 转换为本地格式
        const events: HistoryEvent[] = data.events
            .slice(0, 10) // 取前10条
            .map((event: any) => ({
                year: String(event.year || '未知'),
                title: event.text || '',
                description: event.pages?.[0]?.extract || '',
                type: categorizeEvent(event.text),
            }));

        const result: TodayInHistory = {
            date: `${month}月${day}日`,
            events,
        };

        setCache(result);
        return result;
    } catch (error) {
        console.warn('Failed to fetch from Wikipedia:', error);
        return null;
    }
}

// 事件分类
function categorizeEvent(text: string): HistoryEvent['type'] {
    const lowerText = text.toLowerCase();

    if (/战争|战役|革命|独立|建国|条约|协议/.test(text)) {
        return 'politics';
    }
    if (/发现|发明|科学|技术|卫星|航天| Nobel|诺贝尔奖/.test(text)) {
        return 'science';
    }
    if (/出生|逝世|作家|画家|音乐|电影|艺术|文学/.test(text)) {
        return 'culture';
    }
    if (/奥运|世界杯|锦标赛|比赛|冠军|体育/.test(text)) {
        return 'sports';
    }

    return 'other';
}

// 获取历史上的今天
export async function getTodayInHistory(): Promise<TodayInHistory | null> {
    // 先检查缓存
    const cache = getCache();
    if (cache) {
        return cache.data;
    }

    // 从 Wikipedia 获取
    const data = await fetchFromWikipedia();
    if (data) {
        return data;
    }

    // 返回本地默认数据
    return getDefaultHistoryData();
}

// 获取单个历史事件（用于角色对话）
export async function getRandomHistoryEvent(): Promise<HistoryEvent | null> {
    const history = await getTodayInHistory();
    if (!history || history.events.length === 0) {
        return null;
    }

    // 随机选择一个事件
    const randomIndex = Math.floor(Math.random() * history.events.length);
    return history.events[randomIndex];
}

// 格式化历史事件为角色台词
export function formatHistoryForCharacter(
    event: HistoryEvent,
    character: '22' | '33'
): string {
    if (character === '22') {
        return `${event.year}年的今天，${event.title}！好厉害呢～`;
    } else {
        return `${event.year}年的今天，${event.title}。历史总是惊人的相似。`;
    }
}

// 本地默认数据（降级方案）
function getDefaultHistoryData(): TodayInHistory {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // 这里可以添加一些固定的历史事件作为降级
    return {
        date: `${month}月${day}日`,
        events: [
            {
                year: '今天',
                title: '无法获取历史数据',
                description: '请检查网络连接后重试',
                type: 'other',
            },
        ],
    };
}

// 预加载（在后台获取数据）
export function preloadHistoryData(): void {
    // 如果已有有效缓存，不重新获取
    const cache = getCache();
    if (cache) {
        return;
    }

    // 后台获取
    fetchFromWikipedia().catch(() => {
        // 忽略错误
    });
}
