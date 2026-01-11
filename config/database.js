const mongoose = require('mongoose');

// Database connection with optimized settings for high concurrency
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️ WARNING: MONGODB_URI not set in environment variables!');
    console.warn('⚠️ Server starting in DEGRADED MODE - database endpoints will not work');
    return null;
  }

  try {
    const options = {
      // Connection pool settings for high concurrency
      maxPoolSize: 100, // Maximum number of connections in the pool (increased for 2000 concurrent users)
      minPoolSize: 10,  // Minimum number of connections maintained
      
      // Timeout settings
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      
      // Reliability settings
      retryWrites: true,
      w: 'majority',
      
      // Performance optimizations
      autoIndex: false, // Disable auto-indexing in production (create indexes manually)
      bufferCommands: false, // Disable buffering for better error handling
      
      // Compression for better network performance
      compressors: ['zlib'],
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection pool: ${options.minPoolSize}-${options.maxPoolSize} connections`);
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    // Don't exit process - allow degraded mode
    return null;
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
});

module.exports = connectDB;
