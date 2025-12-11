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
        { title: { $regex: search, $options: 'i' }, isActive: true },
        { description: { $regex: search, $options: 'i' }, isActive: true },
        { tags: { $regex: search, $options: 'i' }, isActive: true }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const items = await Item.find(query)
      .populate('owner', 'name profileImage rating campus')
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

    const savedItem = await item.save();
    if (!savedItem) {
      return res.status(500).json({ message: 'Failed to save item to database' });
    }
    
    // Refetch the item to get populated owner data
    const createdItem = await Item.findById(savedItem._id)
      .populate('owner', 'name profileImage rating');

    res.status(201).json({
      message: 'Item created successfully',
      item: createdItem
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;

    // Validate if ID is a valid MongoDB ObjectId
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid item ID format',
        itemId 
      });
    }

    // Find the item
    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: 'Item not found',
        itemId 
      });
    }

    // Check if item is deleted (soft delete check)
    if (!item.isActive) {
      return res.status(404).json({ 
        success: false,
        message: 'Item has been deleted',
        itemId 
      });
    }

    // Check authorization - only owner can update
    if (item.owner.toString() !== req.userId) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to update this item',
        itemId 
      });
    }

    // Validate and apply updates
    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No updates provided',
        itemId 
      });
    }

    // List of immutable fields that cannot be updated
    const immutableFields = ['_id', 'owner', 'createdAt'];
    
    // Apply updates (skip immutable fields)
    Object.keys(updates).forEach(key => {
      if (!immutableFields.includes(key)) {
        item[key] = updates[key];
      }
    });

    // Save the updated item
    const savedItem = await item.save();
    
    if (!savedItem) {
      console.error('Update failed - save returned null for item:', itemId);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to save item updates to database',
        itemId 
      });
    }

    // Refetch with populated owner to ensure complete data
    const updatedItem = await Item.findById(itemId)
      .populate('owner', 'name profileImage rating reviewCount campus phone email');

    if (!updatedItem) {
      console.error('Update verification failed - cannot refetch item:', itemId);
      return res.status(500).json({ 
        success: false,
        message: 'Item updated but verification failed',
        itemId 
      });
    }

    // Return the updated document
    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: {
        _id: updatedItem._id,
        title: updatedItem.title,
        description: updatedItem.description,
        category: updatedItem.category,
        images: updatedItem.images,
        condition: updatedItem.condition,
        dailyRate: updatedItem.dailyRate,
        securityDeposit: updatedItem.securityDeposit,
        availability: updatedItem.availability,
        location: updatedItem.location,
        tags: updatedItem.tags,
        minLendingPeriod: updatedItem.minLendingPeriod,
        maxLendingPeriod: updatedItem.maxLendingPeriod,
        viewCount: updatedItem.viewCount,
        favoriteCount: updatedItem.favoriteCount,
        owner: updatedItem.owner,
        isActive: updatedItem.isActive,
        createdAt: updatedItem.createdAt,
        updatedAt: updatedItem.updatedAt
      }
    });

  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating item',
      error: error.message,
      itemId: req.params.id
    });
  }
});

// Delete item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;
    
    // Validate if ID is a valid MongoDB ObjectId
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid item ID format',
        itemId 
      });
    }

    // Find the item first
    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: 'Item not found',
        itemId 
      });
    }

    // Check authorization - only owner can delete
    if (item.owner.toString() !== req.userId) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to delete this item',
        itemId 
      });
    }

    // Check if already deleted
    if (!item.isActive) {
      return res.status(404).json({ 
        success: false,
        message: 'Item already deleted',
        itemId 
      });
    }

    // Perform soft delete - set isActive to false
    item.isActive = false;
    const result = await item.save();
    
    // Verify the save was successful
    if (!result || result.isActive !== false) {
      console.error('Delete failed - save verification failed for item:', itemId);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to delete item - database save failed',
        itemId 
      });
    }

    // Verify deletion by fetching again
    const verifyDeleted = await Item.findById(itemId);
    if (verifyDeleted && verifyDeleted.isActive !== false) {
      console.error('Delete verification failed for item:', itemId);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to verify deletion - item still active in database',
        itemId 
      });
    }

    // Return successful response
    res.status(200).json({ 
      success: true,
      message: 'Item deleted successfully',
      itemId,
      deletedAt: new Date()
    });
    
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting item',
      error: error.message,
      itemId: req.params.id
    });
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
