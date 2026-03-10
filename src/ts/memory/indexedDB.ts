// IndexedDB 封装与初始化

import {
    DB_NAME,
    DB_VERSION,
    StoreNames,
    type ConversationRecord,
    type LongTermMemory,
    type SkitRecord,
    type UserPreference,
    type MemoryRetrievalOptions,
    type MemoryOwner,
    type MemoryType,
} from './types';

let dbInstance: IDBDatabase | null = null;

// 初始化数据库
export async function initMemoryDB(): Promise<IDBDatabase> {
    if (dbInstance) {
        return dbInstance;
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const oldVersion = event.oldVersion;

            // 创建对话记录表
            if (!db.objectStoreNames.contains(StoreNames.CONVERSATIONS)) {
                const convStore = db.createObjectStore(StoreNames.CONVERSATIONS, {
                    keyPath: 'id',
                });
                convStore.createIndex('timestamp', 'timestamp', { unique: false });
                convStore.createIndex('role', 'role', { unique: false });
                convStore.createIndex('sessionId', 'sessionId', { unique: false });
            }

            // 创建长期记忆表
            if (!db.objectStoreNames.contains(StoreNames.LONG_TERM_MEMORY)) {
                const memStore = db.createObjectStore(StoreNames.LONG_TERM_MEMORY, {
                    keyPath: 'id',
                });
                memStore.createIndex('type', 'type', { unique: false });
                memStore.createIndex('owner', 'owner', { unique: false });
                memStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                memStore.createIndex('keywords', 'keywords', { unique: false, multiEntry: true });
                memStore.createIndex('confidence', 'confidence', { unique: false });
            }

            // 创建小剧场历史表
            if (!db.objectStoreNames.contains(StoreNames.SKIT_HISTORY)) {
                const skitStore = db.createObjectStore(StoreNames.SKIT_HISTORY, {
                    keyPath: 'id',
                });
                skitStore.createIndex('timestamp', 'timestamp', { unique: false });
                skitStore.createIndex('topicType', 'topicType', { unique: false });
            }

            // 创建用户偏好表
            if (!db.objectStoreNames.contains(StoreNames.USER_PREFERENCES)) {
                const prefStore = db.createObjectStore(StoreNames.USER_PREFERENCES, {
                    keyPath: 'key',
                });
                prefStore.createIndex('category', 'category', { unique: false });
                prefStore.createIndex('owner', 'owner', { unique: false });
            }
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

// 获取数据库实例
export async function getDB(): Promise<IDBDatabase> {
    if (!dbInstance) {
        return initMemoryDB();
    }
    return dbInstance;
}

// 关闭数据库
export function closeDB(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}

// 通用添加方法
export async function addRecord<T>(
    storeName: StoreNames,
    record: T
): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(record);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// 通用更新方法
export async function putRecord<T>(
    storeName: StoreNames,
    record: T
): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// 通用删除方法
export async function deleteRecord(
    storeName: StoreNames,
    key: string
): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// 通用获取方法
export async function getRecord<T>(
    storeName: StoreNames,
    key: string
): Promise<T | undefined> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 获取所有记录
export async function getAllRecords<T>(storeName: StoreNames): Promise<T[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

// 按索引获取记录
export async function getByIndex<T>(
    storeName: StoreNames,
    indexName: string,
    value: IDBValidKey
): Promise<T[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

// 获取最近 N 条记录
export async function getRecentRecords<T extends { timestamp: number }>(
    storeName: StoreNames,
    count: number
): Promise<T[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index('timestamp');
        const request = index.openCursor(null, 'prev');

        const results: T[] = [];

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor && results.length < count) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

// 清空表
export async function clearStore(storeName: StoreNames): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// 获取记录数量
export async function getRecordCount(storeName: StoreNames): Promise<number> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 删除旧记录（保留最近 N 条）
export async function trimOldRecords(
    storeName: StoreNames,
    keepCount: number
): Promise<number> {
    const db = await getDB();
    const totalCount = await getRecordCount(storeName);

    if (totalCount <= keepCount) {
        return 0;
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const index = store.index('timestamp');
        const request = index.openCursor();

        let deletedCount = 0;
        const toDelete = totalCount - keepCount;

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor && deletedCount < toDelete) {
                store.delete(cursor.primaryKey);
                deletedCount++;
                cursor.continue();
            } else {
                resolve(deletedCount);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

// 导出数据库统计
export async function getDBStats(): Promise<{
    conversations: number;
    memories: number;
    skits: number;
    preferences: number;
}> {
    const [conversations, memories, skits, preferences] = await Promise.all([
        getRecordCount(StoreNames.CONVERSATIONS),
        getRecordCount(StoreNames.LONG_TERM_MEMORY),
        getRecordCount(StoreNames.SKIT_HISTORY),
        getRecordCount(StoreNames.USER_PREFERENCES),
    ]);

    return {
        conversations,
        memories,
        skits,
        preferences,
    };
}
