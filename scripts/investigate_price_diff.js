const mongoose = require('mongoose');
const ParkingType = require('../models/ParkingType');
const SystemSettings = require('../models/SystemSettings');
require('dotenv').config({ path: 'backend/.env' });

const investigate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('✅ Connected to MongoDB');

    // 1. Find the Parking Type likely used in the screenshot
    // Name in screenshot: "Độc lập xe hầm ( Ngoài trời )" or similar.
    // Let's search for "Ngoài trời" (Outdoor) or just list all active ones.
    const parkingTypes = await ParkingType.find({});
    
    console.log(`\nFound ${parkingTypes.length} total parking types.`);
    
    parkingTypes.forEach(pt => {
        console.log(`\nID: ${pt._id}`);
        console.log(`Name: ${pt.name}`);
        console.log(`PricePerDay: ${pt.pricePerDay}`);
        console.log(`SpecialPrices: ${pt.specialPrices.length}`);
        if(pt.specialPrices.length > 0) {
            console.log(`Sample Special Price: ${pt.specialPrices[0].price} (${pt.specialPrices[0].startDate})`);
        }
    });

    const targetType = parkingTypes.find(pt => pt.name.includes("Ngoài trời") || pt.name.includes("Outdoor") || pt.name.includes("Independent") || pt.description.includes("Outdoor"));


    if (!targetType) {
        console.log("❌ No parking type found to investigate.");
        return;
    }

    console.log('\n--- Investigating Parking Type ---');
    console.log(`Name: ${targetType.name}`);
    console.log(`Base Price Per Day: ${targetType.pricePerDay}`);
    
    console.log('\n--- Special Prices for Jan 2026 ---');
    if (targetType.specialPrices && targetType.specialPrices.length > 0) {
        targetType.specialPrices.forEach(sp => {
            console.log(`  Date: ${new Date(sp.startDate).toISOString().slice(0,10)} to ${new Date(sp.endDate).toISOString().slice(0,10)} -> Price: ${sp.price}`);
        });
    } else {
        console.log("  No special prices set.");
    }

    // 2. Check System Settings again
    const settings = await SystemSettings.findOne();
    console.log('\n--- System Settings ---');
    console.log(`Cutoff Hour: ${settings.cutoffHour}`);
    console.log(`Enable Cutoff: ${settings.enableCutoffHour}`);

    // 3. Re-run calculation with THIS exact parking type and dates
    const checkInDate1 = new Date('2026-01-15T03:25:00'); // Screenshot 1
    const checkInDate2 = new Date('2026-01-15T07:07:00'); // Screenshot 2
    const checkOutDate_Common = new Date('2026-01-24T22:20:00'); // Approx end time (Screenshot 1 says 22:20, Screenshot 2 says 18:20... Wait.
    // Screenshot 1: Out 2026/01/24 22:20
    // Screenshot 2: Out 2026/01/24 18:20
    // Note: The specific checkout time usually doesn't matter for "Day" count unless it crosses a boundary, BUT
    // the model logic for 'durationDays' uses: Math.ceil((endDateOnly - startDateOnly) / (1000 * 60 * 60 * 24))
    // It normalizes to start of day (00:00). So only the DATE matters for the main duration count.
    
    // HOWEVER, there is a diff in checkout time (22:20 vs 18:20). 
    // And Check-in (03:25 vs 07:07).
    
    // Case 1
    console.log(`\n--- Simulating Case 1 ---`);
    console.log(`In: ${checkInDate1.toLocaleString('vi-VN')}`);
    console.log(`Out: ${new Date('2026-01-24T22:20:00').toLocaleString('vi-VN')}`);
    const price1 = await targetType.calculatePriceForRange(
        checkInDate1, 
        new Date('2026-01-24T22:20:00'),
        settings.cutoffHour,
        settings.enableCutoffHour
    );
    console.log(`Total: ${price1.totalPrice}`);
    console.log(`Days to charge: ${price1.daysToCharge}`);
    console.log(`Daily Breakdown (First 2 days):`);
    price1.dailyPrices.slice(0, 2).forEach(dp => console.log(`  ${dp.date.toLocaleDateString()}: ${dp.price} (${dp.reason})`));

    // Case 2
    console.log(`\n--- Simulating Case 2 ---`);
    console.log(`In: ${checkInDate2.toLocaleString('vi-VN')}`);
    console.log(`Out: ${new Date('2026-01-24T18:20:00').toLocaleString('vi-VN')}`);
    const price2 = await targetType.calculatePriceForRange(
        checkInDate2, 
        new Date('2026-01-24T18:20:00'),
        settings.cutoffHour,
        settings.enableCutoffHour
    );
    console.log(`Total: ${price2.totalPrice}`);
    console.log(`Days to charge: ${price2.daysToCharge}`);
    console.log(`Daily Breakdown (First 2 days):`);
    price2.dailyPrices.slice(0, 2).forEach(dp => console.log(`  ${dp.date.toLocaleDateString()}: ${dp.price} (${dp.reason})`));

    console.log(`\nDifference detected: ${price1.totalPrice - price2.totalPrice}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

investigate();
