const mongoose = require('mongoose');
const MaintenanceDay = require('../models/MaintenanceDay');

async function checkMaintenanceDays() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    // Get all maintenance days
    const maintenanceDays = await MaintenanceDay.find({})
      .populate('affectedParkingTypes', 'name code')
      .populate('createdBy', 'name email')
      .sort({ date: 1 });

    console.log(`📋 Found ${maintenanceDays.length} maintenance days:`);
    
    if (maintenanceDays.length === 0) {
      console.log('❌ No maintenance days found in database');
      console.log('💡 To create a maintenance day, run: node scripts/createMaintenanceDay.js');
    } else {
      maintenanceDays.forEach((maintenance, index) => {
        console.log(`\n${index + 1}. Maintenance Day:`);
        console.log(`   Date: ${maintenance.date.toLocaleDateString('vi-VN')}`);
        console.log(`   Reason: ${maintenance.reason}`);
        console.log(`   Description: ${maintenance.description}`);
        console.log(`   Is Active: ${maintenance.isActive}`);
        console.log(`   Affected Parking Types: ${maintenance.affectedParkingTypes.map(pt => pt.name).join(', ')}`);
        console.log(`   Created By: ${maintenance.createdBy.name}`);
      });
    }

    // Check for maintenance days in the next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingMaintenance = await MaintenanceDay.find({
      date: {
        $gte: now,
        $lte: thirtyDaysFromNow
      },
      isActive: true
    }).populate('affectedParkingTypes', 'name code');

    console.log(`\n📅 Upcoming maintenance days (next 30 days): ${upcomingMaintenance.length}`);
    upcomingMaintenance.forEach((maintenance, index) => {
      console.log(`   ${index + 1}. ${maintenance.date.toLocaleDateString('vi-VN')} - ${maintenance.reason}`);
    });

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error checking maintenance days:', error);
    await mongoose.disconnect();
  }
}

checkMaintenanceDays(); 