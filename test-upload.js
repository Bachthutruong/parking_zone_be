const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function testUpload() {
  try {
    console.log('🧪 Testing upload endpoint...');
    
    // Create a simple test image file
    const testImagePath = './test-image.png';
    if (!fs.existsSync(testImagePath)) {
      console.log('Creating test image...');
      // Create a simple 1x1 PNG
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testImagePath, pngData);
    }
    
    const formData = new FormData();
    formData.append('images', fs.createReadStream(testImagePath));
    
    const response = await axios.post('http://localhost:5002/api/upload/contact-image', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODg0NTVjYTQ4MjEyMDMzZTliNTZlMDIiLCJpYXQiOjE3NjExOTIzNzQsImV4cCI6MTc2MTc5NzE3NH0.V20JdyEWuwHFwgbeLRG4QQilK7GNFAvJNA7e9pInA14'
      }
    });
    
    console.log('✅ Upload successful:', response.data);
    
    // Clean up
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error.response?.data || error.message);
  }
}

testUpload();
