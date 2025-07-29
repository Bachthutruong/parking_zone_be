const mongoose = require('mongoose');
const MaintenanceDay = require('../models/MaintenanceDay');
const ParkingType = require('../models/ParkingType');
const User = require('../models/User');

async function createMaintenanceDayTomorrow() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/parking_zone', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Find an admin user
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found');
      return;
    }

    // Find parking types
    const parkingTypes = await ParkingType.find({ isActive: true });
    if (parkingTypes.length === 0) {
      console.log('❌ No parking types found');
      return;
    }

    // Create maintenance day for tomorrow
    const maintenanceDay = await MaintenanceDay.create({
      date: tomorrow,
      reason: 'Bảo trì hệ thống',
      description: 'Bảo trì định kỳ hệ thống',
      isActive: true,
      affectedParkingTypes: parkingTypes.map(pt => pt._id),
      createdBy: adminUser._id
    });

    console.log('✅ Maintenance day created for tomorrow:', tomorrow.toLocaleDateString('vi-VN'));
    console.log('   ID:', maintenanceDay._id);
    console.log('   Reason:', maintenanceDay.reason);
    console.log('   Affected parking types:', maintenanceDay.affectedParkingTypes.length);

    // Test the maintenance check
    console.log('\n🔧 Testing maintenance check...');
    const maintenanceDays = await MaintenanceDay.getMaintenanceDaysForRange(tomorrow, tomorrow);
    console.log('   Found maintenance days:', maintenanceDays.length);
    
    if (maintenanceDays.length > 0) {
      console.log('   ✅ Maintenance day found for tomorrow');
      maintenanceDays.forEach((md, index) => {
        console.log(`     Day ${index + 1}: ${new Date(md.date).toLocaleDateString('vi-VN')} - ${md.reason}`);
      });
    } else {
      console.log('   ❌ No maintenance day found for tomorrow');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

createMaintenanceDayTomorrow(); 