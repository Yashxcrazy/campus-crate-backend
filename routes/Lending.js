const express = require('express');
const router = express.Router();
const LendingRequest = require('../models/LendingRequest');
const Item = require('../models/Item');
const Notification = require('../models/Notification');
const authenticateToken = require('../middleware/auth');
const {
  sendSlackNotification,
  formatNewLendingRequestNotification,
  formatRequestAcceptedNotification
} = require('../utils/slack');
const User = require('../models/User');

// Create lending request
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { itemId, startDate, endDate, message } = req.body;

    const item = await Item.findById(itemId).populate('owner');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.availability !== 'Available') {
      return res.status(400).json({ message: 'Item is not available' });
    }

    if (item.owner._id.toString() === req.userId) {
      return res.status(400).json({ message: 'Cannot borrow your own item' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalCost = days * item.dailyRate;

    const lendingRequest = new LendingRequest({
      item: itemId,
      borrower: req.userId,
      lender: item.owner._id,
      startDate,
      endDate,
      totalCost,
      securityDeposit: item.securityDeposit,
      message
    });

    await lendingRequest.save();
    try {
      const borrower = await User.findById(req.userId);
      await sendSlackNotification(
        formatNewLendingRequestNotification(lendingRequest, item, borrower)
      );
    } catch (slackError) {
      console.error('Slack notification failed:', slackError.message);
    }
    await lendingRequest.populate(['item', 'borrower', 'lender']);

    const notification = new Notification({
      user: item.owner._id,
      type: 'LendingRequest',
      title: 'New Lending Request',
      message: `${lendingRequest.borrower.name} wants to borrow your ${item.title}`,
      relatedId: lendingRequest._id,
      link: `/lending/${lendingRequest._id}`
    });
    await notification.save();

    res.status(201).json({
      message: 'Lending request created successfully',
      lendingRequest
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all lending requests for user
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const { type = 'all', status } = req.query;

    let query = {};
    if (type === 'borrowing') {
      query.borrower = req.userId;
    } else if (type === 'lending') {
      query.lender = req.userId;
    } else {
      query.$or = [{ borrower: req.userId }, { lender: req.userId }];
    }

    if (status) {
      query.status = status;
    }

    const requests = await LendingRequest.find(query)
      .populate('item')
      .populate('borrower', 'name profileImage rating university')
      .populate('lender', 'name profileImage rating university')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single lending request
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const request = await LendingRequest.findById(req.params.id)
      .populate('item')
      .populate('borrower', 'name profileImage rating reviewCount university campus phone email')
      .populate('lender', 'name profileImage rating reviewCount university campus phone email');

    if (!request) {
      return res.status(404).json({ message: 'Lending request not found' });
    }

    if (request.borrower._id.toString() !== req.userId && 
        request.lender._id.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to view this request' });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Accept lending request
router.post('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const request = await LendingRequest.findById(req.params.id)
      .populate('item')
      .populate('borrower');

    if (!request) {
      return res.status(404).json({ message: 'Lending request not found' });
    }

    if (request.lender.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({ message: 'Request cannot be accepted' });
    }

    request.status = 'Accepted';
    await request.save();
    try {
      await sendSlackNotification(
        formatRequestAcceptedNotification(lendingRequest, item)
      );
    } catch (slackError) {
      console.error('Slack notification failed:', slackError.message);
    }

    const item = await Item.findById(request.item._id);
    item.availability = 'Rented';
    await item.save();

    const notification = new Notification({
      user: request.borrower._id,
      type: 'RequestAccepted',
      title: 'Request Accepted',
      message: `Your request to borrow ${item.title} has been accepted`,
      relatedId: request._id,
      link: `/lending/${request._id}`
    });
    await notification.save();

    res.json({
      message: 'Request accepted successfully',
      request
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject lending request
router.post('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await LendingRequest.findById(req.params.id)
      .populate('item')
      .populate('borrower');

    if (!request) {
      return res.status(404).json({ message: 'Lending request not found' });
    }

    if (request.lender.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to reject this request' });
    }

    request.status = 'Rejected';
    request.cancellationReason = reason;
    await request.save();

    const notification = new Notification({
      user: request.borrower._id,
      type: 'RequestRejected',
      title: 'Request Rejected',
      message: `Your request to borrow ${request.item.title} was declined`,
      relatedId: request._id
    });
    await notification.save();

    res.json({
      message: 'Request rejected',
      request
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Complete lending
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const request = await LendingRequest.findById(req.params.id)
      .populate('item');

    if (!request) {
      return res.status(404).json({ message: 'Lending request not found' });
    }

    if (request.lender.toString() !== req.userId && 
        request.borrower.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    request.status = 'Completed';
    request.actualReturnDate = new Date();

    const expectedReturn = new Date(request.endDate);
    const actualReturn = new Date(request.actualReturnDate);
    
    if (actualReturn > expectedReturn) {
      const lateDays = Math.ceil((actualReturn - expectedReturn) / (1000 * 60 * 60 * 24));
      request.lateReturnDays = lateDays;
      request.lateFee = lateDays * request.item.dailyRate * 1.5;
    }

    await request.save();

    const item = await Item.findById(request.item._id);
    item.availability = 'Available';
    await item.save();

    res.json({
      message: 'Lending completed successfully',
      request
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;