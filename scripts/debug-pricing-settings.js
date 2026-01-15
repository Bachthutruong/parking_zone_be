const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');
require('dotenv').config({ path: 'backend/.env' });

const debugSettings = async () => {
  try {
    if (!process.env.MONGODB_URI) {
        // Fallback or error if env not loaded usually, but usually run from root where .env is
        console.log("No MONGODB_URI found, assuming standard local if needed or erroring.");
    }
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('✅ Connected to MongoDB');

    const settings = await SystemSettings.findOne();
    if (!settings) {
        console.log("❌ No SystemSettings found!");
        return;
    }

    console.log('--- Current System Settings in DB ---');
    console.log(`enableCutoffHour: ${settings.enableCutoffHour}`);
    console.log(`cutoffHour: ${settings.cutoffHour} (Type: ${typeof settings.cutoffHour})`);
    
    // Test Values from User Issue
    const cutoffVal = Number(settings.cutoffHour);
    const enabled = settings.enableCutoffHour;

    const checkInTime1 = 3 * 60 + 25; // 03:25 -> 205 minutes
    const checkInTime2 = 7 * 60 + 7;  // 07:07 -> 427 minutes
    const cutoffMinutes = cutoffVal * 60;

    console.log('\n--- Simulation Logic Check ---');
    console.log(`Cutoff Time in Minutes: ${cutoffMinutes} (${cutoffVal}:00)`);

    console.log('\n--- Actual Model Method Execution ---');
    const ParkingType = require('../models/ParkingType');
    
    // Create a dummy parking type for calculation
    const dummyParkingType = new ParkingType({
      name: 'Test',
      code: 'TEST',
      totalSpaces: 100,
      availableSpaces: 100,
      pricePerDay: 100, // Assuming 100 diff per day based on user report
      specialPrices: []
    });

    // We need to mock SystemSettings.getSettings inside the method or rely on it fetching from DB
    // The method inside uses require('./SystemSettings') so it should work if we are in same process
    
    const checkInDate1 = new Date('2026-01-15T03:25:00');
    const checkOutDate1 = new Date('2026-01-24T22:20:00'); // 10 days roughly
    
    const checkInDate2 = new Date('2026-01-15T07:07:00');
    const checkOutDate2 = new Date('2026-01-24T18:20:00'); 

    // Calculate Price 1
    console.log(`\nCalculating for Check-In: ${checkInDate1.toISOString()}`);
    const price1 = await dummyParkingType.calculatePriceForRange(checkInDate1, checkOutDate1);
    console.log(`Price 1 Total: ${price1.totalPrice}`);
    console.log(`Charge First Day? ${price1.chargeFirstDay}`);

    // Calculate Price 2
    console.log(`\nCalculating for Check-In: ${checkInDate2.toISOString()}`);
    const price2 = await dummyParkingType.calculatePriceForRange(checkInDate2, checkOutDate2);
    console.log(`Price 2 Total: ${price2.totalPrice}`);
    console.log(`Charge First Day? ${price2.chargeFirstDay}`);


  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

debugSettings();
