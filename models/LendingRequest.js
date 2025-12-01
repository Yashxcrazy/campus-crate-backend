const mongoose = require('mongoose');

const lendingRequestSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Active', 'Completed', 'Cancelled', 'Disputed'],
    default: 'Pending'
  },
  totalCost: {
    type: Number,
    required: true
  },
  securityDeposit: {
    type: Number,
    required: true
  },
  message: String,
  pickupLocation: String,
  returnLocation: String,
  actualReturnDate: Date,
  lateReturnDays: {
    type: Number,
    default: 0
  },
  lateFee: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Refunded', 'Partial Refund'],
    default: 'Pending'
  },
  paymentMethod: String,
  transactionId: String,
  depositRefunded: {
    type: Boolean,
    default: false
  },
  cancellationReason: String,
  disputeDetails: String
}, { timestamps: true });

module.exports = mongoose.model('LendingRequest', lendingRequestSchema);