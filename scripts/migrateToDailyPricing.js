const mongoose = require('mongoose');
const ParkingLot = require('../models/ParkingLot');
require('dotenv').config();

async function migrateToDailyPricing() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('Connected to MongoDB');

    // Get all parking lots
    const parkingLots = await ParkingLot.find({});
    console.log(`Found ${parkingLots.length} parking lots to migrate`);

    for (const lot of parkingLots) {
      console.log(`Migrating parking lot: ${lot.name}`);
      
      // Check if pricePerHour exists and is valid
      let pricePerDay;
      if (lot.pricePerHour && !isNaN(lot.pricePerHour)) {
        // Convert pricePerHour to pricePerDay (assuming 24 hours = 1 day)
        pricePerDay = lot.pricePerHour * 24;
      } else if (lot.basePrice && !isNaN(lot.basePrice)) {
        // Use basePrice as pricePerDay if pricePerHour doesn't exist
        pricePerDay = lot.basePrice;
      } else {
        // Default price if neither exists
        pricePerDay = 2400; // Default 100/hour * 24 hours
      }
      
      console.log(`Current pricePerHour: ${lot.pricePerHour}, basePrice: ${lot.basePrice}, new pricePerDay: ${pricePerDay}`);
      
      // Update the parking lot
      await ParkingLot.findByIdAndUpdate(lot._id, {
        $set: { pricePerDay: pricePerDay },
        $unset: { pricePerHour: 1 }
      });
      
      console.log(`Updated ${lot.name}: ${lot.pricePerHour || 'N/A'}/hour -> ${pricePerDay}/day`);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateToDailyPricing();
}

module.exports = migrateToDailyPricing; 