const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const LendingRequest = require('../models/LendingRequest');
const authenticateToken = require('../middleware/auth');

// Get messages for a lending request
router.get('/lending/:lendingId', authenticateToken, async (req, res) => {
  try {
    const lendingRequest = await LendingRequest.findById(req.params.lendingId);
    
    if (!lendingRequest) {
      return res.status(404).json({ message: 'Lending request not found' });
    }
    
    // Check if user is involved in this lending request
    if (
      lendingRequest.borrower.toString() !== req.userId &&
      lendingRequest.lender.toString() !== req.userId
    ) {
      return res.status(403).json({ message: 'Not authorized to view these messages' });
    }
    
    const messages = await Message.find({ lendingRequest: req.params.lendingId })
      .populate('sender', 'name profileImage')
      .sort({ createdAt: 1 });
    
    // Mark messages as read for the current user
    await Message.updateMany(
      { 
        lendingRequest: req.params.lendingId,
        sender: { $ne: req.userId },
        isRead: false
      },
      { 
        isRead: true,
        readAt: new Date()
      }
    );
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { lendingRequestId, content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    const lendingRequest = await LendingRequest.findById(lendingRequestId);
    
    if (!lendingRequest) {
      return res.status(404).json({ message: 'Lending request not found' });
    }
    
    // Check if user is involved
    if (
      lendingRequest.borrower.toString() !== req.userId &&
      lendingRequest.lender.toString() !== req.userId
    ) {
      return res.status(403).json({ message: 'Not authorized to send messages' });
    }
    
    const message = new Message({
      lendingRequest: lendingRequestId,
      sender: req.userId,
      content: content.trim()
    });
    
    await message.save();
    await message.populate('sender', 'name profileImage');
    
    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get unread message count
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    // Find all lending requests where user is involved
    const userLendingRequests = await LendingRequest.find({
      $or: [
        { borrower: req.userId },
        { lender: req.userId }
      ]
    }).select('_id');
    
    const lendingRequestIds = userLendingRequests.map(lr => lr._id);
    
    // Count unread messages from others
    const count = await Message.countDocuments({
      lendingRequest: { $in: lendingRequestIds },
      sender: { $ne: req.userId },
      isRead: false
    });
    
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;