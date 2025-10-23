const express = require('express');
const router = express.Router();
const uploadMiddleware = require('../middleware/upload');
const { auth } = require('../middleware/auth');

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Upload route is working' });
});

// Upload contact image - direct Cloudinary upload
router.post('/contact-image', auth, uploadMiddleware.upload.array('images', 1), async (req, res) => {
  try {
    console.log('🔍 Upload debug info:');
    console.log('  - req.files:', req.files);
    console.log('  - req.body:', req.body);
    
    if (!req.files || req.files.length === 0) {
      console.log('❌ No files found');
      return res.status(400).json({ message: '沒有上傳的圖片' });
    }

    const file = req.files[0];
    console.log('📁 File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Upload directly to Cloudinary
    const cloudinary = require('cloudinary').v2;
    const { v4: uuidv4 } = require('uuid');
    
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'parking-zone/contact-images',
          public_id: `contact-${uuidv4()}`,
          format: 'webp',
          quality: 'auto'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });

    console.log('✅ Image uploaded to Cloudinary:', uploadResult.url);
    
    res.json({
      success: true,
      message: '圖片上傳成功',
      imageUrl: uploadResult.url,
      imageData: {
        url: uploadResult.url,
        cloudinaryId: uploadResult.public_id,
        filename: uploadResult.original_filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Contact image upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: '上傳失敗', 
      error: error.message 
    });
  }
});

// Delete contact image
router.delete('/contact-image', auth, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: '缺少圖片URL' });
    }

    // Extract Cloudinary public ID from URL
    const urlParts = imageUrl.split('/');
    const publicId = urlParts[urlParts.length - 1].split('.')[0];
    
    // Delete from Cloudinary
    const cloudinary = require('cloudinary').v2;
    await cloudinary.uploader.destroy(publicId);
    
    res.json({
      success: true,
      message: '圖片刪除成功'
    });
  } catch (error) {
    console.error('Contact image delete error:', error);
    res.status(500).json({ 
      success: false, 
      message: '刪除失敗', 
      error: error.message 
    });
  }
});

module.exports = router;
