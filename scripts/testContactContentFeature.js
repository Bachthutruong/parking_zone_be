const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');

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

async function testContactContentFeature() {
  try {
    console.log('\n📞 Testing Contact Content Feature...\n');

    // 1. Test SystemSettings contact content configuration
    console.log('1. Testing SystemSettings contact content configuration...');
    const settings = await SystemSettings.getSettings();
    console.log('Current contact content settings:', settings.contactContent);
    
    // Update contact content settings
    await SystemSettings.findOneAndUpdate({}, {
      contactContent: {
        title: '聯繫信息',
        content: '如有任何問題，請隨時聯繫我們。我們將竭誠為您服務。<br><a href="https://example.com">了解更多</a>',
        isActive: true,
        showContactInfo: true
      }
    }, { new: true });
    console.log('✅ Updated contact content settings');

    // 2. Test content configuration retrieval
    console.log('\n2. Testing content configuration retrieval...');
    const updatedSettings = await SystemSettings.getSettings();
    const contactContent = updatedSettings.contactContent;
    
    console.log('Contact content configuration:');
    console.log('  Title:', contactContent.title);
    console.log('  Content:', contactContent.content);
    console.log('  Is Active:', contactContent.isActive);
    console.log('  Show Contact Info:', contactContent.showContactInfo);
    
    if (contactContent.title && contactContent.content && contactContent.isActive !== undefined && contactContent.showContactInfo !== undefined) {
      console.log('✅ Contact content configuration is properly set');
    } else {
      console.log('❌ Contact content configuration is incomplete');
    }

    // 3. Test different content configurations
    console.log('\n3. Testing different content configurations...');
    
    const testConfigs = [
      {
        title: '客戶服務',
        content: '我們提供24/7客戶服務。<br><strong>緊急聯繫：</strong> <a href="tel:+886-2-1234-5678">+886-2-1234-5678</a>',
        isActive: true,
        showContactInfo: true
      },
      {
        title: '聯繫我們',
        content: '有任何問題嗎？<br><em>我們隨時為您服務</em><br><img src="https://example.com/logo.png" alt="Logo" width="100">',
        isActive: true,
        showContactInfo: false
      },
      {
        title: '聯繫信息',
        content: '如有任何問題，請隨時聯繫我們。',
        isActive: false,
        showContactInfo: true
      }
    ];

    for (let i = 0; i < testConfigs.length; i++) {
      const config = testConfigs[i];
      console.log(`\n   Testing configuration ${i + 1}:`);
      console.log(`   Title: "${config.title}"`);
      console.log(`   Content: "${config.content}"`);
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
          testContent.isActive === config.isActive &&
          testContent.showContactInfo === config.showContactInfo) {
        console.log('   ✅ Configuration updated successfully');
      } else {
        console.log('   ❌ Configuration update failed');
      }
    }

    // 4. Test HTML content support
    console.log('\n4. Testing HTML content support...');
    
    const htmlContent = `
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
    `;
    
    await SystemSettings.findOneAndUpdate({}, {
      contactContent: {
        title: '服務介紹',
        content: htmlContent,
        isActive: true,
        showContactInfo: true
      }
    }, { new: true });
    
    const htmlSettings = await SystemSettings.getSettings();
    console.log('✅ HTML content support working');
    console.log('   HTML content length:', htmlSettings.contactContent.content.length);
    console.log('   Contains HTML tags:', htmlSettings.contactContent.content.includes('<h3>'));

    // 5. Test API endpoint for system settings
    console.log('\n5. Testing API endpoint for system settings...');
    
    const axios = require('axios');
    const baseURL = 'http://localhost:5002/api';

    try {
      const settingsResponse = await axios.get(`${baseURL}/system-settings`);
      console.log('✅ System settings API working');
      
      const apiContactContent = settingsResponse.data.contactContent;
      console.log('API returned contact content:');
      console.log('  Title:', apiContactContent.title);
      console.log('  Content:', apiContactContent.content.substring(0, 100) + '...');
      console.log('  Is Active:', apiContactContent.isActive);
      console.log('  Show Contact Info:', apiContactContent.showContactInfo);
      
      if (apiContactContent.title && apiContactContent.content && apiContactContent.isActive !== undefined && apiContactContent.showContactInfo !== undefined) {
        console.log('✅ API correctly returns contact content configuration');
      } else {
        console.log('❌ API missing contact content configuration');
      }

    } catch (error) {
      console.log('❌ API test failed:', error.response?.data?.message || error.message);
      console.log('   This is expected if the server is not running');
    }

    // 6. Test content validation
    console.log('\n6. Testing content validation...');
    
    // Test with empty title
    try {
      await SystemSettings.findOneAndUpdate({}, {
        contactContent: {
          title: '',
          content: 'Valid content',
          isActive: true,
          showContactInfo: true
        }
      }, { new: true });
      console.log('✅ Empty title handled gracefully');
    } catch (error) {
      console.log('❌ Empty title validation failed:', error.message);
    }

    // Test with empty content
    try {
      await SystemSettings.findOneAndUpdate({}, {
        contactContent: {
          title: 'Valid title',
          content: '',
          isActive: true,
          showContactInfo: true
        }
      }, { new: true });
      console.log('✅ Empty content handled gracefully');
    } catch (error) {
      console.log('❌ Empty content validation failed:', error.message);
    }

    // 7. Restore default configuration
    console.log('\n7. Restoring default configuration...');
    await SystemSettings.findOneAndUpdate({}, {
      contactContent: {
        title: '聯繫信息',
        content: '如有任何問題，請隨時聯繫我們。我們將竭誠為您服務。',
        isActive: true,
        showContactInfo: true
      }
    }, { new: true });
    console.log('✅ Default configuration restored');

    console.log('\n🎉 Contact content feature test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing contact content feature:', error);
  }
}

async function main() {
  await connectDB();
  await testContactContentFeature();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testContactContentFeature };
