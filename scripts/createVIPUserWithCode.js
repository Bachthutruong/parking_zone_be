const mongoose = require('mongoose');
const User = require('../models/User');

async function createVIPUserWithCode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    // Create VIP user with specific phone number
    const vipUserData = {
      name: 'VIP Test User',
      email: 'vip@test.com',
      phone: '0908805805',
      password: 'vip123456',
      role: 'user',
      isVIP: true,
      vipDiscount: 15, // 15% discount
      licensePlate: 'VIP123',
      isActive: true
    };

    // Create or update user
    const vipUser = await User.findOneAndUpdate(
      { email: vipUserData.email },
      vipUserData,
      { upsert: true, new: true }
    );

    // Generate VIP code
    const vipCode = vipUser.generateVIPCode();
    
    // Update user with VIP code
    vipUser.vipCode = vipCode;
    vipUser.vipCreatedAt = new Date();
    await vipUser.save();

    console.log('🎉 VIP user created/updated successfully!');
    console.log('📋 VIP User Details:');
    console.log(`   Name: ${vipUser.name}`);
    console.log(`   Email: ${vipUser.email}`);
    console.log(`   Phone: ${vipUser.phone}`);
    console.log(`   Password: vip123456`);
    console.log(`   VIP Code: ${vipUser.vipCode}`);
    console.log(`   VIP Discount: ${vipUser.vipDiscount}%`);
    console.log(`   Is VIP: ${vipUser.isVIP}`);
    console.log(`   VIP Created: ${vipUser.vipCreatedAt}`);

    // Create another VIP user for testing
    const vipUser2Data = {
      name: 'VIP Test User 2',
      email: 'vip2@test.com',
      phone: '0912345678',
      password: 'vip123456',
      role: 'user',
      isVIP: true,
      vipDiscount: 20, // 20% discount
      licensePlate: 'VIP456',
      isActive: true
    };

    const vipUser2 = await User.findOneAndUpdate(
      { email: vipUser2Data.email },
      vipUser2Data,
      { upsert: true, new: true }
    );

    // Generate VIP code for second user
    const vipCode2 = vipUser2.generateVIPCode();
    
    // Update user with VIP code
    vipUser2.vipCode = vipCode2;
    vipUser2.vipCreatedAt = new Date();
    await vipUser2.save();

    console.log('\n🎉 Second VIP user created/updated successfully!');
    console.log('📋 VIP User 2 Details:');
    console.log(`   Name: ${vipUser2.name}`);
    console.log(`   Email: ${vipUser2.email}`);
    console.log(`   Phone: ${vipUser2.phone}`);
    console.log(`   Password: vip123456`);
    console.log(`   VIP Code: ${vipUser2.vipCode}`);
    console.log(`   VIP Discount: ${vipUser2.vipDiscount}%`);
    console.log(`   Is VIP: ${vipUser2.isVIP}`);
    console.log(`   VIP Created: ${vipUser2.vipCreatedAt}`);

    console.log('\n🔍 Test VIP Codes:');
    console.log(`   VIP Code 1: ${vipUser.vipCode} (for ${vipUser.phone})`);
    console.log(`   VIP Code 2: ${vipUser2.vipCode} (for ${vipUser2.phone})`);

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating VIP user:', error);
    await mongoose.disconnect();
  }
}

createVIPUserWithCode(); 