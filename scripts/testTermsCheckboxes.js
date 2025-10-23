const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking-zone', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testTermsCheckboxes() {
  try {
    console.log('🧪 Testing Terms Checkboxes Feature...\n');

    // Get current settings
    let settings = await SystemSettings.getSettings();
    console.log('📋 Current settings termsCheckboxes:', settings.termsCheckboxes);

    // Update with sample terms checkboxes
    const sampleTermsCheckboxes = [
      {
        id: 'terms-1',
        title: '我同意所有預約條款和條件',
        content: '我已經閱讀並同意所有預約條款和條件，包括取消政策、退款政策等相關規定。',
        isRequired: true,
        isActive: true,
        order: 1
      },
      {
        id: 'terms-2',
        title: '我同意隱私政策',
        content: '我同意系統收集、處理和使用我的個人資料，並了解隱私政策內容。',
        isRequired: true,
        isActive: true,
        order: 2
      },
      {
        id: 'terms-3',
        title: '我了解停車場規定',
        content: '我了解並同意遵守停車場的所有規定，包括安全規定、使用時間限制等。',
        isRequired: true,
        isActive: true,
        order: 3
      }
    ];

    // Update settings with terms checkboxes
    const updatedSettings = await SystemSettings.findByIdAndUpdate(
      settings._id,
      { termsCheckboxes: sampleTermsCheckboxes },
      { new: true, runValidators: true }
    );

    console.log('✅ Updated settings with terms checkboxes:');
    console.log(JSON.stringify(updatedSettings.termsCheckboxes, null, 2));

    // Test API endpoint
    console.log('\n🌐 Testing API endpoint...');
    const axios = require('axios');
    
    try {
      const response = await axios.get('http://localhost:5002/api/system-settings');
      console.log('✅ API Response - termsCheckboxes:');
      console.log(JSON.stringify(response.data.termsCheckboxes, null, 2));
    } catch (error) {
      console.log('❌ API Error:', error.message);
    }

    console.log('\n🎉 Terms Checkboxes test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing terms checkboxes:', error);
  } finally {
    mongoose.connection.close();
  }
}

testTermsCheckboxes();
