console.log('Starting Campus Crate Server...');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

console.log('Loading environment variables...');
dotenv.config();

console.log('Creating Express app...');
const app = express();

// Trust proxy - required for apps behind reverse proxies (Render, Heroku, etc.)
app.set('trust proxy', 1);

// Middleware
console.log('Setting up middleware...');
app.use(helmet());

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// MongoDB Connection - starts in degraded mode if URI missing
console.log('Connecting to MongoDB...');

let mongoReady = false;

// Keep readiness in sync with actual connection state
mongoose.connection.on('connected', () => {
  mongoReady = true;
  console.log('✅ MongoDB connected successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);
});

mongoose.connection.on('disconnected', () => {
  mongoReady = false;
  console.warn('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  mongoReady = false;
  console.error('❌ MongoDB connection error:', err.message);
});

if (!process.env.MONGODB_URI) {
  console.warn('⚠️ WARNING: MONGODB_URI not set in environment variables!');
  console.warn('⚠️ Server starting in DEGRADED MODE - database endpoints will not work');
  console.warn('⚠️ Set MONGODB_URI in your environment to enable database features');
} else {
  mongoose.connect(process.env.MONGODB_URI, {
    // Connection options for better reliability
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }).catch(err => {
    // Error already logged by event listener; keep degraded but running
    console.warn('⚠️ Server starting in DEGRADED MODE - database features unavailable');
    console.warn('ℹ️  Non-database endpoints (health check, etc.) will still work');
  });
}

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

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/lending', lendingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Campus Crate API is running',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Campus Crate API',
    version: '1.0.0',
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
});

console.log('Server setup complete!');