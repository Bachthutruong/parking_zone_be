const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const ParkingType = require('../models/ParkingType');
const Booking = require('../models/Booking');

async function migrateToParkingType() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if there are any existing bookings with parkingLot reference
    const bookingsWithParkingLot = await Booking.find({ parkingLot: { $exists: true } });
    
    if (bookingsWithParkingLot.length > 0) {
      console.log(`Found ${bookingsWithParkingLot.length} bookings with old parkingLot reference`);
      console.log('Please migrate these bookings first before removing ParkingLot model');
      return;
    }

    // Check if ParkingLot collection exists and has any documents
    const collections = await mongoose.connection.db.listCollections().toArray();
    const parkingLotCollection = collections.find(col => col.name === 'parkinglots');
    
    if (parkingLotCollection) {
      const parkingLots = await mongoose.connection.db.collection('parkinglots').find({}).toArray();
      
      if (parkingLots.length > 0) {
        console.log(`Found ${parkingLots.length} parking lots in the old collection`);
        console.log('Please migrate these parking lots to ParkingType first');
        return;
      }

      // Drop the ParkingLot collection
      await mongoose.connection.db.dropCollection('parkinglots');
      console.log('✅ Dropped ParkingLot collection');
    } else {
      console.log('✅ ParkingLot collection does not exist');
    }

    // Update SystemSettings to remove parkingLotTypes (since we now use ParkingType model)
    const SystemSettings = require('../models/SystemSettings');
    await SystemSettings.updateMany({}, {
      $unset: { parkingLotTypes: 1, defaultParkingLotTypes: 1 }
    });
    console.log('✅ Removed parkingLotTypes from SystemSettings');

    console.log('✅ Migration completed successfully');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateToParkingType(); 