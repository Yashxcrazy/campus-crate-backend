const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

// Create store - use Redis if available, otherwise use default memory store
const createStore = () => {
  if (redis.isAvailable() && redis.client()) {
    console.log('✅ Rate limiter using Redis store (distributed, scalable)');
    return new RedisStore({
      client: redis.client(),
      prefix: 'rl:', // Rate limit prefix
    });
  } else {
    console.log('ℹ️ Rate limiter using memory store (single instance only)');
    return undefined; // Use default memory store
  }
};

// General API rate limiter - stricter for high concurrency
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes per IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  // Skip successful requests to only count failed ones
  skipSuccessfulRequests: false,
  // Custom key generator for better identification
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  }
});

// Auth routes - stricter to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 auth attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

// Upload routes - very strict to prevent abuse
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Max 30 uploads per hour
  message: {
    error: 'Too many uploads, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

// Read operations - more lenient
const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Max 60 requests per minute
  message: {
    error: 'Too many requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

// Write operations - moderate
const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 write requests per minute
  message: {
    error: 'Too many write operations, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

// Search operations - to prevent expensive queries
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Max 20 searches per minute
  message: {
    error: 'Too many search requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  readLimiter,
  writeLimiter,
  searchLimiter
};
