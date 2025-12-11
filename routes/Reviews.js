const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const User = require('../models/User');
const LendingRequest = require('../models/LendingRequest');
const authenticateToken = require('../middleware/auth');
const { sendSlackNotification, formatNewReviewNotification } = require('../utils/slack');

// Create review
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { lendingRequestId, revieweeId, rating, comment, itemCondition } = req.body;
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    // Check if lending request exists and is completed
    const lendingRequest = await LendingRequest.findById(lendingRequestId);
    
    if (!lendingRequest) {
      return res.status(404).json({ message: 'Lending request not found' });
    }
    
    if (lendingRequest.status !== 'Completed') {
      return res.status(400).json({ message: 'Can only review completed rentals' });
    }
    
    // Check if user is involved
    const isInvolved = 
      lendingRequest.borrower.toString() === req.userId ||
      lendingRequest.lender.toString() === req.userId;
    
    if (!isInvolved) {
      return res.status(403).json({ message: 'Not authorized to review this rental' });
    }
    
    // Check if review already exists
    const existingReview = await Review.findOne({
      lendingRequest: lendingRequestId,
      reviewer: req.userId
    });
    
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this rental' });
    }
    
    // Create review
    const review = new Review({
      lendingRequest: lendingRequestId,
      item: lendingRequest.item,
      reviewer: req.userId,
      reviewee: revieweeId,
      rating,
      comment,
      type: lendingRequest.borrower.toString() === req.userId ? 'Borrower' : 'Lender'
    });
    
    await review.save();
    
    // Update reviewee's rating
    const userReviews = await Review.find({ reviewee: revieweeId });
    const avgRating = userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length;
    
    await User.findByIdAndUpdate(revieweeId, {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: userReviews.length
    });
    
    await review.populate('reviewer', 'name profileImage');
    await review.populate('reviewee', 'name');
    
    // Send Slack notification
    try {
      const reviewer = await User.findById(req.userId);
      await sendSlackNotification(
        formatNewReviewNotification(review, reviewer, rating)
      );
    } catch (slackError) {
      console.error('Slack notification failed:', slackError.message);
    }
    
    res.status(201).json({
      message: 'Review submitted successfully',
      review
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get reviews for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate('reviewer', 'name profileImage')
      .populate('item', 'title')
      .sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;