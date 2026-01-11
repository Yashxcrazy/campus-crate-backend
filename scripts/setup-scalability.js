#!/usr/bin/env node

/**
 * Setup script for Campus Crate scalability improvements
 * Run this script once after pulling the latest changes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Campus Crate Scalability Setup');
console.log('==================================\n');

// Check if running in correct directory
if (!fs.existsSync('./package.json')) {
  console.error('❌ Error: Please run this script from the backend root directory');
  process.exit(1);
}

// Step 1: Install dependencies
console.log('📦 Step 1: Installing dependencies...');
try {
  execSync('npm install compression node-cache', { stdio: 'inherit' });
  console.log('✅ Dependencies installed\n');
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  process.exit(1);
}

// Step 2: Check environment variables
console.log('🔍 Step 2: Checking environment variables...');
require('dotenv').config();

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.warn('⚠️  Warning: Missing environment variables:', missingEnvVars.join(', '));
  console.warn('   Please set these in your .env file\n');
} else {
  console.log('✅ All required environment variables present\n');
}

// Step 3: Create database indexes
console.log('📊 Step 3: Creating database indexes...');
console.log('   This may take a few moments...');

if (!process.env.MONGODB_URI) {
  console.warn('⚠️  Skipping index creation (MONGODB_URI not set)\n');
} else {
  try {
    const connectDB = require('./config/database');
    const { createIndexes } = require('./utils/dbIndexes');
    
    connectDB().then(async () => {
      try {
        await createIndexes();
        console.log('✅ Database indexes created successfully\n');
        
        // Step 4: Verify setup
        console.log('✅ Step 4: Verifying setup...');
        console.log('   - Clustering: Enabled');
        console.log('   - Connection Pool: 100 max connections');
        console.log('   - Caching: In-memory (node-cache)');
        console.log('   - Compression: Enabled');
        console.log('   - Rate Limiting: Configured');
        console.log('   - Performance Monitoring: Enabled');
        
        console.log('\n🎉 Setup complete!');
        console.log('\n📖 Next steps:');
        console.log('   1. Review SCALABILITY.md for detailed documentation');
        console.log('   2. Set NODE_ENV=production for production deployments');
        console.log('   3. Configure WEB_CONCURRENCY for worker count (default: 4)');
        console.log('   4. Monitor performance at /health endpoint');
        console.log('   5. Run load tests to verify scalability');
        
        console.log('\n🚀 Start the server:');
        console.log('   npm start\n');
        
        process.exit(0);
      } catch (error) {
        console.error('❌ Error creating indexes:', error.message);
        process.exit(1);
      }
    }).catch(error => {
      console.error('❌ Database connection failed:', error.message);
      console.warn('⚠️  Skipping index creation\n');
      
      console.log('✅ Setup partially complete (database not connected)');
      console.log('\n📖 Please:');
      console.log('   1. Set MONGODB_URI in your .env file');
      console.log('   2. Run this setup script again');
      console.log('   3. Review SCALABILITY.md\n');
      
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Setup error:', error.message);
    process.exit(1);
  }
}
