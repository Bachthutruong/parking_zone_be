const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const ParkingLot = require('../models/ParkingLot');

async function cleanupParkingLots() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all parking lots
    const parkingLots = await ParkingLot.find({});
    
    if (parkingLots.length === 0) {
      console.log('No parking lots to clean up');
      return;
    }

    console.log(`Found ${parkingLots.length} parking lots to clean up:`);
    parkingLots.forEach(lot => {
      console.log(`- ${lot.name} (${lot.type})`);
    });

    // Delete all parking lots
    const result = await ParkingLot.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} parking lots`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupParkingLots(); 