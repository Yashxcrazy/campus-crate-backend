const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  lendingRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LendingRequest',
    required: false
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: false
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date
}, { timestamps: true });

// Index for fast message retrieval
messageSchema.index({ lendingRequest: 1, createdAt: 1 });
messageSchema.index({ itemId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);