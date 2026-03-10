// 自发对话调度器

import type { ModelId, SpeechFrequencyConfig } from './config';
import { loadSpeechConfig, getRandomCooldown, selectNextSpeaker } from './config';

export type TopicType = 'holiday' | 'weather' | 'history' | 'news' | 'joke' | 'idle';

export interface TopicSource {
    type: TopicType;
    title: string;
    content: string;
    data?: any;
}

export interface SpontaneousSession {
    id: string;
    startTime: number;
    turns: Array<{
        speaker: ModelId;
        content: string;
        timestamp: number;
    }>;
    topic: TopicSource;
}

// 调度器状态
interface SchedulerState {
    lastInteractionTime: number;
    lastSpontaneousTime: number;
    currentSession: SpontaneousSession | null;
    currentTurn: number;
    isInSession: boolean;
    nextScheduledTime: number;
}

// 话题检查器类型
type TopicChecker = () => Promise<TopicSource | null>;

export class SpontaneousDialogScheduler {
    private config: SpeechFrequencyConfig;
    private state: SchedulerState;
    private topicCheckers: Map<TopicType, TopicChecker> = new Map();
    private onTriggerCallback: ((topic: TopicSource) => void) | null = null;
    private timerId: number | null = null;

    constructor(config?: Partial<SpeechFrequencyConfig>) {
        this.config = config ? { ...loadSpeechConfig(), ...config } : loadSpeechConfig();
        this.state = {
            lastInteractionTime: Date.now(),
            lastSpontaneousTime: 0,
            currentSession: null,
            currentTurn: 0,
            isInSession: false,
            nextScheduledTime: 0,
        };
    }

    // 注册话题检查器
    registerTopicChecker(type: TopicType, checker: TopicChecker): void {
        this.topicCheckers.set(type, checker);
    }

    // 设置触发回调
    onTrigger(callback: (topic: TopicSource) => void): void {
        this.onTriggerCallback = callback;
    }

    // 用户交互时调用
    markInteraction(): void {
        this.state.lastInteractionTime = Date.now();

        // 用户交互时中断当前自发对话会话
        if (this.state.isInSession) {
            this.endSession();
        }

        // 重新调度下一次触发
        this.scheduleNext();
    }

    // 开始调度
    start(): void {
        if (!this.config.enabled) return;
        this.scheduleNext();
    }

    // 停止调度
    stop(): void {
        if (this.timerId !== null) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    // 更新配置
    updateConfig(newConfig: Partial<SpeechFrequencyConfig>): void {
        this.config = { ...this.config, ...newConfig };
        // 重新调度
        if (this.config.enabled) {
            this.scheduleNext();
        } else {
            this.stop();
        }
    }

    // 获取当前配置
    getConfig(): SpeechFrequencyConfig {
        return { ...this.config };
    }

    // 检查是否应该触发
    private shouldTrigger(): boolean {
        if (!this.config.enabled) return false;

        const now = Date.now();

        // 1. 检查用户静默期
        if (now - this.state.lastInteractionTime < this.config.postInteractionSilenceMs) {
            return false;
        }

        // 2. 检查是否在会话中且已达到最大轮数
        if (this.state.isInSession && this.state.currentTurn >= this.config.turnsPerSession.max) {
            this.endSession();
            return false;
        }

        return true;
    }

    // 调度下一次触发
    private scheduleNext(): void {
        // 清除现有定时器
        if (this.timerId !== null) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }

        if (!this.config.enabled) return;

        const cooldown = getRandomCooldown(this.config);
        this.state.nextScheduledTime = Date.now() + cooldown;

        this.timerId = window.setTimeout(() => {
            this.checkAndTrigger();
        }, cooldown);
    }

    // 检查并触发
    private async checkAndTrigger(): Promise<void> {
        if (!this.shouldTrigger()) {
            this.scheduleNext();
            return;
        }

        // 选择话题
        const topic = await this.selectTopic();
        if (topic) {
            // 触发回调
            if (this.onTriggerCallback) {
                this.onTriggerCallback(topic);
            }

            // 更新状态
            this.state.lastSpontaneousTime = Date.now();

            if (!this.state.isInSession) {
                this.startSession(topic);
            } else {
                this.state.currentTurn++;
            }
        }

        // 继续调度下一次
        this.scheduleNext();
    }

    // 选择话题（按权重）
    private async selectTopic(): Promise<TopicSource | null> {
        // 按权重排序话题类型
        const sortedTypes = Object.entries(this.config.topicWeights)
            .sort((a, b) => b[1] - a[1])
            .map(([type]) => type as TopicType);

        for (const type of sortedTypes) {
            const checker = this.topicCheckers.get(type);
            if (checker) {
                try {
                    const topic = await checker();
                    if (topic) {
                        return topic;
                    }
                } catch {
                    // 忽略检查错误，继续下一个
                }
            }
        }

        // 如果没有可用话题，返回 idle
        return {
            type: 'idle',
            title: '待机',
            content: '',
        };
    }

    // 开始新会话
    private startSession(topic: TopicSource): void {
        this.state.isInSession = true;
        this.state.currentTurn = 1;
        this.state.currentSession = {
            id: `session_${Date.now()}`,
            startTime: Date.now(),
            turns: [],
            topic,
        };
    }

    // 结束会话
    private endSession(): void {
        this.state.isInSession = false;
        this.state.currentTurn = 0;
        this.state.currentSession = null;
        this.state.lastSpontaneousTime = Date.now();
    }

    // 获取当前会话信息
    getCurrentSession(): SpontaneousSession | null {
        return this.state.currentSession;
    }

    // 获取状态信息（用于调试）
    getStatus(): {
        isInSession: boolean;
        currentTurn: number;
        lastInteractionTime: number;
        lastSpontaneousTime: number;
        nextScheduledTime: number;
    } {
        return {
            isInSession: this.state.isInSession,
            currentTurn: this.state.currentTurn,
            lastInteractionTime: this.state.lastInteractionTime,
            lastSpontaneousTime: this.state.lastSpontaneousTime,
            nextScheduledTime: this.state.nextScheduledTime,
        };
    }

    // 添加会话记录
    addSessionRecord(speaker: ModelId, content: string): void {
        if (this.state.currentSession) {
            this.state.currentSession.turns.push({
                speaker,
                content,
                timestamp: Date.now(),
            });
        }
    }

    // 选择下一个说话角色
    selectSpeaker(lastSpeaker?: ModelId): ModelId {
        return selectNextSpeaker(this.config, lastSpeaker);
    }
}

// 创建默认调度器实例
let defaultScheduler: SpontaneousDialogScheduler | null = null;

export function getDefaultScheduler(): SpontaneousDialogScheduler {
    if (!defaultScheduler) {
        defaultScheduler = new SpontaneousDialogScheduler();
    }
    return defaultScheduler;
}

// 重置默认调度器
export function resetDefaultScheduler(): void {
    if (defaultScheduler) {
        defaultScheduler.stop();
        defaultScheduler = null;
    }
}
