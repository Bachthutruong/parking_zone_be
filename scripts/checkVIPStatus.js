const mongoose = require('mongoose');
const User = require('../models/User');

async function checkVIPStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    console.log('🔍 Checking VIP Users Status...\n');

    // Get all users
    const allUsers = await User.find({}).sort({ name: 1 });
    const vipUsers = await User.find({ isVIP: true }).sort({ name: 1 });
    const nonVipUsers = await User.find({ isVIP: false }).sort({ name: 1 });

    console.log(`📊 User Statistics:`);
    console.log(`   Total users: ${allUsers.length}`);
    console.log(`   VIP users: ${vipUsers.length}`);
    console.log(`   Non-VIP users: ${nonVipUsers.length}`);

    // Check VIP users with codes
    const vipUsersWithCodes = await User.find({
      isVIP: true,
      vipCode: { $exists: true, $ne: null, $ne: '' }
    }).sort({ name: 1 });

    const vipUsersWithoutCodes = await User.find({
      isVIP: true,
      $or: [
        { vipCode: { $exists: false } },
        { vipCode: null },
        { vipCode: '' }
      ]
    }).sort({ name: 1 });

    console.log(`\n🔍 VIP Code Status:`);
    console.log(`   VIP users with codes: ${vipUsersWithCodes.length}`);
    console.log(`   VIP users without codes: ${vipUsersWithoutCodes.length}`);

    if (vipUsersWithoutCodes.length > 0) {
      console.log(`\n⚠️ VIP Users Missing Codes:`);
      vipUsersWithoutCodes.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        console.log(`      Phone: ${user.phone}`);
        console.log(`      VIP Discount: ${user.vipDiscount}%`);
        console.log(`      VIP Code: ${user.vipCode || 'MISSING'}`);
        console.log(`      VIP Created: ${user.vipCreatedAt ? user.vipCreatedAt.toLocaleDateString() : 'N/A'}`);
        console.log('');
      });
    }

    if (vipUsersWithCodes.length > 0) {
      console.log(`\n✅ VIP Users With Codes:`);
      vipUsersWithCodes.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
        console.log(`      Phone: ${user.phone}`);
        console.log(`      VIP Code: ${user.vipCode}`);
        console.log(`      VIP Discount: ${user.vipDiscount}%`);
        console.log(`      VIP Created: ${user.vipCreatedAt ? user.vipCreatedAt.toLocaleDateString() : 'N/A'}`);
        console.log('');
      });
    }

    // Check for potential issues
    console.log(`\n🔍 Potential Issues:`);
    
    // Check for duplicate VIP codes
    const vipCodes = vipUsersWithCodes.map(user => user.vipCode);
    const uniqueCodes = [...new Set(vipCodes)];
    
    if (vipCodes.length !== uniqueCodes.length) {
      console.log(`   ⚠️ Duplicate VIP codes found!`);
      console.log(`      Total codes: ${vipCodes.length}`);
      console.log(`      Unique codes: ${uniqueCodes.length}`);
      
      // Find duplicates
      const duplicates = vipCodes.filter((code, index) => vipCodes.indexOf(code) !== index);
      const uniqueDuplicates = [...new Set(duplicates)];
      
      console.log(`      Duplicate codes: ${uniqueDuplicates.join(', ')}`);
    } else {
      console.log(`   ✅ All VIP codes are unique`);
    }

    // Check for invalid phone numbers
    const usersWithInvalidPhones = vipUsers.filter(user => {
      const phone = user.phone.replace(/\D/g, '');
      return phone.length < 8 || phone.length > 15;
    });

    if (usersWithInvalidPhones.length > 0) {
      console.log(`   ⚠️ Users with potentially invalid phone numbers:`);
      usersWithInvalidPhones.forEach(user => {
        console.log(`      ${user.name}: ${user.phone}`);
      });
    } else {
      console.log(`   ✅ All VIP users have valid phone numbers`);
    }

    // Check for users with VIP discount but not VIP status
    const nonVipWithDiscount = await User.find({
      isVIP: false,
      vipDiscount: { $gt: 0 }
    });

    if (nonVipWithDiscount.length > 0) {
      console.log(`   ⚠️ Non-VIP users with VIP discount:`);
      nonVipWithDiscount.forEach(user => {
        console.log(`      ${user.name}: ${user.vipDiscount}%`);
      });
    } else {
      console.log(`   ✅ No non-VIP users with VIP discount`);
    }

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    
    if (vipUsersWithoutCodes.length > 0) {
      console.log(`   1. Run updateExistingVIPUsers.js to generate VIP codes for ${vipUsersWithoutCodes.length} users`);
    }
    
    if (usersWithInvalidPhones.length > 0) {
      console.log(`   2. Review phone numbers for ${usersWithInvalidPhones.length} users`);
    }
    
    if (nonVipWithDiscount.length > 0) {
      console.log(`   3. Review VIP discount settings for ${nonVipWithDiscount.length} non-VIP users`);
    }

    if (vipUsersWithoutCodes.length === 0 && usersWithInvalidPhones.length === 0 && nonVipWithDiscount.length === 0) {
      console.log(`   ✅ All VIP users are properly configured!`);
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error checking VIP status:', error);
    await mongoose.disconnect();
  }
}

checkVIPStatus(); 