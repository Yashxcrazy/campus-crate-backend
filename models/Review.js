const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  lendingRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LendingRequest',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Lender', 'Borrower'],
    required: true
  },
  categories: {
    communication: Number,
    condition: Number,
    punctuality: Number
  }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);