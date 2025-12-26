const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const LendingRequest = require('../models/LendingRequest');
const authenticateToken = require('../middleware/auth');

// Verification guard middleware
const requireVerified = (req, res, next) => {
  if (!req.user?.isVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Email verification required to chat',
      code: 'NOT_VERIFIED'
    });
  }
  next();
};

// Get unread message count - MUST COME BEFORE /lending/:lendingId
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

// Get all conversations (inquiries and active rentals)
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // 1. Get Active Rentals (LendingRequests)
    const rentals = await LendingRequest.find({
      $or: [{ borrower: userId }, { lender: userId }]
    })
    .populate('item', 'title images')
    .populate('borrower', 'name profileImage')
    .populate('lender', 'name profileImage')
    .sort({ updatedAt: -1 });

    const rentalConversations = await Promise.all(rentals.map(async (rental) => {
      const lastMessage = await Message.findOne({ lendingRequest: rental._id })
        .sort({ createdAt: -1 });
      
      const otherUser = rental.borrower._id.toString() === userId ? rental.lender : rental.borrower;
      
      return {
        id: rental._id,
        type: 'rental',
        otherUser: {
          _id: otherUser._id,
          name: otherUser.name,
          profileImage: otherUser.profileImage
        },
        item: rental.item,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
          isRead: lastMessage.isRead,
          senderId: lastMessage.sender
        } : null,
        updatedAt: lastMessage ? lastMessage.createdAt : rental.updatedAt
      };
    }));

    // 2. Get Item Inquiries (Messages with itemId but no lendingRequest)
    // We need to aggregate to group by (itemId + otherUser)
    const inquiries = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(userId) },
            { recipientId: new mongoose.Types.ObjectId(userId) }
          ],
          itemId: { $exists: true },
          lendingRequest: { $exists: false }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            itemId: "$itemId",
            otherUser: {
              $cond: {
                if: { $eq: ["$sender", new mongoose.Types.ObjectId(userId)] },
                then: "$recipientId",
                else: "$sender"
              }
            }
          },
          lastMessage: { $first: "$$ROOT" }
        }
      }
    ]);

    // Populate inquiry details
    const inquiryConversations = await Promise.all(inquiries.map(async (inq) => {
      const item = await mongoose.model('Item').findById(inq._id.itemId).select('title images owner');
      const otherUser = await mongoose.model('User').findById(inq._id.otherUser).select('name profileImage');
      
      if (!item || !otherUser) return null;

      return {
        id: item._id, // For inquiries, we use itemId as ID, but we need to handle the user param in frontend
        conversationId: `${item._id}-${otherUser._id}`, // Unique ID for frontend key
        type: 'inquiry',
        otherUser: {
          _id: otherUser._id,
          name: otherUser.name,
          profileImage: otherUser.profileImage
        },
        item: item,
        lastMessage: {
          content: inq.lastMessage.content,
          createdAt: inq.lastMessage.createdAt,
          isRead: inq.lastMessage.isRead,
          senderId: inq.lastMessage.sender
        },
        updatedAt: inq.lastMessage.createdAt
      };
    }));

    // Combine and sort
    const allConversations = [...rentalConversations, ...inquiryConversations]
      .filter(c => c !== null)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json(allConversations);

  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get messages for a lending request
router.get('/lending/:lendingId', authenticateToken, requireVerified, async (req, res) => {
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
router.post('/', authenticateToken, requireVerified, async (req, res) => {
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

module.exports = router;