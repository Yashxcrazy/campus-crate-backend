const express = require('express');
const router = express.Router();
const VerificationRequest = require('../models/VerificationRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const isAdmin = require('../middleware/isAdmin');

// Helpers
const sendNotification = async ({ userId, title, message, relatedId, link, type = 'Verification' }) => {
  try {
    const notif = new Notification({ user: userId, type, title, message, relatedId, link });
    await notif.save();
  } catch (err) {
    console.error('Failed to send notification', err.message);
  }
};

// POST /api/verification-requests
// Create or reuse a pending verification request for the logged-in user
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'User is already verified' });

    const { message } = req.body || {};

    // Ensure only one active request per user
    let request = await VerificationRequest.findOne({ user: userId });
    if (request) {
      request.message = message || request.message;
      request.status = 'pending';
      request.adminNote = '';
      request.reviewedBy = undefined;
      request.reviewedAt = undefined;
      await request.save();
    } else {
      request = await VerificationRequest.create({ user: userId, message: message || '' });
    }

    await request.populate('user', 'name email isVerified');

    res.status(201).json({ message: 'Verification request submitted', request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/verification-requests/me - fetch current user's request
router.get('/me', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const request = await VerificationRequest.findOne({ user: userId }).populate('user', 'name email isVerified');
    if (!request) return res.json({ request: null });

    res.json({ request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ADMIN: GET /api/verification-requests
router.get('/', isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    const requests = await VerificationRequest.find(query)
      .populate('user', 'name email isVerified role')
      .populate('adminMessages.sender', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ADMIN: PUT /api/verification-requests/:id/status
router.put('/:id/status', isAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body || {};
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await VerificationRequest.findById(req.params.id).populate('user');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    request.status = status;
    request.adminNote = adminNote || request.adminNote;
    request.reviewedBy = req.userId;
    request.reviewedAt = new Date();
    await request.save();

    // Auto-verify user when approved
    if (status === 'approved' && request.user && !request.user.isVerified) {
      request.user.isVerified = true;
      await request.user.save();
    }

    await sendNotification({
      userId: request.user?._id,
      title: 'Verification update',
      message: `Your verification request is ${status}.`,
      relatedId: request._id,
      link: '/profile',
      type: 'Verification',
    });

    await request.populate('user', 'name email isVerified role');
    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ADMIN: POST /api/verification-requests/:id/message
router.post('/:id/message', isAdmin, async (req, res) => {
  try {
    const { content } = req.body || {};
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content required' });
    }

    const request = await VerificationRequest.findById(req.params.id).populate('user', 'email name');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    request.adminMessages.push({ sender: req.userId, content: content.trim() });
    await request.save();

    await sendNotification({
      userId: request.user?._id,
      title: 'Verification message',
      message: content.slice(0, 140),
      relatedId: request._id,
      link: '/profile',
      type: 'VerificationMessage',
    });

    await request.populate('adminMessages.sender', 'name email');
    res.status(201).json({ success: true, request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
