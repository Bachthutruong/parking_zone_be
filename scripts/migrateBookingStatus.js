const mongoose = require('mongoose');
const Booking = require('../models/Booking');

async function migrateBookingStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    console.log('🔄 Migrating Booking Statuses...\n');

    // 1. Find all bookings with status 'confirmed'
    const confirmedBookings = await Booking.find({ status: 'confirmed' });
    console.log(`📊 Found ${confirmedBookings.length} bookings with status 'confirmed'`);

    if (confirmedBookings.length === 0) {
      console.log('✅ No bookings to migrate');
      await mongoose.disconnect();
      return;
    }

    // 2. Update all confirmed bookings to pending
    const updateResult = await Booking.updateMany(
      { status: 'confirmed' },
      { status: 'pending' }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} bookings from 'confirmed' to 'pending'`);

    // 3. Verify the migration
    const remainingConfirmed = await Booking.find({ status: 'confirmed' });
    const newPending = await Booking.find({ status: 'pending' });

    console.log('\n📋 Migration Summary:');
    console.log(`   Remaining 'confirmed' bookings: ${remainingConfirmed.length}`);
    console.log(`   Total 'pending' bookings: ${newPending.length}`);

    // 4. Show some examples of migrated bookings
    const sampleMigrated = await Booking.find({ status: 'pending' })
      .populate('parkingType', 'name')
      .limit(5);

    if (sampleMigrated.length > 0) {
      console.log('\n📝 Sample migrated bookings:');
      sampleMigrated.forEach((booking, index) => {
        console.log(`   ${index + 1}. ${booking.driverName} - ${booking.parkingType.name} - ${booking.status}`);
      });
    }

    console.log('\n🎉 Booking status migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ All "confirmed" bookings changed to "pending"');
    console.log('   ✅ Status now shows as "Đang chờ vào bãi"');
    console.log('   ✅ Admin can directly click buttons to update status');

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error migrating booking statuses:', error);
    await mongoose.disconnect();
  }
}

migrateBookingStatus(); 