const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// GET /api/admin/users
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email role createdAt').sort({ createdAt: -1 }).lean();
    res.json({ success: true, users });
  } catch (err) {
    console.error('GET /api/admin/users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', auth, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

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

module.exports = router;
