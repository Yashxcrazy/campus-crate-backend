const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reason: {
    type: String,
    required: true,
    enum: ['Inappropriate Content', 'Scam', 'Damaged Item', 'Misleading Description', 'Other']
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Reviewing', 'Resolved', 'Dismissed'],
    default: 'Pending'
  },
  adminNotes: String,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
