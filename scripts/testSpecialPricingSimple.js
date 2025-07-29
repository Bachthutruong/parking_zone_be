const mongoose = require('mongoose');
const ParkingType = require('../models/ParkingType');

require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function testSpecialPricingSimple() {
  try {
    console.log('💰 Testing Special Pricing (Simple)...\n');

    // 1. Get parking types
    console.log('1. Getting parking types...');
    const parkingTypes = await ParkingType.find({ isActive: true });
    console.log(`✅ Found ${parkingTypes.length} active parking types`);
    
    if (parkingTypes.length === 0) {
      console.log('❌ No active parking types found');
      return;
    }

    const parkingType = parkingTypes[0];
    console.log('   Selected:', parkingType.name, `(${parkingType._id})`);

    // 2. Check current special prices
    console.log('\n2. Checking current special prices...');
    console.log(`   Current special prices: ${parkingType.specialPrices.length}`);
    
    if (parkingType.specialPrices.length > 0) {
      parkingType.specialPrices.forEach((sp, index) => {
        console.log(`   ${index + 1}. ${sp.startDate.toDateString()} - ${sp.endDate.toDateString()}: ${sp.price} NT$ (${sp.reason})`);
      });
    }

    // 3. Test adding special price
    console.log('\n3. Testing add special price...');
    const testSpecialPrice = {
      startDate: new Date('2025-08-01'),
      endDate: new Date('2025-08-02'),
      price: 1500,
      reason: 'Test Special Price',
      isActive: true
    };

    // Check for overlapping dates
    const overlapping = parkingType.specialPrices.find(sp => 
      sp.isActive && 
      ((testSpecialPrice.startDate <= sp.endDate && testSpecialPrice.endDate >= sp.startDate))
    );

    if (overlapping) {
      console.log('⚠️  Overlapping special price found, skipping add test');
    } else {
      parkingType.specialPrices.push(testSpecialPrice);
      await parkingType.save();
      console.log('✅ Added test special price');
      console.log('   Start Date:', testSpecialPrice.startDate.toDateString());
      console.log('   End Date:', testSpecialPrice.endDate.toDateString());
      console.log('   Price:', testSpecialPrice.price, 'NT$');
      console.log('   Reason:', testSpecialPrice.reason);
    }

    // 4. Test updating special price
    console.log('\n4. Testing update special price...');
    if (parkingType.specialPrices.length > 0) {
      const specialPriceToUpdate = parkingType.specialPrices[parkingType.specialPrices.length - 1];
      specialPriceToUpdate.price = 2000;
      specialPriceToUpdate.reason = 'Updated Test Special Price';
      
      await parkingType.save();
      console.log('✅ Updated special price');
      console.log('   New Price:', specialPriceToUpdate.price, 'NT$');
      console.log('   New Reason:', specialPriceToUpdate.reason);
    }

    // 5. Test deleting special price
    console.log('\n5. Testing delete special price...');
    if (parkingType.specialPrices.length > 0) {
      const specialPriceToDelete = parkingType.specialPrices[parkingType.specialPrices.length - 1];
      const deleteId = specialPriceToDelete._id;
      
      parkingType.specialPrices = parkingType.specialPrices.filter(
        sp => sp._id.toString() !== deleteId.toString()
      );
      
      await parkingType.save();
      console.log('✅ Deleted special price');
      console.log('   Deleted ID:', deleteId);
    }

    // 6. Final check
    console.log('\n6. Final check...');
    const updatedParkingType = await ParkingType.findById(parkingType._id);
    console.log(`   Remaining special prices: ${updatedParkingType.specialPrices.length}`);

    console.log('\n🎉 Special pricing test completed successfully!');

  } catch (error) {
    console.error('❌ Error in special pricing test:', error);
  }
}

async function main() {
  await connectDB();
  await testSpecialPricingSimple();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSpecialPricingSimple }; 