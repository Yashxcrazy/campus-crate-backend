const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const authenticateToken = require('../middleware/auth');

// POST /api/reports - Create a new report
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { reportedItem, reportedUser, reason, description } = req.body;

    if (!reason || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reason and description are required' 
      });
    }

    if (!reportedItem && !reportedUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either reportedItem or reportedUser must be provided' 
      });
    }

    const report = new Report({
      reporter: req.userId,
      reportedItem,
      reportedUser,
      reason,
      description,
      status: 'Pending'
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// GET /api/reports/my-reports - Get current user's reports
router.get('/my-reports', authenticateToken, async (req, res) => {
  try {
    const reports = await Report.find({ reporter: req.userId })
      .populate('reportedItem', 'title')
      .populate('reportedUser', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('Get my reports error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;
