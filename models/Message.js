const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  lendingRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LendingRequest',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

module.exports = mongoose.model('Message', messageSchema);