// 导航点击分析服务 - 分析用户导航行为并学习偏好

import { addMemory } from './memoryService';

// 网站分类定义
const WEBSITE_CATEGORIES: Record<string, { category: 'preference' | 'habit' | 'emotion'; importance: number; description: string }> = {
    // 技术相关
    'GitHub': { category: 'preference', importance: 8, description: '代码托管平台' },
    'Stack Overflow': { category: 'preference', importance: 8, description: '技术问答社区' },
    '掘金': { category: 'preference', importance: 7, description: '技术社区' },
    'CSDN': { category: 'preference', importance: 6, description: '技术博客' },
    '知乎': { category: 'habit', importance: 6, description: '问答社区' },
    'V2EX': { category: 'preference', importance: 7, description: '技术社区' },
    'SegmentFault': { category: 'preference', importance: 7, description: '技术问答' },

    // 娱乐相关
    'Bilibili': { category: 'preference', importance: 6, description: '视频平台' },
    '哔哩哔哩': { category: 'preference', importance: 6, description: '视频平台' },
    'YouTube': { category: 'preference', importance: 6, description: '视频平台' },
    'Netflix': { category: 'preference', importance: 6, description: '流媒体' },
    'Steam': { category: 'preference', importance: 7, description: '游戏平台' },
    'Epic': { category: 'preference', importance: 6, description: '游戏平台' },

    // 社交相关
    '微博': { category: 'habit', importance: 5, description: '社交媒体' },
    'Twitter': { category: 'habit', importance: 5, description: '社交媒体' },
    'X': { category: 'habit', importance: 5, description: '社交媒体' },
    'Instagram': { category: 'preference', importance: 5, description: '图片社交' },
    '小红书': { category: 'habit', importance: 5, description: '生活方式' },
    '豆瓣': { category: 'preference', importance: 6, description: '文化社区' },

    // 工具相关
    'Google': { category: 'habit', importance: 6, description: '搜索引擎' },
    'Bing': { category: 'habit', importance: 5, description: '搜索引擎' },
    '百度': { category: 'habit', importance: 5, description: '搜索引擎' },
    'DeepL': { category: 'preference', importance: 6, description: '翻译工具' },
    'Figma': { category: 'preference', importance: 7, description: '设计工具' },
    'Notion': { category: 'preference', importance: 7, description: '笔记工具' },
    'Obsidian': { category: 'preference', importance: 7, description: '笔记工具' },

    // 购物相关
    '淘宝': { category: 'habit', importance: 5, description: '电商平台' },
    '京东': { category: 'habit', importance: 5, description: '电商平台' },
    '天猫': { category: 'habit', importance: 5, description: '电商平台' },
    '亚马逊': { category: 'habit', importance: 5, description: '电商平台' },
    '拼多多': { category: 'habit', importance: 4, description: '电商平台' },

    // 新闻资讯
    'Hacker News': { category: 'preference', importance: 7, description: '技术新闻' },
    'Product Hunt': { category: 'preference', importance: 7, description: '产品发现' },
    '36氪': { category: 'habit', importance: 6, description: '科技媒体' },
    '虎嗅': { category: 'habit', importance: 6, description: '科技媒体' },

    // 学习相关
    'Coursera': { category: 'preference', importance: 8, description: '在线课程' },
    'edX': { category: 'preference', importance: 8, description: '在线课程' },
    'Udemy': { category: 'preference', importance: 7, description: '在线课程' },
    'MDN': { category: 'preference', importance: 8, description: '技术文档' },
    'W3Cschool': { category: 'preference', importance: 7, description: '技术教程' },

    // 金融相关
    '雪球': { category: 'habit', importance: 6, description: '投资社区' },
    '东方财富': { category: 'habit', importance: 5, description: '财经资讯' },
    '同花顺': { category: 'habit', importance: 5, description: '股票工具' },
};

// 分类标题映射
const CATEGORY_TITLE_MAP: Record<string, { type: string; importance: number }> = {
    '常用': { type: 'habit', importance: 6 },
    '开发': { type: 'preference', importance: 8 },
    '设计': { type: 'preference', importance: 7 },
    '工具': { type: 'habit', importance: 5 },
    '娱乐': { type: 'preference', importance: 6 },
    '学习': { type: 'preference', importance: 8 },
    '社交': { type: 'habit', importance: 5 },
    '购物': { type: 'habit', importance: 5 },
    '资讯': { type: 'habit', importance: 6 },
    '金融': { type: 'habit', importance: 6 },
    '视频': { type: 'preference', importance: 6 },
    '音乐': { type: 'preference', importance: 6 },
    '游戏': { type: 'preference', importance: 7 },
};

// 分析导航点击
export async function analyzeNavigationClick(
    websiteName: string,
    websiteUrl: string,
    categoryTitle: string
): Promise<void> {
    if (!websiteName || !websiteUrl) {
        return;
    }

    // 1. 记录点击行为
    await addMemory(
        `用户点击了导航链接"${websiteName}"(${categoryTitle})`,
        'habit',
        '导航行为分析',
        4
    );

    // 2. 根据网站名称分析偏好
    const matchedSite = Object.entries(WEBSITE_CATEGORIES).find(([key]) =>
        websiteName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(websiteName.toLowerCase())
    );

    if (matchedSite) {
        const [siteName, siteInfo] = matchedSite;
        await addMemory(
            `用户访问${siteInfo.description}(${siteName})，显示出对${getCategoryDescription(siteInfo.category)}的兴趣`,
            siteInfo.category,
            '网站偏好分析',
            siteInfo.importance
        );
    }

    // 3. 根据分类标题分析偏好
    const matchedCategory = Object.entries(CATEGORY_TITLE_MAP).find(([key]) =>
        categoryTitle.includes(key)
    );

    if (matchedCategory) {
        const [catName, catInfo] = matchedCategory;
        await addMemory(
            `用户经常访问"${catName}"类网站，对${catName}内容感兴趣`,
            catInfo.type as 'preference' | 'habit' | 'emotion',
            '导航分类偏好分析',
            catInfo.importance
        );
    }

    // 4. 分析URL域名类型
    await analyzeUrlType(websiteUrl, websiteName);

    // 5. 更新用户行为模式
    await updateUserBehaviorPattern(websiteName, categoryTitle);

    console.log('[NavigationAnalysis] 导航分析完成:', websiteName, categoryTitle);
}

// 分析URL类型
async function analyzeUrlType(url: string, websiteName: string): Promise<void> {
    const urlLower = url.toLowerCase();

    // 技术相关域名
    if (/github|gitlab|bitbucket|stackoverflow|segmentfault|juejin|csdn|v2ex/i.test(urlLower)) {
        await addMemory(
            `用户经常访问技术类网站(${websiteName})，可能是开发者或技术人员`,
            'preference',
            '用户画像分析',
            8
        );
    }

    // 视频娱乐域名
    if (/bilibili|youtube|netflix|iqiyi|youku|tencent|mgtv/i.test(urlLower)) {
        await addMemory(
            `用户经常访问视频娱乐网站(${websiteName})，喜欢观看视频内容`,
            'preference',
            '用户画像分析',
            6
        );
    }

    // 社交媒体
    if (/weibo|twitter|x\.com|instagram|facebook|xiaohongshu|douban/i.test(urlLower)) {
        await addMemory(
            `用户经常访问社交媒体(${websiteName})，社交活跃度较高`,
            'habit',
            '用户画像分析',
            5
        );
    }

    // 学习平台
    if (/coursera|edx|udemy|khanacademy|mooc|xuetangx|icourse163/i.test(urlLower)) {
        await addMemory(
            `用户经常访问在线学习平台(${websiteName})，是主动学习型用户`,
            'preference',
            '用户画像分析',
            8
        );
    }

    // 购物平台
    if (/taobao|jd|tmall|amazon|pinduoduo|suning|gome/i.test(urlLower)) {
        await addMemory(
            `用户经常访问购物网站(${websiteName})，有在线购物习惯`,
            'habit',
            '用户画像分析',
            5
        );
    }

    // 国外网站
    if (!/\.cn\/|baidu|weibo|bilibili|zhihu|taobao|jd/i.test(urlLower) && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}/i.test(urlLower)) {
        const isForeignSite = !/baidu|weibo|zhihu|bilibili|taobao|jd|163|qq|sina|sohu|ifeng/i.test(urlLower);
        if (isForeignSite) {
            await addMemory(
                `用户经常访问国外网站(${websiteName})，可能有海外需求或英语较好`,
                'preference',
                '用户画像分析',
                6
            );
        }
    }
}

// 更新用户行为模式
async function updateUserBehaviorPattern(websiteName: string, categoryTitle: string): Promise<void> {
    // 根据访问的网站类型推断用户性格特征
    const personalityTraits: Record<string, { trait: string; description: string }> = {
        'GitHub': { trait: '技术导向', description: '喜欢探索新技术，注重代码质量' },
        'Stack Overflow': { trait: '问题解决者', description: '遇到问题善于寻求解决方案' },
        '知乎': { trait: '知识渴求者', description: '喜欢深度思考，追求知识' },
        'Bilibili': { trait: '视觉学习者', description: '喜欢通过视频学习新知识' },
        '豆瓣': { trait: '文艺青年', description: '关注文化、艺术和生活品质' },
        'Twitter': { trait: '信息敏感者', description: '关注时事，喜欢获取最新信息' },
        'Notion': { trait: '效率追求者', description: '注重知识管理和工作效率' },
        'Figma': { trait: '设计敏感', description: '关注设计，注重用户体验' },
    };

    const trait = Object.entries(personalityTraits).find(([key]) =>
        websiteName.toLowerCase().includes(key.toLowerCase())
    );

    if (trait) {
        const [site, info] = trait;
        await addMemory(
            `用户性格特征：${info.trait} - ${info.description}（通过访问${site}推断）`,
            'other',
            '用户性格分析',
            7
        );
    }
}

// 获取分类描述
function getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
        'preference': '特定领域',
        'habit': '日常行为',
        'emotion': '情感社交',
        'other': '其他方面',
    };
    return descriptions[category] || '相关内容';
}

// 获取导航用户画像
export async function getNavigationUserProfile(): Promise<{
    topCategories: string[];
    personalityTraits: string[];
    favoriteSites: string[];
}> {
    const { getCharacterMemory } = await import('./memoryService');
    const memory = await getCharacterMemory();

    const topCategories: string[] = [];
    const personalityTraits: string[] = [];
    const favoriteSites: string[] = [];

    for (const mem of memory.memories) {
        if (mem.source.includes('导航') || mem.source.includes('网站')) {
            // 提取分类偏好
            const catMatch = mem.content.match(/"([^"]+)"类网站/);
            if (catMatch && !topCategories.includes(catMatch[1])) {
                topCategories.push(catMatch[1]);
            }

            // 提取性格特征
            const traitMatch = mem.content.match(/性格特征：(.+?)[\s-]/);
            if (traitMatch && !personalityTraits.includes(traitMatch[1])) {
                personalityTraits.push(traitMatch[1]);
            }

            // 提取喜欢的网站
            const siteMatch = mem.content.match(/点击了导航链接"([^"]+)"/);
            if (siteMatch && !favoriteSites.includes(siteMatch[1])) {
                favoriteSites.push(siteMatch[1]);
            }
        }
    }

    return {
        topCategories: topCategories.slice(0, 5),
        personalityTraits: personalityTraits.slice(0, 5),
        favoriteSites: favoriteSites.slice(0, 10),
    };
}

// 导出供导航组件使用
export { addMemory };
