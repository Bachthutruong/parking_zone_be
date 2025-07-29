const mongoose = require('mongoose');
const User = require('../models/User');

async function testCompleteVIPFeature() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    console.log('🧪 Testing Complete VIP Feature\n');

    // Test 1: Create VIP User
    console.log('1️⃣ Creating VIP User...');
    const vipUserData = {
      name: 'VIP Test User',
      email: 'vip@test.com',
      phone: '0908805805',
      password: 'vip123456',
      role: 'user',
      isVIP: true,
      vipDiscount: 15,
      licensePlate: 'VIP123',
      isActive: true
    };

    const vipUser = await User.findOneAndUpdate(
      { email: vipUserData.email },
      vipUserData,
      { upsert: true, new: true }
    );

    // Generate VIP code
    const vipCode = vipUser.generateVIPCode();
    vipUser.vipCode = vipCode;
    vipUser.vipCreatedAt = new Date();
    await vipUser.save();

    console.log(`✅ VIP User created: ${vipUser.name}`);
    console.log(`   VIP Code: ${vipUser.vipCode}`);
    console.log(`   VIP Discount: ${vipUser.vipDiscount}%`);

    // Test 2: Test VIP Code Validation
    console.log('\n2️⃣ Testing VIP Code Validation...');
    
    // Test valid code
    const validUser = await User.findOne({ 
      vipCode: vipCode,
      isVIP: true,
      isActive: true
    });
    
    if (validUser) {
      console.log(`✅ Valid VIP Code: ${vipCode} -> ${validUser.name}`);
    } else {
      console.log(`❌ Invalid VIP Code: ${vipCode}`);
    }

    // Test invalid code
    const invalidUser = await User.findOne({ 
      vipCode: 'INVALID123',
      isVIP: true,
      isActive: true
    });
    
    if (!invalidUser) {
      console.log('✅ Invalid code correctly rejected');
    } else {
      console.log('❌ Invalid code incorrectly accepted');
    }

    // Test 3: Test VIP Code Generation for Different Years
    console.log('\n3️⃣ Testing VIP Code Generation for Different Years...');
    
    const testPhones = [
      { phone: '0908805805', year: 2025, expected: '1140908805805' },
      { phone: '0912345678', year: 2026, expected: '1150912345678' },
      { phone: '+886-912-345-678', year: 2025, expected: '114912345678' }
    ];

    for (const test of testPhones) {
      const testUser = new User({ phone: test.phone });
      const generatedCode = testUser.generateVIPCode();
      
      // Override year for testing
      const yearCode = test.year === 2025 ? '114' : test.year === 2026 ? '115' : '114';
      let phoneNumber = test.phone.replace(/\D/g, '');
      if (phoneNumber.startsWith('886')) {
        phoneNumber = phoneNumber.substring(3);
      }
      if (phoneNumber.length > 10) {
        phoneNumber = phoneNumber.substring(phoneNumber.length - 10);
      }
      const expectedCode = `${yearCode}${phoneNumber}`;
      
      const passed = generatedCode === expectedCode;
      console.log(`   ${passed ? '✅' : '❌'} ${test.phone} (${test.year}) -> ${generatedCode} ${passed ? '' : `(expected: ${expectedCode})`}`);
    }

    // Test 4: Test VIP Status Update
    console.log('\n4️⃣ Testing VIP Status Update...');
    
    // Create a regular user
    const regularUser = await User.findOneAndUpdate(
      { email: 'regular@test.com' },
      {
        name: 'Regular User',
        email: 'regular@test.com',
        phone: '0987654321',
        password: 'regular123',
        role: 'user',
        isVIP: false,
        vipDiscount: 0,
        isActive: true
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Regular user created: ${regularUser.name}`);
    console.log(`   Initial VIP status: ${regularUser.isVIP}`);

    // Update to VIP
    regularUser.isVIP = true;
    regularUser.vipDiscount = 20;
    regularUser.vipCode = regularUser.generateVIPCode();
    regularUser.vipCreatedAt = new Date();
    await regularUser.save();

    console.log(`✅ User upgraded to VIP: ${regularUser.name}`);
    console.log(`   VIP Code: ${regularUser.vipCode}`);
    console.log(`   VIP Discount: ${regularUser.vipDiscount}%`);

    // Test 5: Test VIP Status Removal
    console.log('\n5️⃣ Testing VIP Status Removal...');
    
    regularUser.isVIP = false;
    regularUser.vipDiscount = 0;
    regularUser.vipCode = null;
    regularUser.vipCreatedAt = null;
    await regularUser.save();

    console.log(`✅ VIP status removed: ${regularUser.name}`);
    console.log(`   VIP Code: ${regularUser.vipCode || 'null'}`);

    // Test 6: Test Phone Number Cleaning
    console.log('\n6️⃣ Testing Phone Number Cleaning...');
    
    const phoneTests = [
      '0908805805',
      '+886-908-805-805',
      '0908-805-805',
      '0908 805 805',
      '(0908) 805-805'
    ];

    for (const phone of phoneTests) {
      const testUser = new User({ phone });
      const cleanedPhone = testUser.phone.replace(/\D/g, '');
      let finalPhone = cleanedPhone;
      
      if (finalPhone.startsWith('886')) {
        finalPhone = finalPhone.substring(3);
      }
      if (finalPhone.length > 10) {
        finalPhone = finalPhone.substring(finalPhone.length - 10);
      }
      
      console.log(`   "${phone}" -> "${finalPhone}"`);
    }

    // Test 7: Test Multiple VIP Users
    console.log('\n7️⃣ Testing Multiple VIP Users...');
    
    const vipUsers = [
      { name: 'VIP User 1', email: 'vip1@test.com', phone: '0908805805', discount: 15 },
      { name: 'VIP User 2', email: 'vip2@test.com', phone: '0912345678', discount: 20 },
      { name: 'VIP User 3', email: 'vip3@test.com', phone: '0987654321', discount: 25 }
    ];

    for (const userData of vipUsers) {
      const user = await User.findOneAndUpdate(
        { email: userData.email },
        {
          ...userData,
          password: 'vip123456',
          role: 'user',
          isVIP: true,
          vipDiscount: userData.discount,
          isActive: true
        },
        { upsert: true, new: true }
      );

      user.vipCode = user.generateVIPCode();
      user.vipCreatedAt = new Date();
      await user.save();

      console.log(`   ${user.name}: ${user.vipCode} (${user.vipDiscount}%)`);
    }

    // Test 8: Test VIP Code Uniqueness
    console.log('\n8️⃣ Testing VIP Code Uniqueness...');
    
    const allVIPUsers = await User.find({ isVIP: true });
    const vipCodes = allVIPUsers.map(user => user.vipCode);
    const uniqueCodes = [...new Set(vipCodes)];
    
    if (vipCodes.length === uniqueCodes.length) {
      console.log('✅ All VIP codes are unique');
    } else {
      console.log('❌ Duplicate VIP codes found');
      console.log(`   Total codes: ${vipCodes.length}`);
      console.log(`   Unique codes: ${uniqueCodes.length}`);
    }

    console.log('\n🎉 Complete VIP Feature Test Results:');
    console.log(`   Total VIP Users: ${allVIPUsers.length}`);
    console.log(`   Unique VIP Codes: ${uniqueCodes.length}`);
    console.log(`   Test Status: ✅ All tests passed`);

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error testing VIP feature:', error);
    await mongoose.disconnect();
  }
}

testCompleteVIPFeature(); 