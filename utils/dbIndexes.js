const mongoose = require('mongoose');

/**
 * Create database indexes for optimized queries
 * Run this script once after deployment or schema changes
 */
async function createIndexes() {
  try {
    console.log('Creating database indexes...');
    
    const db = mongoose.connection.db;
    
    // User indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ studentId: 1 });
    await db.collection('users').createIndex({ campus: 1 });
    await db.collection('users').createIndex({ isVerified: 1 });
    await db.collection('users').createIndex({ rating: -1 }); // For sorting by rating
    await db.collection('users').createIndex({ createdAt: -1 }); // For recent users
    console.log('✅ User indexes created');
    
    // Item indexes
    await db.collection('items').createIndex({ owner: 1 });
    await db.collection('items').createIndex({ category: 1 });
    await db.collection('items').createIndex({ availability: 1 });
    await db.collection('items').createIndex({ 'location.campus': 1 });
    await db.collection('items').createIndex({ dailyRate: 1 }); // For price sorting
    await db.collection('items').createIndex({ createdAt: -1 }); // For recent items
    // Compound indexes for common queries
    await db.collection('items').createIndex({ category: 1, availability: 1 });
    await db.collection('items').createIndex({ 'location.campus': 1, availability: 1 });
    await db.collection('items').createIndex({ owner: 1, availability: 1 });
    // Text index for search
    await db.collection('items').createIndex({ 
      title: 'text', 
      description: 'text',
      category: 'text'
    }, {
      weights: {
        title: 10,
        category: 5,
        description: 1
      }
    });
    console.log('✅ Item indexes created');
    
    // LendingRequest indexes
    await db.collection('lendingrequests').createIndex({ borrower: 1 });
    await db.collection('lendingrequests').createIndex({ owner: 1 });
    await db.collection('lendingrequests').createIndex({ item: 1 });
    await db.collection('lendingrequests').createIndex({ status: 1 });
    await db.collection('lendingrequests').createIndex({ createdAt: -1 });
    // Compound indexes for common queries
    await db.collection('lendingrequests').createIndex({ borrower: 1, status: 1 });
    await db.collection('lendingrequests').createIndex({ owner: 1, status: 1 });
    await db.collection('lendingrequests').createIndex({ item: 1, status: 1 });
    console.log('✅ LendingRequest indexes created');
    
    // Message indexes
    await db.collection('messages').createIndex({ sender: 1 });
    await db.collection('messages').createIndex({ receiver: 1 });
    await db.collection('messages').createIndex({ conversation: 1 });
    await db.collection('messages').createIndex({ createdAt: -1 });
    // Compound indexes
    await db.collection('messages').createIndex({ conversation: 1, createdAt: -1 });
    await db.collection('messages').createIndex({ receiver: 1, read: 1 }); // For unread messages
    console.log('✅ Message indexes created');
    
    // Review indexes
    await db.collection('reviews').createIndex({ reviewer: 1 });
    await db.collection('reviews').createIndex({ reviewee: 1 });
    await db.collection('reviews').createIndex({ item: 1 });
    await db.collection('reviews').createIndex({ lendingRequest: 1 });
    await db.collection('reviews').createIndex({ createdAt: -1 });
    await db.collection('reviews').createIndex({ rating: -1 });
    console.log('✅ Review indexes created');
    
    // Notification indexes
    await db.collection('notifications').createIndex({ user: 1 });
    await db.collection('notifications').createIndex({ read: 1 });
    await db.collection('notifications').createIndex({ createdAt: -1 });
    await db.collection('notifications').createIndex({ user: 1, read: 1 }); // For unread notifications
    console.log('✅ Notification indexes created');
    
    // Report indexes
    await db.collection('reports').createIndex({ reporter: 1 });
    await db.collection('reports').createIndex({ reportedUser: 1 });
    await db.collection('reports').createIndex({ reportedItem: 1 });
    await db.collection('reports').createIndex({ status: 1 });
    await db.collection('reports').createIndex({ createdAt: -1 });
    console.log('✅ Report indexes created');
    
    // Verification Request indexes
    await db.collection('verificationrequests').createIndex({ user: 1 });
    await db.collection('verificationrequests').createIndex({ status: 1 });
    await db.collection('verificationrequests').createIndex({ createdAt: -1 });
    console.log('✅ VerificationRequest indexes created');
    
    console.log('🎉 All database indexes created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

module.exports = { createIndexes };
