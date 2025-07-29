const mongoose = require('mongoose');
const MaintenanceDay = require('../models/MaintenanceDay');
const ParkingType = require('../models/ParkingType');
const User = require('../models/User');

async function createMaintenanceDay() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('MongoDB connected successfully');

    // Get admin user
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      return;
    }

    // Get a parking type
    const parkingType = await ParkingType.findOne({ isActive: true });
    if (!parkingType) {
      console.log('❌ No active parking type found. Please create a parking type first.');
      return;
    }

    // Create maintenance day for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const maintenanceDay = await MaintenanceDay.findOneAndUpdate(
      { date: tomorrow },
      {
        date: tomorrow,
        reason: 'Bảo trì định kỳ',
        description: 'Bảo trì hệ thống và vệ sinh bãi đậu xe',
        isActive: true,
        affectedParkingTypes: [parkingType._id],
        createdBy: adminUser._id
      },
      { upsert: true, new: true }
    ).populate('affectedParkingTypes', 'name code')
     .populate('createdBy', 'name email');

    console.log('🎉 Maintenance day created/updated successfully!');
    console.log('📋 Maintenance Day Details:');
    console.log(`   Date: ${maintenanceDay.date.toLocaleDateString('vi-VN')}`);
    console.log(`   Reason: ${maintenanceDay.reason}`);
    console.log(`   Description: ${maintenanceDay.description}`);
    console.log(`   Is Active: ${maintenanceDay.isActive}`);
    console.log(`   Affected Parking Types: ${maintenanceDay.affectedParkingTypes.map(pt => pt.name).join(', ')}`);
    console.log(`   Created By: ${maintenanceDay.createdBy.name}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating maintenance day:', error);
    await mongoose.disconnect();
  }
}

createMaintenanceDay(); 