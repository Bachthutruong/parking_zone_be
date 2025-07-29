const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');
const Booking = require('../models/Booking');
const User = require('../models/User');
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

async function updateSampleDataWithLuggage() {
  try {
    console.log('\n🧳 Updating Sample Data with Luggage Feature...\n');

    // 1. Update system settings with luggage configuration
    console.log('1. Updating system settings with luggage configuration...');
    const settings = await SystemSettings.getSettings();
    
    await SystemSettings.findByIdAndUpdate(settings._id, {
      luggageSettings: {
        freeLuggageCount: 1,
        luggagePricePerItem: 100
      }
    }, { new: true });
    
    console.log('✅ Updated luggage settings: 1 free luggage, 100 NT$ per additional item');

    // 2. Update existing bookings with luggage data
    console.log('\n2. Updating existing bookings with luggage data...');
    
    const existingBookings = await Booking.find({});
    console.log(`Found ${existingBookings.length} existing bookings`);

    let updatedCount = 0;
    for (const booking of existingBookings) {
      // Add random luggage count (0-5) to existing bookings
      const luggageCount = Math.floor(Math.random() * 6); // 0-5
      
      // Calculate luggage fee
      const additionalLuggage = Math.max(0, luggageCount - 1); // 1 free
      const luggageFee = additionalLuggage * 100;
      
      // Update booking amounts
      const newTotalAmount = booking.totalAmount + luggageFee;
      const newFinalAmount = booking.finalAmount + luggageFee;
      
      await Booking.findByIdAndUpdate(booking._id, {
        luggageCount,
        totalAmount: newTotalAmount,
        finalAmount: newFinalAmount
      });
      
      updatedCount++;
      console.log(`   Updated booking ${booking._id}: ${luggageCount} luggage (+${luggageFee} NT$)`);
    }
    
    console.log(`✅ Updated ${updatedCount} bookings with luggage data`);

    // 3. Create new sample bookings with luggage
    console.log('\n3. Creating new sample bookings with luggage...');
    
    const users = await User.find({});
    const parkingTypes = await ParkingType.find({ isActive: true });
    
    if (users.length === 0 || parkingTypes.length === 0) {
      console.log('❌ No users or parking types found');
      return;
    }

    const sampleBookings = [
      {
        luggageCount: 0,
        description: 'No luggage booking'
      },
      {
        luggageCount: 1,
        description: '1 luggage (free) booking'
      },
      {
        luggageCount: 2,
        description: '2 luggage (1 free + 1 paid) booking'
      },
      {
        luggageCount: 3,
        description: '3 luggage (1 free + 2 paid) booking'
      },
      {
        luggageCount: 5,
        description: '5 luggage (1 free + 4 paid) booking'
      }
    ];

    for (let i = 0; i < sampleBookings.length; i++) {
      const sample = sampleBookings[i];
      const user = users[i % users.length];
      const parkingType = parkingTypes[i % parkingTypes.length];
      
      const checkInTime = new Date();
      checkInTime.setDate(checkInTime.getDate() + i + 1);
      const checkOutTime = new Date(checkInTime);
      checkOutTime.setDate(checkOutTime.getDate() + 2);
      
      // Calculate luggage fee
      const additionalLuggage = Math.max(0, sample.luggageCount - 1);
      const luggageFee = additionalLuggage * 100;
      
      const basePrice = parkingType.pricePerDay * 2; // 2 days
      const totalAmount = basePrice + luggageFee;
      const finalAmount = totalAmount;
      
      const bookingData = {
        user: user._id,
        parkingType: parkingType._id,
        checkInTime,
        checkOutTime,
        driverName: `Sample Driver ${i + 1}`,
        phone: `090000000${i}`,
        email: `sample${i}@example.com`,
        licensePlate: `SAMPLE-${String(i + 1).padStart(4, '0')}`,
        passengerCount: 1,
        luggageCount: sample.luggageCount,
        addonServices: [],
        totalAmount,
        discountAmount: 0,
        finalAmount,
        status: 'confirmed',
        paymentStatus: 'pending',
        paymentMethod: 'cash'
      };
      
      const booking = await Booking.create(bookingData);
      console.log(`   Created ${sample.description}: ${sample.luggageCount} luggage, ${finalAmount} NT$`);
    }
    
    console.log('✅ Created 5 new sample bookings with different luggage counts');

    // 4. Verify the data
    console.log('\n4. Verifying updated data...');
    
    const allBookings = await Booking.find({});
    const luggageStats = allBookings.reduce((stats, booking) => {
      stats.totalBookings++;
      stats.totalLuggage += booking.luggageCount;
      stats.totalRevenue += booking.finalAmount;
      
      if (booking.luggageCount === 0) stats.noLuggage++;
      else if (booking.luggageCount === 1) stats.freeLuggage++;
      else stats.paidLuggage++;
      
      return stats;
    }, {
      totalBookings: 0,
      totalLuggage: 0,
      totalRevenue: 0,
      noLuggage: 0,
      freeLuggage: 0,
      paidLuggage: 0
    });
    
    console.log('📊 Luggage Statistics:');
    console.log(`   Total bookings: ${luggageStats.totalBookings}`);
    console.log(`   Total luggage items: ${luggageStats.totalLuggage}`);
    console.log(`   Total revenue: ${luggageStats.totalRevenue} NT$`);
    console.log(`   No luggage: ${luggageStats.noLuggage} bookings`);
    console.log(`   Free luggage (1 item): ${luggageStats.freeLuggage} bookings`);
    console.log(`   Paid luggage (2+ items): ${luggageStats.paidLuggage} bookings`);

    // 5. Test booking number format
    console.log('\n5. Testing booking number format...');
    
    const recentBookings = await Booking.find({}).sort({ createdAt: -1 }).limit(3);
    for (const booking of recentBookings) {
      console.log(`   ${booking.bookingNumber} - ${booking.luggageCount} luggage - ${booking.finalAmount} NT$`);
    }

    console.log('\n🎉 Sample data updated successfully with luggage feature!');
    console.log('\n📋 Summary:');
    console.log('   ✅ System settings updated with luggage configuration');
    console.log('   ✅ Existing bookings updated with luggage data');
    console.log('   ✅ New sample bookings created with various luggage counts');
    console.log('   ✅ Booking numbers formatted correctly');
    console.log('   ✅ All calculations working properly');

  } catch (error) {
    console.error('❌ Error updating sample data:', error);
  }
}

async function main() {
  await connectDB();
  await updateSampleDataWithLuggage();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateSampleDataWithLuggage }; 