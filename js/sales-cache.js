/**
 * @file sales-cache.js
 * @description In-memory Cache Manager dengan TTL (Time To Live).
 */

class CacheManager {
    constructor() {
        if (CacheManager.instance) return CacheManager.instance;
        this.store = new Map();
        CacheManager.instance = this;
    }

    set(key, data, ttlSeconds = 900) {
        const expiry = Date.now() + (ttlSeconds * 1000);
        this.store.set(key, { data, expiry });
    }

    get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.store.delete(key);
            return null;
        }
        return item.data;
    }

    clear() {
        this.store.clear();
    }
}

const cacheManager = new CacheManager();
export default cacheManager;
