const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Booking = require('../models/Booking');

async function cleanupInvalidBookings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find bookings with parkingLot reference but no parkingType
    const invalidBookings = await Booking.find({ 
      parkingLot: { $exists: true },
      parkingType: { $exists: false }
    });
    
    if (invalidBookings.length === 0) {
      console.log('No invalid bookings to clean up');
      return;
    }

    console.log(`Found ${invalidBookings.length} invalid bookings to clean up`);

    // Delete invalid bookings
    const result = await Booking.deleteMany({ 
      parkingLot: { $exists: true },
      parkingType: { $exists: false }
    });

    console.log(`✅ Deleted ${result.deletedCount} invalid bookings`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupInvalidBookings(); 