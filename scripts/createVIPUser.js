const mongoose = require('mongoose');
const User = require('../models/User');

async function createVIPUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    // Create VIP user
    const vipUser = await User.findOneAndUpdate(
      { email: 'vip@test.com' },
      {
        name: 'VIP Test User',
        email: 'vip@test.com',
        phone: '0912345678',
        password: 'vip123456',
        role: 'user',
        isVIP: true,
        vipDiscount: 15, // 15% discount
        licensePlate: 'VIP123',
        isActive: true
      },
      { upsert: true, new: true }
    );

    console.log('🎉 VIP user created/updated successfully!');
    console.log('📋 VIP User Details:');
    console.log(`   Email: ${vipUser.email}`);
    console.log(`   Password: vip123456`);
    console.log(`   VIP Discount: ${vipUser.vipDiscount}%`);
    console.log(`   Is VIP: ${vipUser.isVIP}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating VIP user:', error);
    await mongoose.disconnect();
  }
}

createVIPUser(); 