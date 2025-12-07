const express = require('express');
const router = express.Router();
const { upload, uploadToCloudinary } = require('../utils/cloudinary');
const authenticateToken = require('../middleware/auth');
const User = require('../models/User');

// Upload single image
router.post('/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    const imageUrl = await uploadToCloudinary(req.file.buffer, 'campus-crate/items');
    
    res.json({
      message: 'Image uploaded successfully',
      imageUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

// Upload multiple images (max 5)
router.post('/images', authenticateToken, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided' });
    }
    
    const uploadPromises = req.files.map(file =>
      uploadToCloudinary(file.buffer, 'campus-crate/items')
    );
    
    const imageUrls = await Promise.all(uploadPromises);
    
    res.json({
      message: 'Images uploaded successfully',
      imageUrls,
      count: imageUrls.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

// Upload profile image
router.post('/profile-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    const imageUrl = await uploadToCloudinary(req.file.buffer, 'campus-crate/profiles');
    
    // Update user profile image
    await User.findByIdAndUpdate(req.userId, { profileImage: imageUrl });
    
    res.json({
      message: 'Profile image uploaded successfully',
      imageUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

module.exports = router;