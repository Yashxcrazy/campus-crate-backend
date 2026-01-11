const Redis = require('ioredis');

let redisClient = null;
let isRedisAvailable = false;

// Redis configuration for Render (works with Render's Redis add-on)
const connectRedis = () => {
  // Redis is optional - app works without it but with reduced performance
  if (!process.env.REDIS_URL) {
    console.log('ℹ️ Redis not configured - running without cache (reduced performance)');
    console.log('💡 To enable Redis on Render: Add Redis service and set REDIS_URL env variable');
    return null;
  }

  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true; // Reconnect
        }
        return false;
      },
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis ready to accept commands');
      isRedisAvailable = true;
    });

    redisClient.on('close', () => {
      console.log('⚠️ Redis connection closed');
      isRedisAvailable = false;
    });

    return redisClient;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    return null;
  }
};

// Get cache with fallback
const getCache = async (key) => {
  if (!isRedisAvailable || !redisClient) {
    return null;
  }

  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis get error:', error.message);
    return null;
  }
};

// Set cache with TTL (time to live in seconds)
const setCache = async (key, value, ttl = 300) => {
  if (!isRedisAvailable || !redisClient) {
    return false;
  }

  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis set error:', error.message);
    return false;
  }
};

// Delete cache key
const deleteCache = async (key) => {
  if (!isRedisAvailable || !redisClient) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis delete error:', error.message);
    return false;
  }
};

// Clear all cache (use with caution)
const clearCache = async () => {
  if (!isRedisAvailable || !redisClient) {
    return false;
  }

  try {
    await redisClient.flushdb();
    return true;
  } catch (error) {
    console.error('Redis clear error:', error.message);
    return false;
  }
};

// Check if Redis is available
const isAvailable = () => isRedisAvailable;

module.exports = {
  connectRedis,
  getCache,
  setCache,
  deleteCache,
  clearCache,
  isAvailable,
  client: () => redisClient
};
