const axios = require('axios');

const API_BASE_URL = 'http://localhost:5002/api';

async function testMaintenanceBooking() {
  console.log('🔧 Testing Maintenance Booking...\n');

  try {
    // Test 1: Get parking types
    console.log('1. Getting parking types...');
    const parkingTypesResponse = await axios.get(`${API_BASE_URL}/parking`);
    const parkingTypes = parkingTypesResponse.data.parkingTypes;
    
    if (parkingTypes.length === 0) {
      console.log('❌ No parking types found');
      return;
    }

    const parkingType = parkingTypes[0];
    console.log(`✅ Using parking type: ${parkingType.name} (${parkingType._id})`);

    // Test 2: Check availability for tomorrow (when maintenance is scheduled)
    console.log('\n2. Testing availability check for tomorrow (maintenance day)...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    try {
      const availabilityResponse = await axios.post(`${API_BASE_URL}/bookings/check-availability`, {
        parkingTypeId: parkingType._id,
        checkInTime: tomorrow.toISOString(),
        checkOutTime: dayAfterTomorrow.toISOString()
      });

      console.log('📊 Availability check result:');
      console.log(`   Success: ${availabilityResponse.data.success}`);
      console.log(`   Message: ${availabilityResponse.data.message}`);
      
      if (availabilityResponse.data.maintenanceDays) {
        console.log(`   Maintenance Days: ${availabilityResponse.data.maintenanceDays.length}`);
        availabilityResponse.data.maintenanceDays.forEach((md, index) => {
          console.log(`     Day ${index + 1}: ${new Date(md.date).toLocaleDateString('vi-VN')} - ${md.reason}`);
        });
      }
      
      if (availabilityResponse.data.success) {
        console.log('⚠️  WARNING: Booking should NOT be available on maintenance day!');
      } else {
        console.log('✅ CORRECT: Booking blocked due to maintenance');
      }

    } catch (error) {
      console.log('❌ Availability check failed:', error.response?.data?.message || error.message);
    }

    // Test 3: Try to create booking for maintenance day
    console.log('\n3. Testing booking creation for maintenance day...');
    
    try {
      const bookingData = {
        parkingTypeId: parkingType._id,
        checkInTime: tomorrow.toISOString(),
        checkOutTime: dayAfterTomorrow.toISOString(),
        driverName: 'Test User',
        phone: '0123456789',
        email: 'test@example.com',
        licensePlate: 'TEST123',
        passengerCount: 1,
        luggageCount: 0,
        addonServices: [],
        discountCode: '',
        termsAccepted: true
      };

      const bookingResponse = await axios.post(`${API_BASE_URL}/bookings`, bookingData);
      console.log('❌ ERROR: Booking should NOT be created on maintenance day!');
      console.log('   Booking created:', bookingResponse.data.booking._id);
      
    } catch (error) {
      console.log('✅ CORRECT: Booking creation blocked due to maintenance');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      
      if (error.response?.data?.maintenanceDays) {
        console.log('   Maintenance details:');
        error.response.data.maintenanceDays.forEach((md, index) => {
          console.log(`     Day ${index + 1}: ${new Date(md.date).toLocaleDateString('vi-VN')} - ${md.reason}`);
        });
      }
    }

    // Test 4: Check availability for future date (no maintenance)
    console.log('\n4. Testing availability check for future date (no maintenance)...');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 8);

    try {
      const futureAvailabilityResponse = await axios.post(`${API_BASE_URL}/bookings/check-availability`, {
        parkingTypeId: parkingType._id,
        checkInTime: futureDate.toISOString(),
        checkOutTime: futureDate2.toISOString()
      });

      console.log('📊 Future availability check result:');
      console.log(`   Success: ${futureAvailabilityResponse.data.success}`);
      console.log(`   Available Spaces: ${futureAvailabilityResponse.data.availableSpaces}`);
      
      if (futureAvailabilityResponse.data.success) {
        console.log('✅ CORRECT: Future booking should be available');
      } else {
        console.log('⚠️  Future booking blocked - check if this is correct');
      }

    } catch (error) {
      console.log('❌ Future availability check failed:', error.response?.data?.message || error.message);
    }

    console.log('\n💡 Maintenance booking test completed!');
    console.log('   - Maintenance days should block booking');
    console.log('   - Future dates should allow booking');
    console.log('   - Check admin panel for maintenance configuration');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testMaintenanceBooking(); 