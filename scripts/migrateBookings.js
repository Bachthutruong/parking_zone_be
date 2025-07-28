const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Booking = require('../models/Booking');
const ParkingType = require('../models/ParkingType');

async function migrateBookings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all bookings with parkingLot reference
    const bookingsWithParkingLot = await Booking.find({ parkingLot: { $exists: true } });
    
    if (bookingsWithParkingLot.length === 0) {
      console.log('No bookings to migrate');
      return;
    }

    console.log(`Found ${bookingsWithParkingLot.length} bookings to migrate`);

    // Get all parking types to map them
    const parkingTypes = await ParkingType.find({});
    const typeMapping = {
      'indoor': parkingTypes.find(pt => pt.type === 'indoor')?._id,
      'outdoor': parkingTypes.find(pt => pt.type === 'outdoor')?._id,
      'disabled': parkingTypes.find(pt => pt.type === 'disabled')?._id
    };

    console.log('Type mapping:', typeMapping);

    // Migrate each booking
    for (const booking of bookingsWithParkingLot) {
      try {
        // Get the parking lot to determine its type
        const ParkingLot = require('../models/ParkingLot');
        const parkingLot = await ParkingLot.findById(booking.parkingLot);
        
        if (!parkingLot) {
          console.log(`Parking lot not found for booking ${booking._id}, skipping...`);
          continue;
        }

        // Map to corresponding parking type
        const parkingTypeId = typeMapping[parkingLot.type];
        
        if (!parkingTypeId) {
          console.log(`No parking type found for type ${parkingLot.type}, skipping booking ${booking._id}`);
          continue;
        }

        // Update the booking
        await Booking.findByIdAndUpdate(booking._id, {
          $unset: { parkingLot: 1 },
          $set: { parkingType: parkingTypeId }
        });

        console.log(`✅ Migrated booking ${booking._id} from parkingLot ${booking.parkingLot} to parkingType ${parkingTypeId}`);
      } catch (error) {
        console.error(`Error migrating booking ${booking._id}:`, error);
      }
    }

    console.log('✅ Booking migration completed');

  } catch (error) {
    console.error('Error during booking migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateBookings(); 