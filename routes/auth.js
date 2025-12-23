const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, campus, studentId } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['name', 'email', 'password']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({
      name,
      email,
      password,
      phone,
      campus,
      studentId
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        campus: user.campus,
        phone: user.phone,
        profileImage: user.profileImage,
        rating: user.rating,
        isVerified: user.isVerified,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.role) {
      user.role = 'user';
      await user.save({ validateModifiedOnly: true });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated', code: 'ACCOUNT_DEACTIVATED' });
    }

    if (user.isBanned) {
      const now = new Date();
      const until = user.bannedUntil ? new Date(user.bannedUntil) : null;
      const stillBanned = until ? until > now : true;
      if (stillBanned) {
        return res.status(403).json({ success: false, message: 'Account banned', code: 'ACCOUNT_BANNED', until: user.bannedUntil, reason: user.banReason });
      }
    }

    user.lastActive = Date.now();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        rating: user.rating,
        isVerified: user.isVerified,
        role: user.role,
        reviewCount: user.reviewCount,
        createdAt: user.createdAt,
        isActive: user.isActive,
        isBanned: user.isBanned,
        bannedUntil: user.bannedUntil,
        banReason: user.banReason,
        lastActive: user.lastActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user (full doc sans password)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.role) {
      user.role = 'user';
      await user.save({ validateModifiedOnly: true });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword; // hashed by pre-save hook
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;