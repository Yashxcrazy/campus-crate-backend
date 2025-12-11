const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const authenticateToken = require('../middleware/auth');

// Get all items with filters
router.get('/', async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      availability,
      search,
      campus,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    if (category) query.category = category;
    if (availability) query.availability = availability;
    if (campus) query['location.campus'] = campus;
    if (req.query.owner === 'me') {
  if (req.headers.authorization) {
    try {
      const jwt = require('jsonwebtoken');
      const token = req.headers.authorization.replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      query.owner = decoded.userId;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'Authentication required' });
  }
}
    if (minPrice || maxPrice) {
      query.dailyRate = {};
      if (minPrice) query.dailyRate.$gte = Number(minPrice);
      if (maxPrice) query.dailyRate.$lte = Number(maxPrice);
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const items = await Item.find(query)
      .populate('owner', 'name profileImage rating university campus')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Item.countDocuments(query);

    res.json({
      items,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalItems: count
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Get current user's items - must be BEFORE /user/:userId route
router.get('/user/my-items', authenticateToken, async (req, res) => {
  try {
    const items = await Item.find({
      owner: req.userId,
      isActive: true
    })
      .populate('owner', 'name profileImage rating')
      .sort({ createdAt: -1 });
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Get single item
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('owner', 'name profileImage rating reviewCount campus phone email');

    if (!item || !item.isActive) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.viewCount += 1;
    await item.save();

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      images,
      condition,
      dailyRate,
      securityDeposit,
      location,
      tags,
      minLendingPeriod,
      maxLendingPeriod
    } = req.body;

    const item = new Item({
      owner: req.userId,
      title,
      description,
      category,
      images,
      condition,
      dailyRate,
      securityDeposit,
      location,
      tags,
      minLendingPeriod,
      maxLendingPeriod
    });

    await item.save();
    await item.populate('owner', 'name profileImage rating');

    res.status(201).json({
      message: 'Item created successfully',
      item
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      item[key] = updates[key];
    });

    await item.save();
    await item.populate('owner', 'name profileImage rating');

    res.json({
      message: 'Item updated successfully',
      item
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    item.isActive = false;
    await item.save();

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's items
router.get('/user/:userId', async (req, res) => {
  try {
    const items = await Item.find({
      owner: req.params.userId,
      isActive: true
    }).populate('owner', 'name profileImage rating');

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
