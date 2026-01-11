const { cache, cacheKeys } = require('../config/cache');

/**
 * Caching middleware for GET requests
 * @param {number} ttl - Time to live in seconds
 * @param {function} keyGenerator - Function to generate cache key from request
 */
const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(req) 
      : `${req.originalUrl || req.url}`;

    // Try to get from cache
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse !== undefined) {
      console.log(`✅ Cache hit for: ${cacheKey}`);
      return res.json(cachedResponse);
    }

    // Store original json function
    const originalJson = res.json.bind(res);

    // Override json function to cache response
    res.json = (body) => {
      // Cache successful responses only
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, body, ttl);
        console.log(`💾 Cached response for: ${cacheKey} (TTL: ${ttl}s)`);
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Cache key generators for common patterns
 */
const cacheKeyGenerators = {
  // Items list with query parameters
  itemsList: (req) => {
    const params = {
      category: req.query.category,
      campus: req.query.campus,
      availability: req.query.availability,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc'
    };
    return `items:list:${JSON.stringify(params)}`;
  },
  
  // Single item by ID
  itemById: (req) => `item:${req.params.id}`,
  
  // User profile
  userProfile: (req) => `user:profile:${req.params.id}`,
  
  // User's items
  userItems: (req) => `items:user:${req.params.userId}`,
  
  // Reviews for item
  itemReviews: (req) => `reviews:item:${req.params.itemId}`,
};

module.exports = {
  cacheMiddleware,
  cacheKeyGenerators
};
