// 小剧场引擎 - 管理轻相声/拌嘴模式

import type {
    SkitConfig,
    SkitSession,
    SkitTurn,
    SkitTopic,
} from './types';
import { DEFAULT_SKIT_CONFIG, SKIT_PERSONA } from './types';
import { generateRandomTopic } from './topics';
import { StoreNames } from '../memory/types';
import { addRecord } from '../memory/indexedDB';

// 生成唯一ID
function generateId(): string {
    return `skit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 推断动作
function inferAction(content: string, speaker: '22' | '33'): string {
    const preference = SKIT_PERSONA[speaker].actionPreference;

    // 根据内容推断
    if (/[!！]{2,}/.test(content) || /哈哈|嘻嘻/.test(content)) {
        return preference[0]; // happy
    }
    if (/[?？]{2,}/.test(content) || /为什么|怎么/.test(content)) {
        return preference[1]; // curious/thinking
    }
    if (/不是|但是|其实/.test(content)) {
        return preference[2] || preference[1]; // neutral/thinking
    }

    return preference[0];
}

export class SkitEngine {
    private config: SkitConfig;
    private session: SkitSession | null = null;
    private isRunning: boolean = false;
    private currentTurn: number = 0;
    private onTurnCallback: ((turn: SkitTurn) => void) | null = null;
    private onCompleteCallback: ((session: SkitSession) => void) | null = null;
    private abortController: AbortController | null = null;

    constructor(config: Partial<SkitConfig> = {}) {
        this.config = { ...DEFAULT_SKIT_CONFIG, ...config };
    }

    // 设置回调
    onTurn(callback: (turn: SkitTurn) => void): void {
        this.onTurnCallback = callback;
    }

    onComplete(callback: (session: SkitSession) => void): void {
        this.onCompleteCallback = callback;
    }

    // 开始小剧场
    async start(topic?: SkitTopic): Promise<boolean> {
        if (this.isRunning) {
            return false;
        }

        // 获取话题
        const skitTopic = topic || await generateRandomTopic(this.config.topicSource);
        if (!skitTopic) {
            return false;
        }

        // 初始化会话
        this.session = {
            id: generateId(),
            startTime: Date.now(),
            topic: skitTopic,
            turns: [],
            isActive: true,
        };

        this.isRunning = true;
        this.currentTurn = 0;
        this.abortController = new AbortController();

        // 开始对话
        await this.runSkit();

        return true;
    }

    // 停止小剧场
    stop(): void {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isRunning = false;

        if (this.session) {
            this.session.isActive = false;
            this.session.endTime = Date.now();
        }
    }

    // 运行小剧场对话
    private async runSkit(): Promise<void> {
        if (!this.session) return;

        const startTime = Date.now();
        let lastSpeaker: '22' | '33' | null = null;

        try {
            // 开场白（22 开场）
            await this.performTurn('22', 'opening');
            lastSpeaker = '22';

            // 对话循环
            while (this.shouldContinue(startTime)) {
                const nextSpeaker: '22' | '33' = lastSpeaker === '22' ? '33' : '22';

                // 检查是否应该停止
                if (this.currentTurn >= this.config.minTurns) {
                    const shouldStop = await this.checkStopCondition();
                    if (shouldStop) {
                        break;
                    }
                }

                await this.performTurn(nextSpeaker, 'continuation');
                lastSpeaker = nextSpeaker;

                // 轮间停顿
                await this.delay(1500);
            }

            // 收尾
            await this.performTurn('22', 'closing');
            if (this.currentTurn < this.config.maxTurns) {
                await this.delay(1000);
                await this.performTurn('33', 'closing');
            }

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // 正常停止
            } else {
                console.error('Skit error:', error);
            }
        } finally {
            await this.complete();
        }
    }

    // 执行一轮对话
    private async performTurn(
        speaker: '22' | '33',
        stage: 'opening' | 'continuation' | 'closing'
    ): Promise<void> {
        if (!this.session || !this.isRunning) return;

        // 生成内容（这里简化处理，实际应调用 LLM）
        const content = await this.generateContent(speaker, stage);

        const turn: SkitTurn = {
            speaker,
            content,
            action: inferAction(content, speaker),
            timestamp: Date.now(),
        };

        this.session.turns.push(turn);
        this.currentTurn++;

        // 触发回调
        if (this.onTurnCallback) {
            this.onTurnCallback(turn);
        }

        // 触发 Live2D 动作和气泡
        this.emitToLive2D(speaker, content, turn.action);
    }

    // 生成内容（简化版，实际应调用 LLM）
    private async generateContent(
        speaker: '22' | '33',
        stage: 'opening' | 'continuation' | 'closing'
    ): Promise<string> {
        if (!this.session) return '';

        const topic = this.session.topic;
        const persona = SKIT_PERSONA[speaker];

        // 构建 Prompt（实际应调用 LLM）
        const prompt = this.buildPrompt(speaker, stage, topic);

        // 这里简化处理，返回预设回复
        // 实际应调用 WebLLM 生成
        return this.getFallbackContent(speaker, stage, topic);
    }

    // 构建 Prompt
    private buildPrompt(
        speaker: '22' | '33',
        stage: 'opening' | 'continuation' | 'closing',
        topic: SkitTopic
    ): string {
        const persona = SKIT_PERSONA[speaker];
        const otherSpeaker = speaker === '22' ? '33' : '22';

        let prompt = `你是${speaker === '22' ? '22娘' : '33娘'}，正在和${otherSpeaker === '22' ? '22娘' : '33娘'}进行一段轻松的小剧场对话。\n`;
        prompt += `话题：${topic.title}\n`;
        prompt += `话题内容：${topic.content}\n\n`;

        if (stage === 'opening') {
            prompt += `${persona.openingStyle}。请用1-2句话引出话题。`;
        } else if (stage === 'continuation') {
            prompt += `对话历史：\n${this.formatHistory()}\n\n`;
            prompt += `${persona.responseStyle}。请用1句话回应。`;
        } else {
            prompt += `${persona.closingStyle}。请用1句话结束。`;
        }

        return prompt;
    }

    // 格式化历史对话
    private formatHistory(): string {
        if (!this.session) return '';
        return this.session.turns
            .slice(-3)
            .map(t => `${t.speaker === '22' ? '22娘' : '33娘'}：${t.content}`)
            .join('\n');
    }

    // 获取保底内容（当 LLM 不可用时）
    private getFallbackContent(
        speaker: '22' | '33',
        stage: 'opening' | 'continuation' | 'closing',
        topic: SkitTopic
    ): string {
        const fallbacks: Record<string, string[]> = {
            '22-opening': [
                `嘿！说到${topic.title}，你知道吗？`,
                `哎呀，${topic.title}这个有意思！`,
                `来来来，聊聊${topic.title}～`,
            ],
            '22-continuation': [
                '对对对！我也这么觉得！',
                '哈哈，33你觉得呢？',
                '说到这个，我突然想到...',
                '哎呀，被你这么一说...',
            ],
            '22-closing': [
                '好啦好啦，今天就聊到这吧～',
                '嘿嘿，真有意思！',
                '下次再聊这个吧！',
            ],
            '33-opening': [
                `${topic.title}？又是这个话题。`,
                `哦，${topic.title}啊。`,
                `${topic.title}，说说看。`,
            ],
            '33-continuation': [
                '其实吧...',
                '也不是这么说...',
                '从理性的角度...',
                '你倒是挺乐观的。',
            ],
            '33-closing': [
                '就这样吧。',
                '聊得差不多了。',
                '散了吧。',
            ],
        };

        const key = `${speaker}-${stage}`;
        const options = fallbacks[key] || ['嗯...'];
        return options[Math.floor(Math.random() * options.length)];
    }

    // 检查是否应该继续
    private shouldContinue(startTime: number): boolean {
        if (!this.isRunning) return false;
        if (this.currentTurn >= this.config.maxTurns) return false;

        const elapsed = Date.now() - startTime;
        if (elapsed >= this.config.maxDuration) return false;

        return true;
    }

    // 检查停止条件
    private async checkStopCondition(): Promise<boolean> {
        // 可以基于内容判断是否应该停止
        // 简化处理：随机决定
        return Math.random() < 0.3;
    }

    // 延迟
    private delay(ms: number): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.abortController) {
                resolve();
                return;
            }

            const timer = setTimeout(resolve, ms);

            this.abortController.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('AbortError'));
            }, { once: true });
        });
    }

    // 触发 Live2D 事件
    private emitToLive2D(
        target: '22' | '33',
        text: string,
        action: string
    ): void {
        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('kaguya:live2d-bubble', {
            detail: { target, text },
        }));

        window.dispatchEvent(new CustomEvent('kaguya:live2d-action', {
            detail: { target, action },
        }));
    }

    // 完成会话
    private async complete(): Promise<void> {
        if (!this.session) return;

        this.session.isActive = false;
        this.session.endTime = Date.now();
        this.isRunning = false;

        // 保存到数据库
        try {
            await addRecord(StoreNames.SKIT_HISTORY, {
                ...this.session,
                duration: (this.session.endTime || Date.now()) - this.session.startTime,
            });
        } catch {
            // 忽略保存错误
        }

        // 触发完成回调
        if (this.onCompleteCallback) {
            this.onCompleteCallback(this.session);
        }
    }

    // 获取当前状态
    getState(): { isRunning: boolean; currentTurn: number; session: SkitSession | null } {
        return {
            isRunning: this.isRunning,
            currentTurn: this.currentTurn,
            session: this.session,
        };
    }

    // 设置用户反应
    setUserReaction(reaction: 'like' | 'neutral' | 'skip' | 'laugh'): void {
        if (this.session) {
            this.session.userReaction = reaction;
        }
    }
}

// 创建默认引擎实例
let defaultEngine: SkitEngine | null = null;

export function getDefaultSkitEngine(): SkitEngine {
    if (!defaultEngine) {
        defaultEngine = new SkitEngine();
    }
    return defaultEngine;
}

export function resetDefaultSkitEngine(): void {
    if (defaultEngine) {
        defaultEngine.stop();
        defaultEngine = null;
    }
}
