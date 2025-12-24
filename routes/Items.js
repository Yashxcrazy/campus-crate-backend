const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const LendingRequest = require('../models/LendingRequest');
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

    let responseItems = items;
    if (req.query.includeBookingCount === 'true') {
      const activeStatuses = ['Pending', 'Accepted', 'Active'];
      const withCounts = await Promise.all(
        items.map(async (itemDoc) => {
          const bookingCount = await LendingRequest.countDocuments({
            item: itemDoc._id,
            status: { $in: activeStatuses }
          });
          const obj = itemDoc.toObject();
          obj.bookingCount = bookingCount;
          return obj;
        })
      );
      responseItems = withCounts;
    }

    res.json({
      items: responseItems,
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

    const updates = req.body || {};

    // Drop immutable fields
    const immutableFields = ['_id', 'owner', 'createdAt', 'updatedAt', 'isActive'];
    const set = {};
    Object.keys(updates).forEach(key => {
      if (!immutableFields.includes(key)) {
        set[key] = updates[key];
      }
    });

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No valid updates provided',
        itemId 
      });
    }

    // Atomic update with validation and owner guard
    const updatedItem = await Item.findOneAndUpdate(
      { _id: itemId, owner: req.userId, isActive: true },
      { $set: set },
      { new: true, runValidators: true }
    ).populate('owner', 'name profileImage rating reviewCount campus phone email');

    if (!updatedItem) {
      console.error('Update failed - no document returned for item:', itemId);
      return res.status(404).json({ 
        success: false,
        message: 'Item not found or not owned by user',
        itemId 
      });
    }

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
    
    console.log('DELETE request for item:', itemId, 'by user:', req.userId);
    
    // Guard missing or undefined IDs coming from the client
    if (!itemId) {
      console.warn('Missing itemId in delete request');
      return res.status(400).json({
        success: false,
        message: 'Item ID is required in the URL',
        itemId
      });
    }

    // Validate if ID is a valid MongoDB ObjectId
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      console.warn('Invalid ObjectId format:', itemId);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid item ID format',
        itemId 
      });
    }

    // Find the item first
    const item = await Item.findById(itemId);
    console.log('Found item:', item ? 'yes' : 'no');

    if (!item) {
      console.warn('Item not found:', itemId);
      return res.status(404).json({ 
        success: false,
        message: 'Item not found',
        itemId 
      });
    }

    // Check authorization - only owner can delete
    console.log('Item owner:', item.owner.toString(), 'Request user:', req.userId);
    if (item.owner.toString() !== req.userId) {
      console.warn('Unauthorized delete attempt for item:', itemId);
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to delete this item',
        itemId 
      });
    }

    // Check if already deleted
    if (!item.isActive) {
      console.warn('Item already deleted:', itemId);
      return res.status(404).json({ 
        success: false,
        message: 'Item already deleted',
        itemId 
      });
    }

    // Hard delete (remove document) to ensure it no longer exists in DB
    console.log('Performing hard delete for item:', itemId);
    const deleteResult = await Item.deleteOne({ _id: itemId, owner: req.userId });

    if (!deleteResult || deleteResult.deletedCount === 0) {
      console.error('Delete failed - document not removed for item:', itemId);
      return res.status(404).json({ 
        success: false,
        message: 'Item not found or not owned by user',
        itemId 
      });
    }

    console.log('✅ Item successfully hard-deleted:', itemId);
    
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
