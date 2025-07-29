const mongoose = require('mongoose');
const User = require('../models/User');

async function testVIPCode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    // Test VIP code generation for different years
    const testUsers = [
      {
        name: 'Test VIP 2025',
        email: 'vip2025@test.com',
        phone: '0908805805',
        password: 'test123456',
        role: 'user',
        isVIP: true,
        vipDiscount: 15
      },
      {
        name: 'Test VIP 2026',
        email: 'vip2026@test.com',
        phone: '0912345678',
        password: 'test123456',
        role: 'user',
        isVIP: true,
        vipDiscount: 20
      }
    ];

    for (const userData of testUsers) {
      // Create or update user
      const user = await User.findOneAndUpdate(
        { email: userData.email },
        userData,
        { upsert: true, new: true }
      );

      // Generate VIP code
      const vipCode = user.generateVIPCode();
      
      // Update user with VIP code
      user.vipCode = vipCode;
      user.vipCreatedAt = new Date();
      await user.save();

      console.log(`\n🎉 VIP User: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   VIP Code: ${user.vipCode}`);
      console.log(`   VIP Discount: ${user.vipDiscount}%`);
      console.log(`   VIP Created: ${user.vipCreatedAt}`);
    }

    // Test VIP code validation
    console.log('\n🔍 Testing VIP Code Validation:');
    
    // Test with valid code
    const validUser = await User.findOne({ email: 'vip2025@test.com' });
    if (validUser) {
      const testCode = validUser.vipCode;
      const foundUser = await User.findOne({ 
        vipCode: testCode,
        isVIP: true,
        isActive: true
      });
      
      if (foundUser) {
        console.log(`✅ Valid VIP Code: ${testCode} -> ${foundUser.name}`);
      } else {
        console.log(`❌ Invalid VIP Code: ${testCode}`);
      }
    }

    // Test with invalid code
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

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error testing VIP code:', error);
    await mongoose.disconnect();
  }
}

testVIPCode(); 