const mongoose = require('mongoose');
const MaintenanceDay = require('../models/MaintenanceDay');
const ParkingType = require('../models/ParkingType');
const User = require('../models/User');
require('dotenv').config();

async function initMaintenanceDays() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('✅ Connected to MongoDB');

    // Get admin user
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      return;
    }

    // Get parking types
    const parkingTypes = await ParkingType.find({ isActive: true });
    if (parkingTypes.length === 0) {
      console.log('❌ No parking types found. Please create parking types first.');
      return;
    }

    // Sample maintenance days
    const sampleMaintenanceDays = [
      {
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        reason: 'Bảo trì hệ thống điện',
        description: 'Bảo trì định kỳ hệ thống điện và chiếu sáng',
        affectedParkingTypes: parkingTypes.map(pt => pt._id),
        createdBy: adminUser._id
      },
      {
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        reason: 'Sửa chữa hệ thống camera',
        description: 'Nâng cấp và sửa chữa hệ thống camera giám sát',
        affectedParkingTypes: parkingTypes.slice(0, 2).map(pt => pt._id), // Only first 2 parking types
        createdBy: adminUser._id
      },
      {
        date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        reason: 'Bảo trì hệ thống thông gió',
        description: 'Bảo trì hệ thống thông gió và điều hòa',
        affectedParkingTypes: parkingTypes.filter(pt => pt.type === 'indoor').map(pt => pt._id),
        createdBy: adminUser._id
      }
    ];

    // Clear existing maintenance days
    await MaintenanceDay.deleteMany({});
    console.log('🗑️ Cleared existing maintenance days');

    // Create sample maintenance days
    const createdMaintenanceDays = await MaintenanceDay.insertMany(sampleMaintenanceDays);
    console.log(`✅ Created ${createdMaintenanceDays.length} maintenance days`);

    // Display created maintenance days
    console.log('\n📋 Created Maintenance Days:');
    for (const maintenance of createdMaintenanceDays) {
      console.log(`- ${maintenance.date.toLocaleDateString('vi-VN')}: ${maintenance.reason}`);
    }

    console.log('\n✅ Maintenance days initialization completed!');
  } catch (error) {
    console.error('❌ Error initializing maintenance days:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  initMaintenanceDays();
}

module.exports = initMaintenanceDays; 