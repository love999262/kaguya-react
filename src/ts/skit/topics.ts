// 小剧场话题生成器

import type { SkitTopic, SkitTopicType } from './types';
import { getTodayInfo, getNextMemorialDay } from '../utils/date';
import { getRandomHistoryEvent } from '../services/historyToday';
import { getCachedJoke } from '../jsonpService';

// 获取今日话题
export async function generateTodayTopic(): Promise<SkitTopic | null> {
    const todayInfo = getTodayInfo();

    // 优先节日/节气
    if (todayInfo.memorialDay) {
        return {
            type: 'holiday',
            title: todayInfo.memorialDay.name,
            content: todayInfo.memorialDay.description,
            source: '节日',
        };
    }

    if (todayInfo.solarTerm) {
        return {
            type: 'holiday',
            title: todayInfo.solarTerm.name,
            content: `${todayInfo.solarTerm.description}。${todayInfo.solarTerm.tips}`,
            source: '节气',
        };
    }

    // 历史上的今天
    const historyEvent = await getRandomHistoryEvent();
    if (historyEvent) {
        return {
            type: 'history',
            title: `历史上的今天：${historyEvent.year}年`,
            content: historyEvent.title,
            source: '历史',
        };
    }

    return null;
}

// 获取新闻话题
export async function generateNewsTopic(): Promise<SkitTopic | null> {
    try {
        // 从 newsService 获取热点
        const { fetchAllNews } = await import('../newsService');
        const news = await fetchAllNews();

        if (news && news.length > 0) {
            // 随机选择一条新闻
            const randomNews = news[Math.floor(Math.random() * news.length)];
            return {
                type: 'news',
                title: randomNews.title,
                content: randomNews.summary || randomNews.title,
                source: randomNews.source,
            };
        }
    } catch {
        // 忽略错误
    }

    return null;
}

// 获取笑话话题
export async function generateJokeTopic(): Promise<SkitTopic | null> {
    const joke = await getCachedJoke();
    if (joke) {
        return {
            type: 'joke',
            title: '笑话时间',
            content: joke,
            source: '笑话',
        };
    }
    return null;
}

// 获取技术话题
export async function generateTechTopic(): Promise<SkitTopic | null> {
    // 技术话题池
    const techTopics = [
        {
            title: 'AI 发展',
            content: '最近AI技术发展好快，你觉得AI会取代人类吗？',
        },
        {
            title: '编程语言',
            content: '如果让你选一门编程语言，你会选什么？',
        },
        {
            title: '游戏技术',
            content: '现在的游戏画面越来越真实了，你最喜欢什么类型的游戏？',
        },
        {
            title: '虚拟现实',
            content: 'VR和AR技术越来越成熟，你觉得未来会普及吗？',
        },
        {
            title: '量子计算',
            content: '量子计算机听起来好厉害，虽然我不太懂...',
        },
    ];

    const random = techTopics[Math.floor(Math.random() * techTopics.length)];
    return {
        type: 'tech',
        title: random.title,
        content: random.content,
        source: '技术话题',
    };
}

// 获取随机话题
export async function generateRandomTopic(
    allowedTypes: SkitTopicType[] = ['news', 'history', 'holiday', 'tech', 'joke']
): Promise<SkitTopic | null> {
    // 按优先级尝试获取话题
    const generators: { type: SkitTopicType; generator: () => Promise<SkitTopic | null> }[] = [
        { type: 'holiday', generator: generateTodayTopic },
        { type: 'news', generator: generateNewsTopic },
        { type: 'history', generator: generateRandomHistoryTopic },
        { type: 'joke', generator: generateJokeTopic },
        { type: 'tech', generator: generateTechTopic },
    ];

    // 过滤允许的话题类型
    const filtered = generators.filter(g => allowedTypes.includes(g.type));

    // 打乱顺序
    const shuffled = filtered.sort(() => Math.random() - 0.5);

    // 依次尝试
    for (const { generator } of shuffled) {
        const topic = await generator();
        if (topic) {
            return topic;
        }
    }

    // 保底话题
    return generateFallbackTopic();
}

// 历史上的今天话题
async function generateRandomHistoryTopic(): Promise<SkitTopic | null> {
    const event = await getRandomHistoryEvent();
    if (event) {
        return {
            type: 'history',
            title: `历史上的今天：${event.year}年`,
            content: event.title,
            source: '历史',
        };
    }
    return null;
}

// 保底话题
function generateFallbackTopic(): SkitTopic {
    const fallbackTopics = [
        {
            title: '日常闲聊',
            content: '今天过得怎么样？有什么有趣的事情吗？',
        },
        {
            title: '天气话题',
            content: '今天的天气还不错，适合出去走走。',
        },
        {
            title: '美食话题',
            content: '说到吃的，你最近有吃到什么好吃的吗？',
        },
        {
            title: '娱乐话题',
            content: '最近有什么好看的动漫或者电影吗？',
        },
    ];

    const random = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
    return {
        type: 'custom',
        title: random.title,
        content: random.content,
        source: '日常',
    };
}

// 导出话题生成器映射
export const topicGenerators: Record<SkitTopicType, () => Promise<SkitTopic | null>> = {
    holiday: generateTodayTopic,
    news: generateNewsTopic,
    history: generateRandomHistoryTopic,
    joke: generateJokeTopic,
    tech: generateTechTopic,
    custom: async () => generateFallbackTopic(),
};
