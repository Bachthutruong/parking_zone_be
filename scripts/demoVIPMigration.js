// Demo script to show VIP migration process
// This script simulates the migration without connecting to database

console.log('🚀 VIP Users Migration Demo\n');

// Simulate existing VIP users without codes
const existingVIPUsers = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '0908805805',
    vipDiscount: 15,
    vipCode: null
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '0912345678',
    vipDiscount: 20,
    vipCode: null
  },
  {
    name: 'Bob Johnson',
    email: 'bob@example.com',
    phone: '+886-912-345-678',
    vipDiscount: 25,
    vipCode: null
  },
  {
    name: 'Alice Brown',
    email: 'alice@example.com',
    phone: '0987654321',
    vipDiscount: 10,
    vipCode: null
  }
];

// VIP code generation function (same as in User model)
function generateVIPCode(phone) {
  const currentYear = new Date().getFullYear();
  const yearCode = currentYear === 2025 ? '114' : currentYear === 2026 ? '115' : '114';
  
  let phoneNumber = phone.replace(/\D/g, '');
  
  if (phoneNumber.startsWith('886')) {
    phoneNumber = phoneNumber.substring(3);
  }
  
  if (phoneNumber.length > 10) {
    phoneNumber = phoneNumber.substring(phoneNumber.length - 10);
  }
  
  return `${yearCode}${phoneNumber}`;
}

console.log('📊 Step 1: Current VIP Status');
console.log(`   Total VIP users: ${existingVIPUsers.length}`);
console.log(`   VIP users without codes: ${existingVIPUsers.filter(u => !u.vipCode).length}`);

console.log('\n⚠️ VIP Users Missing Codes:');
existingVIPUsers.forEach((user, index) => {
  console.log(`   ${index + 1}. ${user.name} (${user.email})`);
  console.log(`      Phone: ${user.phone}`);
  console.log(`      VIP Discount: ${user.vipDiscount}%`);
  console.log(`      VIP Code: ${user.vipCode || 'MISSING'}`);
  console.log('');
});

console.log('🔄 Step 2: Generating VIP Codes...');

const results = {
  success: [],
  failed: [],
  skipped: []
};

existingVIPUsers.forEach((user, index) => {
  try {
    console.log(`\n   Processing: ${user.name} (${user.email})`);
    console.log(`      Phone: ${user.phone}`);
    console.log(`      VIP Discount: ${user.vipDiscount}%`);

    // Generate VIP code
    const vipCode = generateVIPCode(user.phone);
    console.log(`      Generated VIP Code: ${vipCode}`);

    // Check for duplicate (simulate)
    const existingUserWithSameCode = existingVIPUsers.find(u => 
      u !== user && generateVIPCode(u.phone) === vipCode
    );

    if (existingUserWithSameCode) {
      console.log(`      ⚠️ VIP code already exists for user: ${existingUserWithSameCode.name}`);
      results.skipped.push({
        name: user.name,
        email: user.email,
        phone: user.phone,
        reason: `VIP code ${vipCode} already exists for user ${existingUserWithSameCode.name}`
      });
      return;
    }

    // Update user with VIP code
    user.vipCode = vipCode;
    user.vipCreatedAt = new Date();

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
});

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

console.log('\n🔍 Step 4: Final Verification');
const updatedUsers = existingVIPUsers.filter(u => u.vipCode);
console.log(`   Total VIP users: ${existingVIPUsers.length}`);
console.log(`   VIP users with codes: ${updatedUsers.length}`);

if (existingVIPUsers.length === updatedUsers.length) {
  console.log('   ✅ All VIP users now have VIP codes!');
} else {
  console.log('   ⚠️ Some VIP users still missing codes');
}

console.log('\n📝 Step 5: All VIP Codes');
updatedUsers.forEach((user, index) => {
  console.log(`   ${index + 1}. ${user.name}`);
  console.log(`      Email: ${user.email}`);
  console.log(`      Phone: ${user.phone}`);
  console.log(`      VIP Code: ${user.vipCode}`);
  console.log(`      VIP Discount: ${user.vipDiscount}%`);
  console.log(`      VIP Created: ${user.vipCreatedAt.toLocaleDateString()}`);
  console.log('');
});

console.log('🔍 Step 6: Issue Check');

// Check for duplicate VIP codes
const vipCodes = updatedUsers.map(user => user.vipCode);
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
const usersWithInvalidPhones = existingVIPUsers.filter(user => {
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

console.log('\n🎉 Migration Demo completed!');
console.log(`   Total processed: ${existingVIPUsers.length}`);
console.log(`   Success: ${results.success.length}`);
console.log(`   Failed: ${results.failed.length}`);
console.log(`   Skipped: ${results.skipped.length}`);

console.log('\n💡 Next Steps:');
console.log('   1. Start MongoDB server');
console.log('   2. Run: node scripts/checkVIPStatus.js');
console.log('   3. Run: node scripts/migrateAllVIPUsers.js');
console.log('   4. Verify results with: node scripts/checkVIPStatus.js'); 