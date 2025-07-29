const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');
const Booking = require('../models/Booking');
const ParkingType = require('../models/ParkingType');
const AddonService = require('../models/AddonService');
const User = require('../models/User');

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

async function testLuggageFeature() {
  try {
    console.log('\n🧳 Testing Luggage Feature...\n');

    // 1. Test SystemSettings luggage configuration
    console.log('1. Testing SystemSettings luggage configuration...');
    const settings = await SystemSettings.getSettings();
    console.log('Current luggage settings:', settings.luggageSettings);
    
    // Update luggage settings for testing
    await SystemSettings.findOneAndUpdate({}, {
      luggageSettings: {
        freeLuggageCount: 1,
        luggagePricePerItem: 100
      }
    }, { new: true });
    console.log('✅ Updated luggage settings');

    // 2. Test price calculation with different luggage counts
    console.log('\n2. Testing price calculation with different luggage counts...');
    
    const parkingType = await ParkingType.findOne({ isActive: true });
    if (!parkingType) {
      console.log('❌ No active parking type found');
      return;
    }

    const testCases = [
      { luggageCount: 0, expectedFee: 0 },
      { luggageCount: 1, expectedFee: 0 }, // Free
      { luggageCount: 2, expectedFee: 100 }, // 1 additional
      { luggageCount: 3, expectedFee: 200 }, // 2 additional
      { luggageCount: 5, expectedFee: 400 } // 4 additional
    ];

    for (const testCase of testCases) {
      const { freeLuggageCount, luggagePricePerItem } = settings.luggageSettings;
      const additionalLuggage = Math.max(0, testCase.luggageCount - freeLuggageCount);
      const calculatedFee = additionalLuggage * luggagePricePerItem;
      
      console.log(`   Luggage: ${testCase.luggageCount} → Fee: ${calculatedFee} NT$ (Expected: ${testCase.expectedFee} NT$)`);
      
      if (calculatedFee === testCase.expectedFee) {
        console.log('   ✅ Correct calculation');
      } else {
        console.log('   ❌ Incorrect calculation');
      }
    }

    // 3. Test with real booking data
    console.log('\n3. Testing with real booking data...');
    
    const user = await User.findOne({});
    if (!user) {
      console.log('❌ No user found');
      return;
    }

    const checkInTime = new Date();
    checkInTime.setDate(checkInTime.getDate() + 1);
    const checkOutTime = new Date(checkInTime);
    checkOutTime.setDate(checkOutTime.getDate() + 2);

    // Test booking with 2 luggage items
    const bookingData = {
      user: user._id,
      parkingType: parkingType._id,
      checkInTime,
      checkOutTime,
      driverName: 'Test Driver',
      phone: '0900000000',
      email: 'test@example.com',
      licensePlate: 'TEST-1234',
      passengerCount: 1,
      luggageCount: 2, // 2 luggage items
      addonServices: [],
      totalAmount: parkingType.pricePerDay * 2, // 2 days
      discountAmount: 0,
      finalAmount: parkingType.pricePerDay * 2 + 100, // Base + 1 luggage fee
      status: 'confirmed',
      paymentStatus: 'pending',
      paymentMethod: 'cash'
    };

    const booking = await Booking.create(bookingData);
    console.log('✅ Created test booking with 2 luggage items');
    console.log('   Booking ID:', booking._id);
    console.log('   Luggage count:', booking.luggageCount);
    console.log('   Final amount:', booking.finalAmount);

    // 4. Test API endpoints
    console.log('\n4. Testing API endpoints...');
    
    const axios = require('axios');
    const baseURL = 'http://localhost:5002/api';

    try {
      // Test system settings endpoint
      const settingsResponse = await axios.get(`${baseURL}/system-settings`);
      console.log('✅ System settings API working');
      console.log('   Luggage settings:', settingsResponse.data.luggageSettings);

      // Test booking creation with luggage
      const bookingResponse = await axios.post(`${baseURL}/bookings`, {
        parkingTypeId: parkingType._id,
        checkInTime: checkInTime.toISOString(),
        checkOutTime: checkOutTime.toISOString(),
        driverName: 'API Test Driver',
        phone: '0900000001',
        email: 'apitest@example.com',
        licensePlate: 'API-1234',
        passengerCount: 1,
        luggageCount: 3, // 3 luggage items
        addonServices: [],
        discountCode: '',
        estimatedArrivalTime: '',
        flightNumber: '',
        notes: 'API test booking'
      }, {
        headers: {
          'Authorization': `Bearer ${user.token || 'test-token'}`
        }
      });

      console.log('✅ Booking creation API working with luggage');
      console.log('   Created booking:', bookingResponse.data.booking._id);
      console.log('   Luggage count:', bookingResponse.data.booking.luggageCount);

    } catch (error) {
      console.log('❌ API test failed:', error.response?.data?.message || error.message);
    }

    // 5. Cleanup
    console.log('\n5. Cleaning up test data...');
    await Booking.findByIdAndDelete(booking._id);
    console.log('✅ Cleaned up test booking');

    console.log('\n🎉 Luggage feature test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing luggage feature:', error);
  }
}

async function main() {
  await connectDB();
  await testLuggageFeature();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testLuggageFeature }; 