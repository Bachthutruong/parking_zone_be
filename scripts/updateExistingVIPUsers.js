const mongoose = require('mongoose');
const User = require('../models/User');

async function updateExistingVIPUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    console.log('🔄 Updating existing VIP users...\n');

    // Find all VIP users that don't have vipCode
    const vipUsersWithoutCode = await User.find({
      isVIP: true,
      $or: [
        { vipCode: { $exists: false } },
        { vipCode: null },
        { vipCode: '' }
      ]
    });

    console.log(`📊 Found ${vipUsersWithoutCode.length} VIP users without VIP codes`);

    if (vipUsersWithoutCode.length === 0) {
      console.log('✅ All VIP users already have VIP codes!');
      await mongoose.disconnect();
      return;
    }

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const user of vipUsersWithoutCode) {
      try {
        console.log(`\n🔄 Processing: ${user.name} (${user.email})`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Current VIP Discount: ${user.vipDiscount}%`);

        // Generate VIP code
        const vipCode = user.generateVIPCode();
        console.log(`   Generated VIP Code: ${vipCode}`);

        // Update user with VIP code
        user.vipCode = vipCode;
        user.vipCreatedAt = new Date();
        await user.save();

        console.log(`   ✅ Updated successfully`);
        
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
    console.log('\n📋 Update Summary:');
    console.log(`   ✅ Successfully updated: ${results.success.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}`);
    console.log(`   ⏭️ Skipped: ${results.skipped.length}`);

    if (results.success.length > 0) {
      console.log('\n✅ Successfully Updated Users:');
      results.success.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        console.log(`      Phone: ${user.phone}`);
        console.log(`      VIP Code: ${user.vipCode}`);
        console.log(`      VIP Discount: ${user.vipDiscount}%`);
      });
    }

    if (results.failed.length > 0) {
      console.log('\n❌ Failed Updates:');
      results.failed.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        console.log(`      Error: ${user.error}`);
      });
    }

    // Verify all VIP users now have codes
    const allVIPUsers = await User.find({ isVIP: true });
    const usersWithCodes = await User.find({ 
      isVIP: true, 
      vipCode: { $exists: true, $ne: null, $ne: '' } 
    });

    console.log('\n🔍 Verification:');
    console.log(`   Total VIP users: ${allVIPUsers.length}`);
    console.log(`   VIP users with codes: ${usersWithCodes.length}`);
    
    if (allVIPUsers.length === usersWithCodes.length) {
      console.log('   ✅ All VIP users now have VIP codes!');
    } else {
      console.log('   ⚠️ Some VIP users still missing codes');
    }

    // Show all VIP codes for reference
    console.log('\n📝 All VIP Codes:');
    const allVIPUsersWithCodes = await User.find({ 
      isVIP: true, 
      vipCode: { $exists: true, $ne: null, $ne: '' } 
    }).sort({ name: 1 });

    allVIPUsersWithCodes.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Phone: ${user.phone}`);
      console.log(`      VIP Code: ${user.vipCode}`);
      console.log(`      VIP Discount: ${user.vipDiscount}%`);
      console.log(`      VIP Created: ${user.vipCreatedAt ? user.vipCreatedAt.toLocaleDateString() : 'N/A'}`);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error updating existing VIP users:', error);
    await mongoose.disconnect();
  }
}

updateExistingVIPUsers(); 