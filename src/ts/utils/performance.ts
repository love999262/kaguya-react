// 性能优化工具

// 防抖
export function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;

    return function (...args: Parameters<T>) {
        if (timeout) {
            window.clearTimeout(timeout);
        }
        timeout = window.setTimeout(() => {
            func(...args);
            timeout = null;
        }, wait);
    };
}

// 节流
export function throttle<T extends (...args: any[]) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return function (...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            window.setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

// 延迟执行（requestIdleCallback 降级）
export function scheduleIdleTask(callback: () => void): void {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(callback, { timeout: 2000 });
    } else {
        window.setTimeout(callback, 1);
    }
}

// 测量性能
export function measurePerformance<T>(
    name: string,
    fn: () => T
): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
}

// 异步测量
export async function measurePerformanceAsync<T>(
    name: string,
    fn: () => Promise<T>
): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
}

// 内存监控
export function getMemoryInfo(): { used: number; total: number; limit: number } | null {
    const memory = (performance as any).memory;
    if (memory) {
        return {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
        };
    }
    return null;
}

// 清理内存（建议浏览器回收）
export function suggestGC(): void {
    if ((window as any).gc) {
        (window as any).gc();
    }
}

// 资源预加载
export function preloadResource(url: string, as: 'script' | 'style' | 'image' | 'fetch'): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    document.head.appendChild(link);
}

// 懒加载观察器
export function createLazyLoader(
    callback: (entries: IntersectionObserverEntry[]) => void,
    options: IntersectionObserverInit = {}
): IntersectionObserver {
    const defaultOptions: IntersectionObserverInit = {
        root: null,
        rootMargin: '50px',
        threshold: 0.01,
        ...options,
    };

    return new IntersectionObserver(callback, defaultOptions);
}

// 批量处理
export async function processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10,
    delayMs: number = 0
): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);

        if (delayMs > 0 && i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return results;
}

// 缓存管理
class CacheManager<K, V> {
    private cache = new Map<K, { value: V; timestamp: number }>();
    private maxSize: number;
    private ttl: number;

    constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.value;
    }

    set(key: K, value: V): void {
        if (this.cache.size >= this.maxSize) {
            // 删除最旧的条目
            const oldest = this.cache.entries().next().value;
            if (oldest) {
                this.cache.delete(oldest[0]);
            }
        }

        this.cache.set(key, { value, timestamp: Date.now() });
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

export { CacheManager };
