const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer memory storage
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

/**
 * Upload image buffer to Cloudinary
 */
const uploadToCloudinary = (fileBuffer, folder = 'campus-crate') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete image from Cloudinary
 */
const deleteFromCloudinary = async (imageUrl) => {
  try {
    const parts = imageUrl.split('/');
    const filename = parts[parts.length - 1];
    const publicId = `campus-crate/${filename.split('.')[0]}`;
    
    await cloudinary.uploader.destroy(publicId);
    console.log('Image deleted from Cloudinary:', publicId);
  } catch (error) {
    console.error('Failed to delete from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary
};