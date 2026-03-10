// 降级策略管理

export type ServiceType = 'llm' | 'news' | 'weather' | 'history' | 'translation';

export interface FallbackChain {
    primary: string;
    fallbacks: string[];
}

export const FALLBACK_CHAINS: Record<ServiceType, FallbackChain> = {
    llm: {
        primary: 'webllm-local',
        fallbacks: ['webllm-smaller-model', 'rule-based', 'static-response'],
    },
    news: {
        primary: 'rss-aggregate',
        fallbacks: ['single-rss-source', 'local-static-news', 'empty-list'],
    },
    weather: {
        primary: 'nmc-api',
        fallbacks: ['open-meteo', 'local-cache', 'default-shanghai'],
    },
    history: {
        primary: 'wikipedia-api',
        fallbacks: ['local-cache', 'static-data', 'empty-list'],
    },
    translation: {
        primary: 'webllm-translate',
        fallbacks: ['local-dictionary', 'pass-through'],
    },
};

// 服务状态
interface ServiceStatus {
    failures: number;
    lastFailure: number;
    currentLevel: number;
    isHealthy: boolean;
}

const FAILURE_THRESHOLD = 3;
const RECOVERY_TIME = 5 * 60 * 1000; // 5分钟

class FallbackManager {
    private statuses = new Map<ServiceType, ServiceStatus>();

    // 记录失败
    recordFailure(service: ServiceType): void {
        const status = this.getStatus(service);
        status.failures++;
        status.lastFailure = Date.now();

        if (status.failures >= FAILURE_THRESHOLD) {
            status.isHealthy = false;
            this.escalateFallback(service);
        }
    }

    // 记录成功
    recordSuccess(service: ServiceType): void {
        const status = this.getStatus(service);
        status.failures = 0;
        status.isHealthy = true;

        // 尝试恢复
        if (status.currentLevel > 0) {
            this.tryRecover(service);
        }
    }

    // 获取当前降级级别
    getCurrentLevel(service: ServiceType): number {
        return this.getStatus(service).currentLevel;
    }

    // 获取当前策略
    getCurrentStrategy(service: ServiceType): string {
        const chain = FALLBACK_CHAINS[service];
        const level = this.getCurrentLevel(service);

        if (level === 0) {
            return chain.primary;
        }

        return chain.fallbacks[Math.min(level - 1, chain.fallbacks.length - 1)] || chain.fallbacks[chain.fallbacks.length - 1];
    }

    // 检查服务是否健康
    isHealthy(service: ServiceType): boolean {
        const status = this.getStatus(service);

        // 如果处于降级状态，检查是否可以恢复
        if (!status.isHealthy) {
            const timeSinceFailure = Date.now() - status.lastFailure;
            if (timeSinceFailure > RECOVERY_TIME) {
                status.isHealthy = true;
                status.failures = 0;
                return true;
            }
        }

        return status.isHealthy;
    }

    // 重置服务状态
    reset(service: ServiceType): void {
        this.statuses.set(service, {
            failures: 0,
            lastFailure: 0,
            currentLevel: 0,
            isHealthy: true,
        });
    }

    // 获取所有服务状态
    getAllStatuses(): Record<ServiceType, ServiceStatus> {
        const result = {} as Record<ServiceType, ServiceStatus>;
        for (const service of Object.keys(FALLBACK_CHAINS) as ServiceType[]) {
            result[service] = this.getStatus(service);
        }
        return result;
    }

    private getStatus(service: ServiceType): ServiceStatus {
        if (!this.statuses.has(service)) {
            this.statuses.set(service, {
                failures: 0,
                lastFailure: 0,
                currentLevel: 0,
                isHealthy: true,
            });
        }
        return this.statuses.get(service)!;
    }

    private escalateFallback(service: ServiceType): void {
        const status = this.getStatus(service);
        const chain = FALLBACK_CHAINS[service];

        if (status.currentLevel < chain.fallbacks.length) {
            status.currentLevel++;
            console.warn(`[Fallback] ${service} escalated to level ${status.currentLevel}: ${this.getCurrentStrategy(service)}`);
        }
    }

    private tryRecover(service: ServiceType): void {
        const status = this.getStatus(service);

        // 逐步降级恢复级别
        if (status.currentLevel > 0) {
            status.currentLevel--;
            console.log(`[Fallback] ${service} recovering to level ${status.currentLevel}`);
        }
    }
}

// 单例实例
let fallbackManager: FallbackManager | null = null;

export function getFallbackManager(): FallbackManager {
    if (!fallbackManager) {
        fallbackManager = new FallbackManager();
    }
    return fallbackManager;
}

// 带降级策略的包装函数
export async function withFallback<T>(
    service: ServiceType,
    primaryFn: () => Promise<T>,
    fallbackFns: Array<() => Promise<T>>,
    defaultValue: T
): Promise<T> {
    const manager = getFallbackManager();

    // 检查服务健康状态
    if (!manager.isHealthy(service)) {
        const level = manager.getCurrentLevel(service);
        if (level < fallbackFns.length) {
            try {
                const result = await fallbackFns[level]();
                manager.recordSuccess(service);
                return result;
            } catch {
                manager.recordFailure(service);
            }
        }
        return defaultValue;
    }

    // 尝试主服务
    try {
        const result = await primaryFn();
        manager.recordSuccess(service);
        return result;
    } catch (error) {
        manager.recordFailure(service);

        // 尝试降级方案
        for (let i = 0; i < fallbackFns.length; i++) {
            try {
                const result = await fallbackFns[i]();
                manager.recordSuccess(service);
                return result;
            } catch {
                manager.recordFailure(service);
            }
        }

        return defaultValue;
    }
}

// 网络状态监控
export function initNetworkMonitor(): void {
    const manager = getFallbackManager();

    window.addEventListener('online', () => {
        console.log('[Network] Back online');
        // 重置所有服务状态
        for (const service of Object.keys(FALLBACK_CHAINS) as ServiceType[]) {
            manager.reset(service);
        }
    });

    window.addEventListener('offline', () => {
        console.log('[Network] Gone offline');
        // 立即降级到本地策略
        for (const service of Object.keys(FALLBACK_CHAINS) as ServiceType[]) {
            const status = (manager as any).getStatus(service);
            status.isHealthy = false;
            status.currentLevel = FALLBACK_CHAINS[service].fallbacks.length;
        }
    });
}
