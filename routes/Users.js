const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Review = require('../models/Review');
const Item = require('../models/Item');
const LendingRequest = require('../models/LendingRequest');
const Notification = require('../models/Notification');
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

// Preferences - get
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('notificationPreferences privacyPreferences');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      notificationPreferences: user.notificationPreferences,
      privacyPreferences: user.privacyPreferences,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Preferences - update
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { notificationPreferences, privacyPreferences } = req.body || {};
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (notificationPreferences && typeof notificationPreferences === 'object') {
      const np = notificationPreferences;
      if (typeof np.email === 'boolean') user.notificationPreferences.email = np.email;
      if (typeof np.sms === 'boolean') user.notificationPreferences.sms = np.sms;
    }
    if (privacyPreferences && typeof privacyPreferences === 'object') {
      const pp = privacyPreferences;
      if (typeof pp.showEmail === 'boolean') user.privacyPreferences.showEmail = pp.showEmail;
      if (typeof pp.showPhone === 'boolean') user.privacyPreferences.showPhone = pp.showPhone;
    }

    await user.save();
    res.json({
      message: 'Preferences updated',
      preferences: {
        notificationPreferences: user.notificationPreferences,
        privacyPreferences: user.privacyPreferences,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete account (hard delete with password verification)
router.post('/me/delete', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete account' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Cascade delete related data
    await Promise.all([
      Item.deleteMany({ owner: user._id }),
      LendingRequest.deleteMany({ $or: [{ borrower: user._id }, { lender: user._id }] }),
      Review.deleteMany({ $or: [{ reviewer: user._id }, { reviewee: user._id }] }),
      Notification.deleteMany({ user: user._id }),
    ]);

    await user.deleteOne();

    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});