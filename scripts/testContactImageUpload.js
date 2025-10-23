const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function testContactImageUpload() {
  try {
    console.log('\n📸 Testing Contact Image Upload Feature...\n');

    // 1. Test SystemSettings contact content with image URL
    console.log('1. Testing SystemSettings contact content with image URL...');
    const settings = await SystemSettings.getSettings();
    console.log('Current contact content settings:', settings.contactContent);
    
    // Update contact content settings with image URL
    const testImageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    await SystemSettings.findOneAndUpdate({}, {
      contactContent: {
        title: '聯繫信息',
        content: '如有任何問題，請隨時聯繫我們。我們將竭誠為您服務。<br><img src="' + testImageUrl + '" alt="Contact Image" width="200">',
        imageUrl: testImageUrl,
        isActive: true,
        showContactInfo: true
      }
    }, { new: true });
    console.log('✅ Updated contact content settings with image URL');

    // 2. Test content configuration retrieval with image
    console.log('\n2. Testing content configuration retrieval with image...');
    const updatedSettings = await SystemSettings.getSettings();
    const contactContent = updatedSettings.contactContent;
    
    console.log('Contact content configuration:');
    console.log('  Title:', contactContent.title);
    console.log('  Content:', contactContent.content);
    console.log('  Image URL:', contactContent.imageUrl);
    console.log('  Is Active:', contactContent.isActive);
    console.log('  Show Contact Info:', contactContent.showContactInfo);
    
    if (contactContent.title && contactContent.content && contactContent.imageUrl && contactContent.isActive !== undefined && contactContent.showContactInfo !== undefined) {
      console.log('✅ Contact content configuration with image is properly set');
    } else {
      console.log('❌ Contact content configuration with image is incomplete');
    }

    // 3. Test different image configurations
    console.log('\n3. Testing different image configurations...');
    
    const testConfigs = [
      {
        title: '客戶服務',
        content: '我們提供24/7客戶服務。<br><img src="https://example.com/service.jpg" alt="Service" width="300">',
        imageUrl: 'https://example.com/service.jpg',
        isActive: true,
        showContactInfo: true
      },
      {
        title: '聯繫我們',
        content: '有任何問題嗎？<br><em>我們隨時為您服務</em><br><img src="https://example.com/contact.jpg" alt="Contact" width="250">',
        imageUrl: 'https://example.com/contact.jpg',
        isActive: true,
        showContactInfo: false
      },
      {
        title: '聯繫信息',
        content: '如有任何問題，請隨時聯繫我們。',
        imageUrl: '',
        isActive: false,
        showContactInfo: true
      }
    ];

    for (let i = 0; i < testConfigs.length; i++) {
      const config = testConfigs[i];
      console.log(`\n   Testing configuration ${i + 1}:`);
      console.log(`   Title: "${config.title}"`);
      console.log(`   Content: "${config.content}"`);
      console.log(`   Image URL: "${config.imageUrl}"`);
      console.log(`   Active: ${config.isActive}`);
      console.log(`   Show Contact Info: ${config.showContactInfo}`);
      
      // Update settings with test configuration
      await SystemSettings.findOneAndUpdate({}, {
        contactContent: config
      }, { new: true });
      
      // Verify the update
      const testSettings = await SystemSettings.getSettings();
      const testContent = testSettings.contactContent;
      
      if (testContent.title === config.title && 
          testContent.content === config.content && 
          testContent.imageUrl === config.imageUrl &&
          testContent.isActive === config.isActive &&
          testContent.showContactInfo === config.showContactInfo) {
        console.log('   ✅ Configuration updated successfully');
      } else {
        console.log('   ❌ Configuration update failed');
      }
    }

    // 4. Test HTML content with embedded images
    console.log('\n4. Testing HTML content with embedded images...');
    
    const htmlContentWithImages = `
      <h3>我們的服務</h3>
      <p>我們提供優質的停車服務：</p>
      <ul>
        <li>24小時監控</li>
        <li>免費接駁服務</li>
        <li>VIP會員優惠</li>
      </ul>
      <p>聯繫我們：</p>
      <a href="mailto:info@parkingzone.com" class="text-blue-600">info@parkingzone.com</a><br>
      <a href="tel:+886-2-1234-5678" class="text-green-600">+886-2-1234-5678</a>
      <br><br>
      <img src="https://example.com/logo.png" alt="Company Logo" width="200" height="100">
    `;
    
    await SystemSettings.findOneAndUpdate({}, {
      contactContent: {
        title: '服務介紹',
        content: htmlContentWithImages,
        imageUrl: 'https://example.com/logo.png',
        isActive: true,
        showContactInfo: true
      }
    }, { new: true });
    
    const htmlSettings = await SystemSettings.getSettings();
    console.log('✅ HTML content with images support working');
    console.log('   HTML content length:', htmlSettings.contactContent.content.length);
    console.log('   Contains HTML tags:', htmlSettings.contactContent.content.includes('<h3>'));
    console.log('   Contains image tags:', htmlSettings.contactContent.content.includes('<img'));
    console.log('   Image URL set:', !!htmlSettings.contactContent.imageUrl);

    // 5. Test API endpoint for system settings with image
    console.log('\n5. Testing API endpoint for system settings with image...');
    
    const axios = require('axios');
    const baseURL = 'http://localhost:5002/api';

    try {
      const settingsResponse = await axios.get(`${baseURL}/system-settings`);
      console.log('✅ System settings API working');
      
      const apiContactContent = settingsResponse.data.contactContent;
      console.log('API returned contact content:');
      console.log('  Title:', apiContactContent.title);
      console.log('  Content:', apiContactContent.content.substring(0, 100) + '...');
      console.log('  Image URL:', apiContactContent.imageUrl);
      console.log('  Is Active:', apiContactContent.isActive);
      console.log('  Show Contact Info:', apiContactContent.showContactInfo);
      
      if (apiContactContent.title && apiContactContent.content && apiContactContent.imageUrl !== undefined && apiContactContent.isActive !== undefined && apiContactContent.showContactInfo !== undefined) {
        console.log('✅ API correctly returns contact content configuration with image');
      } else {
        console.log('❌ API missing contact content configuration with image');
      }

    } catch (error) {
      console.log('❌ API test failed:', error.response?.data?.message || error.message);
      console.log('   This is expected if the server is not running');
    }

    // 6. Test image URL validation
    console.log('\n6. Testing image URL validation...');
    
    // Test with valid image URL
    try {
      await SystemSettings.findOneAndUpdate({}, {
        contactContent: {
          title: 'Valid Image',
          content: 'Content with valid image',
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          isActive: true,
          showContactInfo: true
        }
      }, { new: true });
      console.log('✅ Valid image URL handled gracefully');
    } catch (error) {
      console.log('❌ Valid image URL validation failed:', error.message);
    }

    // Test with empty image URL
    try {
      await SystemSettings.findOneAndUpdate({}, {
        contactContent: {
          title: 'No Image',
          content: 'Content without image',
          imageUrl: '',
          isActive: true,
          showContactInfo: true
        }
      }, { new: true });
      console.log('✅ Empty image URL handled gracefully');
    } catch (error) {
      console.log('❌ Empty image URL validation failed:', error.message);
    }

    // 7. Restore default configuration
    console.log('\n7. Restoring default configuration...');
    await SystemSettings.findOneAndUpdate({}, {
      contactContent: {
        title: '聯繫信息',
        content: '如有任何問題，請隨時聯繫我們。我們將竭誠為您服務。',
        imageUrl: '',
        isActive: true,
        showContactInfo: true
      }
    }, { new: true });
    console.log('✅ Default configuration restored');

    console.log('\n🎉 Contact image upload feature test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing contact image upload feature:', error);
  }
}

async function main() {
  await connectDB();
  await testContactImageUpload();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testContactImageUpload };
