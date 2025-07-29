const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testMaintenanceLogic() {
  console.log('🔧 Testing Maintenance Logic...\n');

  try {
    // Test 1: Check maintenance range endpoint
    console.log('1. Testing maintenance check range endpoint...');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Tomorrow
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // 7 days from now

    const rangeResponse = await axios.get(`${API_BASE_URL}/maintenance/check/range`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });

    console.log('✅ Maintenance range check successful');
    console.log(`   Found ${rangeResponse.data.maintenanceDays?.length || 0} maintenance days`);
    console.log(`   Response:`, rangeResponse.data);

    // Test 2: Check availability with maintenance
    console.log('\n2. Testing availability check with maintenance...');
    
    // First, get parking types
    const parkingTypesResponse = await axios.get(`${API_BASE_URL}/parking`);
    const parkingTypes = parkingTypesResponse.data.parkingTypes;
    
    if (parkingTypes.length > 0) {
      const parkingType = parkingTypes[0];
      console.log(`   Using parking type: ${parkingType.name} (${parkingType._id})`);
      
      const availabilityResponse = await axios.post(`${API_BASE_URL}/bookings/check-availability`, {
        parkingTypeId: parkingType._id,
        checkInTime: startDate.toISOString(),
        checkOutTime: endDate.toISOString()
      });

      console.log('✅ Availability check successful');
      console.log(`   Success: ${availabilityResponse.data.success}`);
      console.log(`   Message: ${availabilityResponse.data.message}`);
      
      if (availabilityResponse.data.maintenanceDays) {
        console.log(`   Maintenance days found: ${availabilityResponse.data.maintenanceDays.length}`);
      }
    } else {
      console.log('⚠️ No parking types found');
    }

    console.log('\n🎉 All maintenance tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testMaintenanceLogic(); 