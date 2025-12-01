const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Electronics', 'Books', 'Sports Equipment', 'Tools', 'Musical Instruments', 'Furniture', 'Appliances', 'Other']
  },
  images: [{
    type: String
  }],
  condition: {
    type: String,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
    default: 'Good'
  },
  dailyRate: {
    type: Number,
    required: true,
    min: 0
  },
  securityDeposit: {
    type: Number,
    required: true,
    min: 0
  },
  availability: {
    type: String,
    enum: ['Available', 'Rented', 'Maintenance', 'Unavailable'],
    default: 'Available'
  },
  location: {
    address: String,
    campus: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  tags: [String],
  minLendingPeriod: {
    type: Number,
    default: 1
  },
  maxLendingPeriod: {
    type: Number,
    default: 30
  },
  viewCount: {
    type: Number,
    default: 0
  },
  favoriteCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);