const axios = require('axios');

async function testBookingAPI() {
  try {
    console.log('🧪 Testing Booking API...\n');

    const baseURL = 'http://localhost:5000/api';

    // Test 1: Get all bookings
    console.log('1. Testing get all bookings...');
    try {
      const response = await axios.get(`${baseURL}/admin/bookings`);
      console.log(`   ✅ Success: Found ${response.data.total} bookings`);
      
      if (response.data.bookings && response.data.bookings.length > 0) {
        const sampleBooking = response.data.bookings[0];
        console.log(`   📋 Sample booking: ${sampleBooking.driverName} - Status: ${sampleBooking.status}`);
        
        // Test 2: Update booking status
        console.log('\n2. Testing status update...');
        const newStatus = sampleBooking.status === 'pending' || sampleBooking.status === 'confirmed' ? 'checked-in' : 'pending';
        
        const updateResponse = await axios.put(`${baseURL}/admin/bookings/${sampleBooking._id}/status`, {
          status: newStatus
        });
        
        console.log(`   ✅ Status updated: ${sampleBooking.status} -> ${newStatus}`);
        
        // Test 3: Verify the update
        const verifyResponse = await axios.get(`${baseURL}/admin/bookings`);
        const updatedBooking = verifyResponse.data.bookings.find(b => b._id === sampleBooking._id);
        console.log(`   📊 Verified: ${updatedBooking.driverName} - Status: ${updatedBooking.status}`);
        
      } else {
        console.log('   ⚠️ No bookings found to test');
      }
      
    } catch (error) {
      console.log('   ❌ Error:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 API Test completed!');
    
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

testBookingAPI(); 