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

async function testLuggageContentFeature() {
  try {
    console.log('\n🧳 Testing Luggage Content Feature...\n');

    // 1. Test SystemSettings luggage content configuration
    console.log('1. Testing SystemSettings luggage content configuration...');
    const settings = await SystemSettings.getSettings();
    console.log('Current luggage settings:', settings.luggageSettings);
    
    // Update luggage settings with content configuration
    await SystemSettings.findOneAndUpdate({}, {
      luggageSettings: {
        freeLuggageCount: 1,
        luggagePricePerItem: 100,
        luggageContent: {
          title: '行李注意事項',
          description: '請注意您的行李安全，建議將貴重物品隨身攜帶。',
          isActive: true
        }
      }
    }, { new: true });
    console.log('✅ Updated luggage settings with content configuration');

    // 2. Test content configuration retrieval
    console.log('\n2. Testing content configuration retrieval...');
    const updatedSettings = await SystemSettings.getSettings();
    const luggageContent = updatedSettings.luggageSettings.luggageContent;
    
    console.log('Luggage content configuration:');
    console.log('  Title:', luggageContent.title);
    console.log('  Description:', luggageContent.description);
    console.log('  Is Active:', luggageContent.isActive);
    
    if (luggageContent.title && luggageContent.description && luggageContent.isActive !== undefined) {
      console.log('✅ Luggage content configuration is properly set');
    } else {
      console.log('❌ Luggage content configuration is incomplete');
    }

    // 3. Test different content configurations
    console.log('\n3. Testing different content configurations...');
    
    const testConfigs = [
      {
        title: '行李安全提醒',
        description: '請確保行李安全，貴重物品請隨身攜帶。',
        isActive: true
      },
      {
        title: '行李保管須知',
        description: '行李將由專業人員保管，但建議不要放置貴重物品。',
        isActive: true
      },
      {
        title: '行李注意事項',
        description: '請注意行李安全，建議將貴重物品隨身攜帶。',
        isActive: false
      }
    ];

    for (let i = 0; i < testConfigs.length; i++) {
      const config = testConfigs[i];
      console.log(`\n   Testing configuration ${i + 1}:`);
      console.log(`   Title: "${config.title}"`);
      console.log(`   Description: "${config.description}"`);
      console.log(`   Active: ${config.isActive}`);
      
      // Update settings with test configuration
      await SystemSettings.findOneAndUpdate({}, {
        luggageSettings: {
          ...updatedSettings.luggageSettings,
          luggageContent: config
        }
      }, { new: true });
      
      // Verify the update
      const testSettings = await SystemSettings.getSettings();
      const testContent = testSettings.luggageSettings.luggageContent;
      
      if (testContent.title === config.title && 
          testContent.description === config.description && 
          testContent.isActive === config.isActive) {
        console.log('   ✅ Configuration updated successfully');
      } else {
        console.log('   ❌ Configuration update failed');
      }
    }

    // 4. Test API endpoint for system settings
    console.log('\n4. Testing API endpoint for system settings...');
    
    const axios = require('axios');
    const baseURL = 'http://localhost:5002/api';

    try {
      const settingsResponse = await axios.get(`${baseURL}/system-settings`);
      console.log('✅ System settings API working');
      
      const apiLuggageContent = settingsResponse.data.luggageSettings.luggageContent;
      console.log('API returned luggage content:');
      console.log('  Title:', apiLuggageContent.title);
      console.log('  Description:', apiLuggageContent.description);
      console.log('  Is Active:', apiLuggageContent.isActive);
      
      if (apiLuggageContent.title && apiLuggageContent.description && apiLuggageContent.isActive !== undefined) {
        console.log('✅ API correctly returns luggage content configuration');
      } else {
        console.log('❌ API missing luggage content configuration');
      }

    } catch (error) {
      console.log('❌ API test failed:', error.response?.data?.message || error.message);
      console.log('   This is expected if the server is not running');
    }

    // 5. Test content validation
    console.log('\n5. Testing content validation...');
    
    // Test with empty title
    try {
      await SystemSettings.findOneAndUpdate({}, {
        luggageSettings: {
          ...updatedSettings.luggageSettings,
          luggageContent: {
            title: '',
            description: 'Valid description',
            isActive: true
          }
        }
      }, { new: true });
      console.log('✅ Empty title handled gracefully');
    } catch (error) {
      console.log('❌ Empty title validation failed:', error.message);
    }

    // Test with empty description
    try {
      await SystemSettings.findOneAndUpdate({}, {
        luggageSettings: {
          ...updatedSettings.luggageSettings,
          luggageContent: {
            title: 'Valid title',
            description: '',
            isActive: true
          }
        }
      }, { new: true });
      console.log('✅ Empty description handled gracefully');
    } catch (error) {
      console.log('❌ Empty description validation failed:', error.message);
    }

    // 6. Restore default configuration
    console.log('\n6. Restoring default configuration...');
    await SystemSettings.findOneAndUpdate({}, {
      luggageSettings: {
        freeLuggageCount: 1,
        luggagePricePerItem: 100,
        luggageContent: {
          title: '行李注意事項',
          description: '請注意您的行李安全，建議將貴重物品隨身攜帶。',
          isActive: true
        }
      }
    }, { new: true });
    console.log('✅ Default configuration restored');

    console.log('\n🎉 Luggage content feature test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing luggage content feature:', error);
  }
}

async function main() {
  await connectDB();
  await testLuggageContentFeature();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testLuggageContentFeature };
