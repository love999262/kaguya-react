// 搜索内容分析服务 - 分析用户搜索行为并学习偏好

import { addMemory, MemoryItem } from './memoryService';

// 搜索分类定义
const SEARCH_CATEGORIES = {
    tech: {
        keywords: ['编程', '代码', '开发', '程序员', 'python', 'javascript', 'java', 'react', 'vue', 'node', 'git', 'github', '算法', '数据库', 'sql', 'linux', 'docker', 'kubernetes', '前端', '后端', '全栈', 'web', 'app', 'api', '框架', '库', 'sdk', 'ide', '编辑器', 'vscode', 'intellij', 'eclipse'],
        category: 'preference' as const,
        importance: 7,
    },
    entertainment: {
        keywords: ['电影', '电视剧', '动漫', '动画', '漫画', '小说', '游戏', '音乐', '歌曲', '歌手', '明星', '综艺', '娱乐', '八卦', '影评', '剧评', 'bilibili', 'b站', 'youtube', 'netflix', 'steam', 'epic', 'switch', 'ps5', 'xbox'],
        category: 'preference' as const,
        importance: 6,
    },
    news: {
        keywords: ['新闻', '时事', '热点', '头条', '报道', '媒体', '微博', '知乎', 'twitter', 'facebook', 'instagram', 'reddit', '论坛', '社区'],
        category: 'habit' as const,
        importance: 5,
    },
    shopping: {
        keywords: ['购买', '价格', '优惠', '折扣', '淘宝', '京东', '天猫', '拼多多', '亚马逊', '购物', '商品', '评价', '评测', '推荐', '性价比'],
        category: 'habit' as const,
        importance: 6,
    },
    study: {
        keywords: ['学习', '教程', '课程', '教育', '考试', '考研', '英语', '数学', '物理', '化学', '生物', '历史', '地理', '政治', '论文', '文献', '学术', 'mooc', 'coursera', 'udemy', '网课'],
        category: 'preference' as const,
        importance: 7,
    },
    work: {
        keywords: ['工作', '职场', '简历', '面试', '招聘', '求职', '跳槽', '薪资', '加班', '老板', '同事', '团队', '项目', '管理', 'ppt', 'excel', 'word', 'office', 'wps', '邮件', '会议'],
        category: 'habit' as const,
        importance: 6,
    },
    life: {
        keywords: ['生活', '健康', '饮食', '健身', '减肥', '养生', '旅游', '旅行', '美食', '菜谱', '烹饪', '家居', '装修', '宠物', '植物', '穿搭', '时尚', '美妆', '护肤'],
        category: 'preference' as const,
        importance: 5,
    },
    social: {
        keywords: ['社交', '交友', '恋爱', '情感', '婚姻', '家庭', '朋友', '聚会', '聊天', '约会', '相亲', '分手', '复合', '暗恋', '表白'],
        category: 'emotion' as const,
        importance: 6,
    },
    finance: {
        keywords: ['股票', '基金', '理财', '投资', '比特币', '加密货币', '区块链', '赚钱', '副业', '创业', '保险', '贷款', '房贷', '车贷', '信用卡', '银行', '支付宝', '微信支付'],
        category: 'habit' as const,
        importance: 7,
    },
    tools: {
        keywords: ['工具', '软件', '应用', 'app', '下载', '安装', '破解', '激活码', '序列号', '许可证', '免费', '开源', '在线工具', '转换器', '计算器', '翻译', '词典'],
        category: 'habit' as const,
        importance: 5,
    },
};

// 分析搜索内容
export async function analyzeSearchContent(
    query: string,
    searchEngine: string
): Promise<void> {
    if (!query || query.trim().length < 2) {
        return;
    }

    const normalizedQuery = query.toLowerCase().trim();

    // 1. 记录原始搜索行为（包含搜索引擎信息）
    await addMemory(
        `用户使用${searchEngine}搜索了"${query}"`,
        'habit',
        '搜索行为分析',
        4
    );

    // 2. 记录搜索引擎偏好
    await analyzeSearchEnginePreference(searchEngine, normalizedQuery);

    // 3. 分析搜索类别
    let matchedCategory: keyof typeof SEARCH_CATEGORIES | null = null;
    let maxMatchScore = 0;

    for (const [categoryKey, categoryData] of Object.entries(SEARCH_CATEGORIES)) {
        const matchCount = categoryData.keywords.filter(keyword =>
            normalizedQuery.includes(keyword.toLowerCase())
        ).length;

        if (matchCount > 0 && matchCount > maxMatchScore) {
            maxMatchScore = matchCount;
            matchedCategory = categoryKey as keyof typeof SEARCH_CATEGORIES;
        }
    }

    // 4. 如果匹配到类别，记录用户偏好
    if (matchedCategory) {
        const categoryInfo = SEARCH_CATEGORIES[matchedCategory];
        const categoryNames: Record<string, string> = {
            tech: '技术/编程',
            entertainment: '娱乐/影视',
            news: '新闻资讯',
            shopping: '购物消费',
            study: '学习/教育',
            work: '工作/职场',
            life: '生活/健康',
            social: '社交/情感',
            finance: '金融/理财',
            tools: '工具/软件',
        };

        await addMemory(
            `用户对${categoryNames[matchedCategory]}感兴趣（使用${searchEngine}搜索"${query}"）`,
            categoryInfo.category,
            '搜索偏好分析',
            categoryInfo.importance
        );
    }

    // 5. 提取具体兴趣点（更细粒度的分析）
    await extractSpecificInterests(query, normalizedQuery, searchEngine);

    // 6. 分析搜索意图
    await analyzeSearchIntent(query, normalizedQuery);

    console.log('[SearchAnalysis] 搜索分析完成:', query, '引擎:', searchEngine);
}

// 分析搜索引擎偏好
async function analyzeSearchEnginePreference(searchEngine: string, normalizedQuery: string): Promise<void> {
    // 根据不同搜索引擎记录偏好
    const enginePatterns: Record<string, { name: string; keywords: string[]; importance: number }> = {
        'Bing': { name: '必应', keywords: ['国际', '英文', '学术', '论文', '微软'], importance: 5 },
        'Google': { name: '谷歌', keywords: ['技术', '开发', '编程', '开源', 'github'], importance: 6 },
        'Baidu': { name: '百度', keywords: ['中文', '国内', '贴吧', '百科', '知道'], importance: 5 },
        'DuckDuckGo': { name: 'DuckDuckGo', keywords: ['隐私', '安全'], importance: 7 },
    };

    const engineInfo = enginePatterns[searchEngine];
    if (engineInfo) {
        // 检查搜索内容是否与该引擎特点匹配
        const isMatch = engineInfo.keywords.some(kw => normalizedQuery.includes(kw));
        if (isMatch) {
            await addMemory(
                `用户倾向于使用${engineInfo.name}搜索${engineInfo.keywords.find(kw => normalizedQuery.includes(kw))}相关内容`,
                'preference',
                '搜索引擎偏好分析',
                engineInfo.importance
            );
        }
    }

    // 记录用户偏好的搜索引擎
    await addMemory(
        `用户经常使用${searchEngine}进行搜索`,
        'habit',
        '搜索引擎偏好分析',
        5
    );
}

// 提取具体兴趣点
async function extractSpecificInterests(originalQuery: string, normalizedQuery: string, searchEngine: string): Promise<void> {
    // 技术相关
    const techPatterns = [
        { pattern: /(python|javascript|java|typescript|go|rust|c\+\+|c#|php|ruby|swift|kotlin)/i, type: '编程语言' },
        { pattern: /(react|vue|angular|svelte|next\.?js|nuxt)/i, type: '前端框架' },
        { pattern: /(node\.?js|django|flask|spring|express|fastapi)/i, type: '后端技术' },
        { pattern: /(mysql|postgresql|mongodb|redis|elasticsearch)/i, type: '数据库' },
        { pattern: /(docker|kubernetes|aws|azure|gcp|阿里云|腾讯云)/i, type: '云服务/DevOps' },
    ];

    for (const { pattern, type } of techPatterns) {
        const match = normalizedQuery.match(pattern);
        if (match) {
            await addMemory(
                `用户使用${searchEngine}搜索${type}相关内容: ${match[0]}`,
                'preference',
                '技术兴趣分析',
                8
            );
        }
    }

    // 娱乐相关
    const entertainmentPatterns = [
        { pattern: /《([^》]+)》/, type: '作品' },
        { pattern: /([\u4e00-\u9fa5]{2,5}?)动漫/, type: '动漫' },
        { pattern: /([\u4e00-\u9fa5]{2,5}?)电影/, type: '电影' },
        { pattern: /([\u4e00-\u9fa5]{2,5}?)电视剧/, type: '电视剧' },
        { pattern: /([\u4e00-\u9fa5]{2,5}?)游戏/, type: '游戏' },
    ];

    for (const { pattern, type } of entertainmentPatterns) {
        const match = originalQuery.match(pattern);
        if (match && match[1] && match[1].length > 1) {
            await addMemory(
                `用户使用${searchEngine}搜索${type}《${match[1]}》相关内容`,
                'preference',
                '娱乐偏好分析',
                6
            );
        }
    }
}

// 分析搜索意图
async function analyzeSearchIntent(originalQuery: string, normalizedQuery: string): Promise<void> {
    // 问题求解型
    if (/^(如何|怎么|为什么|什么是|什么是|怎样|求助|请教)/.test(originalQuery) ||
        /(教程|指南|攻略|方法|步骤|解决|报错|错误|bug|问题)/.test(normalizedQuery)) {
        await addMemory(
            '用户经常搜索问题解决方案，可能是学习型用户',
            'habit',
            '搜索行为分析',
            5
        );
    }

    // 信息获取型
    if (/(最新|资讯|新闻|动态|更新|发布|公告)/.test(normalizedQuery)) {
        await addMemory(
            '用户关注最新资讯和动态',
            'habit',
            '搜索行为分析',
            5
        );
    }

    // 比较决策型
    if (/(对比|比较|区别|哪个好|推荐|评测|测评|排名)/.test(normalizedQuery)) {
        await addMemory(
            '用户在做决策前喜欢比较和看评测',
            'habit',
            '搜索行为分析',
            6
        );
    }

    // 资源获取型
    if (/(下载|资源|免费|破解|网盘|磁力|种子|bt|pdf|epub)/.test(normalizedQuery)) {
        await addMemory(
            '用户经常搜索资源和下载内容',
            'habit',
            '搜索行为分析',
            4
        );
    }
}

// 获取用户画像摘要
export async function getUserProfileSummary(): Promise<string> {
    const { getCharacterMemory } = await import('./memoryService');
    const memory = await getCharacterMemory();

    // 统计各类别的记忆数量
    const categoryCount: Record<string, number> = {};
    const interests: string[] = [];

    for (const mem of memory.memories) {
        if (mem.source.includes('搜索') || mem.source.includes('分析')) {
            categoryCount[mem.category] = (categoryCount[mem.category] || 0) + 1;

            // 提取兴趣关键词
            if (mem.category === 'preference' && mem.content.includes('感兴趣')) {
                const match = mem.content.match(/对(.+?)感兴趣/);
                if (match && !interests.includes(match[1])) {
                    interests.push(match[1]);
                }
            }
        }
    }

    let summary = '用户画像：';
    if (interests.length > 0) {
        summary += `对${interests.slice(0, 5).join('、')}等感兴趣。`;
    }

    if (categoryCount.preference > 0) {
        summary += `已记录${categoryCount.preference}条偏好。`;
    }
    if (categoryCount.habit > 0) {
        summary += `已记录${categoryCount.habit}条行为习惯。`;
    }

    return summary || '暂无足够数据形成用户画像';
}

// 导出供搜索组件使用
export { addMemory };
