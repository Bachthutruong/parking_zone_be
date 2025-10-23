const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  }
});

// Middleware to process uploaded images
const processImages = async (req, res, next) => {
  try {
    console.log('🔍 processImages middleware:');
    console.log('  - req.files:', req.files);
    console.log('  - req.files length:', req.files ? req.files.length : 'undefined');
    
    if (!req.files || req.files.length === 0) {
      console.log('⚠️ No files found, skipping processing');
      return next();
    }

    const processedImages = [];

    for (const file of req.files) {
      // Process image with sharp for optimization
      const optimizedBuffer = await sharp(file.buffer)
        .resize(1200, 800, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .webp({ quality: 85 })
        .toBuffer();

      // Create thumbnail
      const thumbnailBuffer = await sharp(file.buffer)
        .resize(300, 200, { 
          fit: 'cover' 
        })
        .webp({ quality: 80 })
        .toBuffer();

      // Upload to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'parking-zone',
            public_id: `parking-${uuidv4()}`,
            format: 'webp',
            quality: 'auto'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(optimizedBuffer);
      });

      // Upload thumbnail to Cloudinary
      const thumbnailResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'parking-zone/thumbnails',
            public_id: `parking-thumb-${uuidv4()}`,
            format: 'webp',
            quality: 'auto'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(thumbnailBuffer);
      });

      processedImages.push({
        url: uploadResult.secure_url,
        thumbnailUrl: thumbnailResult.secure_url,
        cloudinaryId: uploadResult.public_id,
        thumbnailCloudinaryId: thumbnailResult.public_id,
        filename: uploadResult.original_filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
        isActive: true
      });
    }

    req.processedImages = processedImages;
    console.log('✅ processImages completed, processed images:', processedImages.length);
    next();
  } catch (error) {
    console.error('Image processing error:', error);
    res.status(500).json({ 
      message: 'Lỗi xử lý hình ảnh', 
      error: error.message 
    });
  }
};

// Middleware to serve static files
const serveStaticFiles = (app) => {
  const express = require('express');
  app.use('/uploads', express.static(uploadsDir));
};

module.exports = {
  upload,
  processImages,
  serveStaticFiles
};
