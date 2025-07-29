const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function createMaintenanceDay() {
  console.log('🔧 Creating Maintenance Day...\n');

  try {
    // First, get parking types
    console.log('1. Getting parking types...');
    const parkingTypesResponse = await axios.get(`${API_BASE_URL}/parking`);
    const parkingTypes = parkingTypesResponse.data.parkingTypes;
    
    if (parkingTypes.length === 0) {
      console.log('❌ No parking types found');
      return;
    }

    console.log(`✅ Found ${parkingTypes.length} parking types`);
    const parkingType = parkingTypes[0]; // Use first parking type
    console.log(`   Using: ${parkingType.name} (${parkingType._id})`);

    // Create maintenance day for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    console.log(`2. Creating maintenance day for: ${tomorrow.toLocaleDateString('vi-VN')}`);

    // Note: This would require admin authentication
    // For now, let's just test the maintenance check logic
    console.log('3. Testing maintenance check for the date range...');
    
    const startDate = tomorrow;
    const endDate = new Date(tomorrow);
    endDate.setDate(endDate.getDate() + 1);

    const maintenanceCheck = await axios.get(`${API_BASE_URL}/maintenance/check/range`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });

    console.log('✅ Maintenance check successful');
    console.log(`   Found ${maintenanceCheck.data.maintenanceDays?.length || 0} maintenance days`);

    // Test availability check with maintenance
    console.log('4. Testing availability check...');
    
    const availabilityCheck = await axios.post(`${API_BASE_URL}/bookings/check-availability`, {
      parkingTypeId: parkingType._id,
      checkInTime: startDate.toISOString(),
      checkOutTime: endDate.toISOString()
    });

    console.log('✅ Availability check successful');
    console.log(`   Success: ${availabilityCheck.data.success}`);
    console.log(`   Message: ${availabilityCheck.data.message}`);
    
    if (availabilityCheck.data.maintenanceDays) {
      console.log(`   Maintenance days: ${availabilityCheck.data.maintenanceDays.length}`);
    }

    console.log('\n💡 To create a maintenance day, you need to:');
    console.log('   1. Login to admin panel');
    console.log('   2. Go to Maintenance page');
    console.log('   3. Create a maintenance day for tomorrow');
    console.log('   4. Select the parking type to affect');
    console.log('   5. Save the maintenance day');
    console.log('\n   Then test the booking flow again.');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

createMaintenanceDay(); 