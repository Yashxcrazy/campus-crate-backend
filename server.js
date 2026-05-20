console.log('Starting Campus Crate Server...');

const cluster = require('cluster');
const os = require('os');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');

console.log('Loading environment variables...');
dotenv.config();

// Enable clustering for production to utilize all CPU cores
const numCPUs = os.cpus().length;
const WORKERS = process.env.WEB_CONCURRENCY || Math.min(numCPUs, 4); // Max 4 workers by default

if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  console.log(`🔧 Master process ${process.pid} is running`);
  console.log(`🚀 Starting ${WORKERS} worker processes...`);
  
  // Fork workers
  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️ Worker ${worker.process.pid} died. Starting a new worker...`);
    cluster.fork();
  });
  
} else {
  // Worker processes
  console.log('Creating Express app...');
  const app = express();
  
  // Import database connection
  const connectDB = require('./config/database');
  
  // Import Redis connection
  const redis = require('./config/redis');
  
  // Import rate limiters
  const { 
    generalLimiter, 
    authLimiter, 
    uploadLimiter 
  } = require('./middleware/rateLimit');
  
  // Import performance monitor
  const performanceMonitor = require('./middleware/performanceMonitor');
  
  startServer(app);
}

function startServer(app) {

  // Trust proxy - required for apps behind reverse proxies (Render, Heroku, etc.)
  app.set('trust proxy', 1);

  // Middleware
  console.log('Setting up middleware...');
  
  // Performance monitoring middleware (should be first)
  app.use(performanceMonitor.middleware());
  
  // Compression middleware for better network performance
  app.use(compression({
    level: 6, // Compression level (0-9)
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://lending-platform-campus-crate.vercel.app',
      'https://campus-crate-zeta.vercel.app'
    ];

console.log('📋 Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log rejected origin for debugging
    console.warn('⚠️ CORS blocked origin:', origin);
    callback(new Error(`CORS policy: Origin ${origin} is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600 // Cache preflight request for 10 minutes
}));

  // Body parser with size limits to prevent memory overflow
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Data sanitization against NoSQL query injection
  app.use(mongoSanitize());

  // Apply general rate limiting to all API routes
  app.use('/api/', generalLimiter);

// MongoDB Connection - starts in degraded mode if URI missing
console.log('Connecting to MongoDB...');

  // MongoDB Connection with optimized settings
  console.log('Connecting to MongoDB...');
  
  let mongoReady = false;
  
  // Keep readiness in sync with actual connection state
  mongoose.connection.on('connected', () => {
    mongoReady = true;
  });
  
  mongoose.connection.on('disconnected', () => {
    mongoReady = false;
  });
  
  mongoose.connection.on('error', () => {
    mongoReady = false;
  });
  
  // Initialize database connection with optimized pool settings
  connectDB().then(() => {
    mongoReady = mongoose.connection.readyState === 1;
    
    // Create indexes for better query performance (only in production)
    if (process.env.NODE_ENV === 'production' && mongoReady) {
      const { createIndexes } = require('./utils/dbIndexes');
      createIndexes().catch(err => {
        console.error('Error creating indexes:', err);
      });
    }
  }).catch(err => {
    console.error('Database connection failed:', err);
  });

  // Initialize Redis connection (optional - for caching)
  console.log('Connecting to Redis...');
  redis.connectRedis();
  
  // Add middleware to check DB connection for API routes
  app.use('/api/', (req, res, next) => {
    if (!process.env.MONGODB_URI) {
      console.warn(`⚠️ Blocked ${req.method} ${req.path} - MongoDB not configured`);
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database is not configured. Please set MONGODB_URI environment variable.',
        status: 503
      });
    }

    if (!mongoReady) {
      console.warn(`⚠️ Blocked ${req.method} ${req.path} - MongoDB not connected`);
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database connection unavailable. Please try again shortly.',
        status: 503
      });
    }

    next();
  });

  // Import Routes
  console.log('Loading routes...');
  const authRoutes = require('./routes/auth');
  const itemRoutes = require('./routes/Items');
  const lendingRoutes = require('./routes/Lending');
  const messageRoutes = require('./routes/Messages');
  const uploadRoutes = require('./routes/Upload');
  const userRoutes = require('./routes/Users');
  const reviewRoutes = require('./routes/Reviews');
  const adminRoutes = require('./routes/admin');
  const reportRoutes = require('./routes/reports');
  const verificationRoutes = require('./routes/verificationRequests');
  const aiRoutes = require('./routes/ai');

  // Middleware for authentication
  const auth = require('./middleware/auth');
  const authenticateToken = auth;

  // Use Routes with specific rate limiters
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/lending', lendingRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/upload', uploadLimiter, uploadRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/verification-requests', auth, verificationRoutes);
  app.use('/api/ai', aiRoutes);

  // Health check
  app.get('/health', (req, res) => {
    const metrics = performanceMonitor.getMetrics();
    res.status(200).json(metrics);
  });

  // Metrics endpoint (detailed performance data)
  app.get('/api/metrics', authenticateToken, (req, res) => {
    // Only allow admins to view detailed metrics
    const User = require('./models/User');
    User.findById(req.userId).then(user => {
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      const metrics = performanceMonitor.getMetrics();
      res.json(metrics);
    }).catch(() => {
      res.status(500).json({ message: 'Error fetching metrics' });
    });
  });

  // Root route
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Welcome to Campus Crate API',
      version: '2.0.0',
      worker: cluster.isWorker ? cluster.worker.id : 'single',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        items: '/api/items',
        lending: '/api/lending',
        messages: '/api/messages',
        upload: '/api/upload'
      }
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: {
        message: 'Endpoint not found',
        path: req.path
      }
    });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal Server Error',
        status: err.status || 500
      }
    });
  });

  const PORT = process.env.PORT || 5000;
  console.log(`Starting server on port ${PORT}...`);

  const server = app.listen(PORT, () => {
    console.log(`🚀 Worker ${process.pid} running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });

  console.log('Server setup complete!');
}