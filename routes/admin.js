const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item');
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const isManager = require('../middleware/isManager');

// GET /api/admin/users
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email role createdAt isActive isBanned bannedUntil banReason lastActive isVerified').sort({ createdAt: -1 }).lean();
    res.json({ success: true, users });
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', auth, isManager, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin', 'manager'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    // Prevent removing the last manager
    if (role !== 'manager') {
      const target = await User.findById(req.params.id);
      if (target && target.role === 'manager') {
        const managerCount = await User.countDocuments({ role: 'manager' });
        if (managerCount <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last manager' });
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: 'name email role' },
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    console.error('PUT /api/admin/users/:id/role error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// PUT /api/admin/users/:id/verify
router.put('/users/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    // Only managers may verify admins/managers
    if (req.user.role === 'admin' && (target.role === 'admin' || target.role === 'manager')) {
      return res.status(403).json({ success: false, error: 'Admins cannot verify admins/managers' });
    }

    target.isVerified = true;
    await target.save();
    res.json({ success: true, user: { _id: target._id, isVerified: target.isVerified } });
  } catch (err) {
    console.error('PUT /admin/users/:id/verify error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/admin/users/:id/reset-password
router.put('/users/:id/reset-password', auth, isAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    // Only managers may reset passwords for admins/managers
    if (req.user.role === 'admin' && (target.role === 'admin' || target.role === 'manager')) {
      return res.status(403).json({ success: false, error: 'Admins cannot reset passwords for admins/managers' });
    }

    target.password = newPassword; // hashed by pre-save hook
    await target.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('PUT /admin/users/:id/reset-password error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Deactivate a user (admin only)
router.put('/users/:id/deactivate', auth, isAdmin, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    if (req.user.role === 'admin' && (target.role === 'admin' || target.role === 'manager')) {
      return res.status(403).json({ success: false, error: 'Admins cannot deactivate admins/managers' });
    }

    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot deactivate the last active admin' });
      }
    }

    target.isActive = false;
    await target.save();
    res.json({ success: true, user: { _id: target._id, name: target.name, email: target.email, role: target.role, isActive: target.isActive } });
  } catch (err) {
    console.error('PUT /admin/users/:id/deactivate error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Ban a user (admin only)
router.put('/users/:id/ban', auth, isAdmin, async (req, res) => {
  try {
    const { reason, until } = req.body || {};
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    if (req.user.role === 'admin' && (target.role === 'admin' || target.role === 'manager')) {
      return res.status(403).json({ success: false, error: 'Admins cannot ban admins/managers' });
    }

    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot ban the last active admin' });
      }
    }

    target.isBanned = true;
    target.banReason = reason || 'Policy violation';
    target.bannedUntil = until ? new Date(until) : null;
    // Optionally also deactivate the account while banned
    target.isActive = false;
    await target.save();
    res.json({ success: true, user: { _id: target._id, name: target.name, email: target.email, role: target.role, isActive: target.isActive, isBanned: target.isBanned, banReason: target.banReason, bannedUntil: target.bannedUntil } });
  } catch (err) {
    console.error('PUT /admin/users/:id/ban error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Unban a user (admin only)
router.put('/users/:id/unban', auth, isAdmin, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    if (req.user.role === 'admin' && (target.role === 'admin' || target.role === 'manager')) {
      return res.status(403).json({ success: false, error: 'Admins cannot unban admins/managers' });
    }

    target.isBanned = false;
    target.banReason = null;
    target.bannedUntil = null;
    // Optionally reactivate account after unban
    target.isActive = true;
    await target.save();
    res.json({ success: true, user: { _id: target._id, name: target.name, email: target.email, role: target.role, isActive: target.isActive, isBanned: target.isBanned } });
  } catch (err) {
    console.error('PUT /admin/users/:id/unban error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete a user (admin only)
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    if (req.user.role === 'admin' && (target.role === 'admin' || target.role === 'manager')) {
      return res.status(403).json({ success: false, error: 'Admins cannot delete admins/managers' });
    }

    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot delete the last admin' });
      }
    }

    if (target.role === 'manager') {
      const managerCount = await User.countDocuments({ role: 'manager' });
      if (managerCount <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot delete the last manager' });
      }
    }

    // Deactivate user's items
    await Item.updateMany({ owner: target._id }, { $set: { isActive: false } });

    await target.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/users/:id error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// List all items (admin only)
router.get('/items', auth, isAdmin, async (req, res) => {
  try {
    const { isActive, page = 1, limit = 20 } = req.query;
    const query = {};
    if (typeof isActive !== 'undefined') {
      query.isActive = isActive === 'true';
    }
    const items = await Item.find(query)
      .populate('owner', 'name email role')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();
    const count = await Item.countDocuments(query);
    res.json({ success: true, items, totalItems: count, totalPages: Math.ceil(count / Number(limit)) });
  } catch (err) {
    console.error('GET /admin/items error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Deactivate an item (admin only)
router.put('/items/:id/deactivate', auth, isAdmin, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    item.isActive = false;
    await item.save();
    res.json({ success: true, item: { _id: item._id, title: item.title, isActive: item.isActive } });
  } catch (err) {
    console.error('PUT /admin/items/:id/deactivate error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete a review (admin only)
router.delete('/reviews/:id', auth, isAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });
    const revieweeId = review.reviewee;
    await review.deleteOne();
    const reviews = await Review.find({ reviewee: revieweeId });
    const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    await User.findByIdAndUpdate(revieweeId, { rating: avgRating, reviewCount: reviews.length });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/reviews/:id error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
