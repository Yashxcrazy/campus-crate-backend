const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Review = require('../models/Review');
const authenticateToken = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../utils/cloudinary');

// Get user reviews - must come BEFORE /:userId
router.get('/:userId/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate('reviewer', 'name profileImage')
      .populate('item', 'title')
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const { name, phone, bio } = req.body;
    
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (bio) user.bio = bio;
    
    // Upload profile image if provided
    if (req.file) {
      const imageUrl = await uploadToCloudinary(req.file.buffer, 'campus-crate/profiles');
      user.profileImage = imageUrl;
    }
    
    await user.save();
    
    const updatedUser = await User.findById(user._id).select('-password');
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;