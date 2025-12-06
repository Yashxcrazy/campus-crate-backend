console.log('Starting server...');

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
  origin: [
    'http://localhost:3000',
    'https://campus-crate-zeta.vercel.app',
    'https://campus-crate-git-main-yashxcrazys-projects.vercel.app',
    'https://campus-crate-jog4fiqpd-yashxcrazys-projects.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// MongoDB Connection
console.log('Connecting to MongoDB...');
console.log('MongoDB URI:', process.env.MONGODB_URI);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mmzankyani_db_user:cU0exLpZWzEwDfxb@cluster0.vbmk5rv.mongodb.net/campus_crate?retryWrites=true&w=majority';
mongoose.connect(MONGODB_URI)

.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Import Routes
console.log('Loading routes...');
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/Items');
const lendingRoutes = require('./routes/Lending');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/lending', lendingRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Campus Crate API is running',
    timestamp: new Date() 
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
      lending: '/api/lending'
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

console.log('Starting server on port', PORT);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});

console.log('Server setup complete!');