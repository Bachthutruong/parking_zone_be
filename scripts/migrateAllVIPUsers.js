const mongoose = require('mongoose');
const User = require('../models/User');

async function migrateAllVIPUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    console.log('🚀 Starting VIP Users Migration...\n');

    // Step 1: Check current status
    console.log('📊 Step 1: Checking current VIP status...');
    
    const allUsers = await User.find({}).sort({ name: 1 });
    const vipUsers = await User.find({ isVIP: true }).sort({ name: 1 });
    const vipUsersWithoutCodes = await User.find({
      isVIP: true,
      $or: [
        { vipCode: { $exists: false } },
        { vipCode: null },
        { vipCode: '' }
      ]
    }).sort({ name: 1 });

    console.log(`   Total users: ${allUsers.length}`);
    console.log(`   VIP users: ${vipUsers.length}`);
    console.log(`   VIP users without codes: ${vipUsersWithoutCodes.length}`);

    if (vipUsersWithoutCodes.length === 0) {
      console.log('   ✅ All VIP users already have codes!');
      console.log('\n🎉 Migration completed successfully!');
      await mongoose.disconnect();
      return;
    }

    // Step 2: Generate VIP codes for users without codes
    console.log('\n🔄 Step 2: Generating VIP codes...');
    
    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const user of vipUsersWithoutCodes) {
      try {
        console.log(`\n   Processing: ${user.name} (${user.email})`);
        console.log(`      Phone: ${user.phone}`);
        console.log(`      VIP Discount: ${user.vipDiscount}%`);

        // Generate VIP code
        const vipCode = user.generateVIPCode();
        console.log(`      Generated VIP Code: ${vipCode}`);

        // Check if code already exists
        const existingUser = await User.findOne({ 
          vipCode: vipCode,
          _id: { $ne: user._id }
        });

        if (existingUser) {
          console.log(`      ⚠️ VIP code already exists for user: ${existingUser.name}`);
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

        console.log(`      ✅ Updated successfully`);
        
        results.success.push({
          name: user.name,
          email: user.email,
          phone: user.phone,
          vipCode: vipCode,
          vipDiscount: user.vipDiscount
        });

      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
        results.failed.push({
          name: user.name,
          email: user.email,
          phone: user.phone,
          error: error.message
        });
      }
    }

    // Step 3: Summary
    console.log('\n📋 Step 3: Migration Summary');
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

    if (results.skipped.length > 0) {
      console.log('\n⏭️ Skipped Updates:');
      results.skipped.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        console.log(`      Reason: ${user.reason}`);
      });
    }

    // Step 4: Verification
    console.log('\n🔍 Step 4: Final Verification');
    
    const finalVipUsers = await User.find({ isVIP: true });
    const finalVipUsersWithCodes = await User.find({ 
      isVIP: true, 
      vipCode: { $exists: true, $ne: null, $ne: '' } 
    });

    console.log(`   Total VIP users: ${finalVipUsers.length}`);
    console.log(`   VIP users with codes: ${finalVipUsersWithCodes.length}`);
    
    if (finalVipUsers.length === finalVipUsersWithCodes.length) {
      console.log('   ✅ All VIP users now have VIP codes!');
    } else {
      console.log('   ⚠️ Some VIP users still missing codes');
    }

    // Step 5: Show all VIP codes
    console.log('\n📝 Step 5: All VIP Codes');
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

    // Step 6: Check for issues
    console.log('\n🔍 Step 6: Issue Check');
    
    // Check for duplicate VIP codes
    const vipCodes = allVIPUsersWithCodes.map(user => user.vipCode);
    const uniqueCodes = [...new Set(vipCodes)];
    
    if (vipCodes.length !== uniqueCodes.length) {
      console.log('   ⚠️ Duplicate VIP codes found!');
      const duplicates = vipCodes.filter((code, index) => vipCodes.indexOf(code) !== index);
      const uniqueDuplicates = [...new Set(duplicates)];
      console.log(`      Duplicate codes: ${uniqueDuplicates.join(', ')}`);
    } else {
      console.log('   ✅ All VIP codes are unique');
    }

    // Check for invalid phone numbers
    const usersWithInvalidPhones = finalVipUsers.filter(user => {
      const phone = user.phone.replace(/\D/g, '');
      return phone.length < 8 || phone.length > 15;
    });

    if (usersWithInvalidPhones.length > 0) {
      console.log('   ⚠️ Users with potentially invalid phone numbers:');
      usersWithInvalidPhones.forEach(user => {
        console.log(`      ${user.name}: ${user.phone}`);
      });
    } else {
      console.log('   ✅ All VIP users have valid phone numbers');
    }

    console.log('\n🎉 Migration completed!');
    console.log(`   Total processed: ${vipUsersWithoutCodes.length}`);
    console.log(`   Success: ${results.success.length}`);
    console.log(`   Failed: ${results.failed.length}`);
    console.log(`   Skipped: ${results.skipped.length}`);

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error during VIP migration:', error);
    await mongoose.disconnect();
  }
}

migrateAllVIPUsers(); 