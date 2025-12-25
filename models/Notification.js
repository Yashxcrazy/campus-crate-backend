const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['LendingRequest', 'RequestAccepted', 'RequestRejected', 'ReturnReminder', 'LateReturn', 'Review', 'Message', 'System', 'Verification', 'VerificationMessage'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: mongoose.Schema.Types.ObjectId,
  isRead: {
    type: Boolean,
    default: false
  },
  link: String
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);