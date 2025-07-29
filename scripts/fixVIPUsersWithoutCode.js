const mongoose = require('mongoose');
const User = require('../models/User');

async function fixVIPUsersWithoutCode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    console.log('🔧 Fixing VIP Users Without Codes...\n');

    // Find VIP users without codes
    const vipUsersWithoutCodes = await User.find({
      isVIP: true,
      $or: [
        { vipCode: { $exists: false } },
        { vipCode: null },
        { vipCode: '' }
      ]
    });

    console.log(`📊 Found ${vipUsersWithoutCodes.length} VIP users without codes`);

    if (vipUsersWithoutCodes.length === 0) {
      console.log('✅ All VIP users already have codes!');
      await mongoose.disconnect();
      return;
    }

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const user of vipUsersWithoutCodes) {
      try {
        console.log(`\n🔄 Processing: ${user.name} (${user.email})`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   VIP Discount: ${user.vipDiscount}%`);

        // Generate VIP code
        const vipCode = user.generateVIPCode();
        console.log(`   Generated VIP Code: ${vipCode}`);

        // Check if code already exists
        const existingUser = await User.findOne({ 
          vipCode: vipCode,
          _id: { $ne: user._id }
        });

        if (existingUser) {
          console.log(`   ⚠️ VIP code already exists for user: ${existingUser.name}`);
          results.skipped.push({
            name: user.name,
            email: user.email,
            phone: user.phone,
            reason: `VIP code ${vipCode} already exists for user ${existingUser.name}`
          });
          continue;
        }

        // Update user with VIP code
        user.vipCode = vipCode;
        user.vipCreatedAt = new Date();
        await user.save();

        console.log(`   ✅ Fixed successfully`);
        
        results.success.push({
          name: user.name,
          email: user.email,
          phone: user.phone,
          vipCode: vipCode,
          vipDiscount: user.vipDiscount
        });

      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        results.failed.push({
          name: user.name,
          email: user.email,
          phone: user.phone,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n📋 Fix Summary:');
    console.log(`   ✅ Successfully fixed: ${results.success.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}`);
    console.log(`   ⏭️ Skipped: ${results.skipped.length}`);

    if (results.success.length > 0) {
      console.log('\n✅ Successfully Fixed Users:');
      results.success.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        console.log(`      Phone: ${user.phone}`);
        console.log(`      VIP Code: ${user.vipCode}`);
        console.log(`      VIP Discount: ${user.vipDiscount}%`);
      });
    }

    if (results.failed.length > 0) {
      console.log('\n❌ Failed Fixes:');
      results.failed.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        console.log(`      Error: ${user.error}`);
      });
    }

    if (results.skipped.length > 0) {
      console.log('\n⏭️ Skipped Fixes:');
      results.skipped.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        console.log(`      Reason: ${user.reason}`);
      });
    }

    // Final verification
    const finalVipUsers = await User.find({ isVIP: true });
    const finalVipUsersWithCodes = await User.find({ 
      isVIP: true, 
      vipCode: { $exists: true, $ne: null, $ne: '' } 
    });

    console.log('\n🔍 Final Verification:');
    console.log(`   Total VIP users: ${finalVipUsers.length}`);
    console.log(`   VIP users with codes: ${finalVipUsersWithCodes.length}`);
    
    if (finalVipUsers.length === finalVipUsersWithCodes.length) {
      console.log('   ✅ All VIP users now have codes!');
    } else {
      console.log('   ⚠️ Some VIP users still missing codes');
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error fixing VIP users:', error);
    await mongoose.disconnect();
  }
}

fixVIPUsersWithoutCode(); 