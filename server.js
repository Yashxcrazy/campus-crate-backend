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

// Middleware
console.log('Setting up middleware...');
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Allow ALL your Vercel deployments (any URL with vercel.app and your pattern)
    if (origin.includes('vercel.app') && 
        (origin.includes('campus-crate') || origin.includes('lending-platform-campus-crate'))) {
      return callback(null, true);
    }
    
    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// MongoDB Connection - SECURITY FIX: Only use environment variable
console.log('Connecting to MongoDB...');

if (!process.env.MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI not set in environment variables!');
  console.error('Please create a .env file with your MongoDB connection string.');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
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

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/lending', lendingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);

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