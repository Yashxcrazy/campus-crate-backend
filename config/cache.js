const NodeCache = require('node-cache');

// In-memory cache for high-performance caching
// Use Redis for distributed deployments (multiple server instances)
const cache = new NodeCache({
  stdTTL: 300, // Default TTL: 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Don't clone cached objects for better performance
  deleteOnExpire: true,
  maxKeys: 10000 // Maximum number of keys to prevent memory overflow
});

// Cache wrapper with logging
const cacheWrapper = {
  get: (key) => {
    const value = cache.get(key);
    if (value !== undefined) {
      console.log(`✅ Cache HIT: ${key}`);
    }
    return value;
  },
  
  set: (key, value, ttl) => {
    const result = cache.set(key, value, ttl);
    if (result) {
      console.log(`💾 Cache SET: ${key} (TTL: ${ttl || 'default'}s)`);
    }
    return result;
  },
  
  del: (key) => {
    const result = cache.del(key);
    console.log(`🗑️ Cache DELETE: ${key}`);
    return result;
  },
  
  flush: () => {
    cache.flushAll();
    console.log('🗑️ Cache FLUSHED');
  },
  
  keys: () => cache.keys(),
  
  stats: () => cache.getStats()
};

// Cache key generators
const cacheKeys = {
  item: (id) => `item:${id}`,
  items: (query) => `items:${JSON.stringify(query)}`,
  user: (id) => `user:${id}`,
  userProfile: (id) => `user:profile:${id}`,
  itemsByOwner: (ownerId) => `items:owner:${ownerId}`,
  lendingRequests: (userId) => `lending:user:${userId}`,
  reviews: (itemId) => `reviews:item:${itemId}`,
  userReviews: (userId) => `reviews:user:${userId}`,
};

// Cache invalidation helpers
const invalidateCache = {
  item: (id) => {
    cacheWrapper.del(cacheKeys.item(id));
    // Also invalidate related caches
    const keys = cacheWrapper.keys();
    keys.forEach(key => {
      if (key.startsWith('items:')) {
        cacheWrapper.del(key);
      }
    });
  },
  
  user: (id) => {
    cacheWrapper.del(cacheKeys.user(id));
    cacheWrapper.del(cacheKeys.userProfile(id));
  },
  
  all: () => {
    cacheWrapper.flush();
  }
};

module.exports = {
  cache: cacheWrapper,
  cacheKeys,
  invalidateCache
};
