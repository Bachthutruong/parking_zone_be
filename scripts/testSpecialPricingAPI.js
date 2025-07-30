const mongoose = require('mongoose');
const ParkingType = require('../models/ParkingType');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function testSpecialPricingAPI() {
  try {
    console.log('🧪 Testing Special Pricing API...\n');

    // Get a parking type
    const parkingTypes = await ParkingType.find({ isActive: true });
    if (parkingTypes.length === 0) {
      console.log('❌ No active parking types found');
      return;
    }

    const parkingType = parkingTypes[0];
    console.log('   Using parking type:', parkingType.name, `(${parkingType._id})`);

    // Test 1: Create single day special price
    console.log('\n1. Testing single day special price...');
    
    const singleDayData = {
      startDate: '2025-08-30',
      endDate: '2025-08-30',
      price: 2500,
      reason: 'Test Single Day',
      isActive: true
    };

    try {
      // Simulate the API call by directly adding to database
      parkingType.specialPrices.push({
        startDate: new Date(singleDayData.startDate),
        endDate: new Date(singleDayData.endDate),
        price: singleDayData.price,
        reason: singleDayData.reason,
        isActive: singleDayData.isActive
      });

      await parkingType.save();
      console.log('   ✅ Single day special price created successfully');
      console.log(`   📅 Date: ${singleDayData.startDate}`);
      console.log(`   💰 Price: ${singleDayData.price} NT$`);
    } catch (error) {
      console.log('   ❌ Error creating single day special price:', error.message);
    }

    // Test 2: Try to create overlapping special price
    console.log('\n2. Testing overlapping special price...');
    
    const overlappingData = {
      startDate: '2025-08-30',
      endDate: '2025-08-30',
      price: 3000,
      reason: 'Test Overlapping',
      isActive: true
    };

    try {
      // Check for overlap
      const existingSpecialPrice = parkingType.specialPrices.find(sp => 
        sp.isActive && 
        ((new Date(overlappingData.startDate) <= sp.endDate && new Date(overlappingData.endDate) >= sp.startDate))
      );

      if (existingSpecialPrice) {
        console.log('   ⚠️  Overlapping special price detected');
        console.log(`   📅 Existing: ${existingSpecialPrice.startDate.toISOString().split('T')[0]} - ${existingSpecialPrice.endDate.toISOString().split('T')[0]}`);
        console.log(`   💰 Existing price: ${existingSpecialPrice.price} NT$`);
        console.log(`   📝 Existing reason: ${existingSpecialPrice.reason}`);
      } else {
        console.log('   ✅ No overlap detected');
      }
    } catch (error) {
      console.log('   ❌ Error checking overlap:', error.message);
    }

    // Test 3: Test force override
    console.log('\n3. Testing force override...');
    
    try {
      // Remove overlapping special prices
      parkingType.specialPrices = parkingType.specialPrices.filter(sp => 
        !(sp.isActive && ((new Date(overlappingData.startDate) <= sp.endDate && new Date(overlappingData.endDate) >= sp.startDate)))
      );
      
      // Add new special price
      parkingType.specialPrices.push({
        startDate: new Date(overlappingData.startDate),
        endDate: new Date(overlappingData.endDate),
        price: overlappingData.price,
        reason: overlappingData.reason,
        isActive: overlappingData.isActive
      });
      
      await parkingType.save();
      console.log('   ✅ Force override successful');
      console.log(`   📅 New date: ${overlappingData.startDate}`);
      console.log(`   💰 New price: ${overlappingData.price} NT$`);
    } catch (error) {
      console.log('   ❌ Error with force override:', error.message);
    }

    // Show final state
    console.log('\n4. Final state...');
    console.log(`   📊 Total special prices: ${parkingType.specialPrices.length}`);
    
    parkingType.specialPrices.forEach((sp, index) => {
      console.log(`   ${index + 1}. ${sp.startDate.toISOString().split('T')[0]} - ${sp.endDate.toISOString().split('T')[0]}: ${sp.price} NT$ (${sp.reason})`);
    });

    console.log('\n🎉 Special pricing API test completed!');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

async function main() {
  await connectDB();
  await testSpecialPricingAPI();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

main().catch(console.error); 