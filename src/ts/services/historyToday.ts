// 历史上的今天服务

import { indexedDBCache } from '../utils/indexedDB';

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

// IndexDB 缓存配置
const CACHE_KEY = 'kaguya:history:today';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30天
const MAX_SILENT_FAIL_COUNT = 3; // 静默调用最大失败次数
const FAIL_COUNT_KEY = 'kaguya:history:failCount';

// 从国内 API 获取历史上的今天（无需翻墙）
async function fetchFromChinaAPI(): Promise<TodayInHistory | null> {
    try {
        // 使用国内可访问的 API
        const url = 'https://zj.v.api.aa1.cn/api/baike/?num=10&type=json';

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.content || !Array.isArray(data.content)) {
            return null;
        }

        // 转换为本地格式
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();

        const events: HistoryEvent[] = data.content
            .slice(0, 10)
            .map((eventText: string) => {
                // 解析事件文本，尝试提取年份
                const yearMatch = eventText.match(/(\d{4})年/);
                const year = yearMatch ? yearMatch[1] : '未知';
                return {
                    year: year,
                    title: eventText,
                    description: eventText,
                    type: categorizeEvent(eventText),
                };
            });

        const result: TodayInHistory = {
            date: `${month}月${day}日`,
            events,
        };

        await setCache(result);
        return result;
    } catch (error) {
        console.warn('Failed to fetch from China API:', error);
        return null;
    }
}

// 设置缓存到 IndexDB
async function setCache(data: TodayInHistory): Promise<void> {
    try {
        await indexedDBCache.set(CACHE_KEY, data, 0); // 重置失败次数
    } catch {
        // 忽略存储错误
    }
}

// 从 IndexDB 获取缓存
async function getCache(): Promise<{ data: TodayInHistory; timestamp: number; failCount: number } | null> {
    try {
        const entry = await indexedDBCache.get<TodayInHistory>(CACHE_KEY);
        if (!entry) return null;

        // 检查是否过期
        if (Date.now() - entry.timestamp > CACHE_DURATION) {
            return null;
        }

        return {
            data: entry.data,
            timestamp: entry.timestamp,
            failCount: entry.failCount || 0,
        };
    } catch {
        return null;
    }
}

// 记录静默调用失败次数
async function recordSilentFail(): Promise<number> {
    try {
        const entry = await indexedDBCache.get<TodayInHistory>(CACHE_KEY);
        const newFailCount = (entry?.failCount || 0) + 1;
        if (entry) {
            await indexedDBCache.set(CACHE_KEY, entry.data, newFailCount);
        }
        return newFailCount;
    } catch {
        return 0;
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

        await setCache(result);
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
// silentMode: 如果为true，则优先使用缓存，只在后台静默更新
export async function getTodayInHistory(silentMode = false): Promise<TodayInHistory | null> {
    // 先检查缓存
    const cache = await getCache();
    if (cache) {
        // 静默模式下，先返回缓存数据，后台静默更新
        if (silentMode) {
            // 检查失败次数，超过3次不再调用
            if (cache.failCount >= MAX_SILENT_FAIL_COUNT) {
                console.log('[History] 静默调用失败次数已达上限，不再后台更新');
                return cache.data;
            }

            // 后台静默刷新数据
            setTimeout(async () => {
                try {
                    const data = await fetchFromWikipedia();
                    if (data) {
                        console.log('[History] 后台静默更新成功');
                        // 重置失败次数
                        await indexedDBCache.set(CACHE_KEY, data, 0);
                    } else {
                        // 记录失败
                        const failCount = await recordSilentFail();
                        console.log(`[History] 后台静默更新失败，当前失败次数: ${failCount}`);
                    }
                } catch {
                    // 记录失败
                    const failCount = await recordSilentFail();
                    console.log(`[History] 后台静默更新异常，当前失败次数: ${failCount}`);
                }
            }, 100);
            return cache.data;
        }
        return cache.data;
    }

    // 优先从 Wikipedia 获取
    const wikiData = await fetchFromWikipedia();
    if (wikiData) {
        return wikiData;
    }

    // Wikipedia 失败，尝试国内 API
    const chinaData = await fetchFromChinaAPI();
    if (chinaData) {
        return chinaData;
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
export async function preloadHistoryData(): Promise<void> {
    // 如果已有有效缓存，不重新获取
    const cache = await getCache();
    if (cache) {
        return;
    }

    // 后台获取
    try {
        await fetchFromWikipedia();
    } catch {
        // 忽略错误
    }
}
