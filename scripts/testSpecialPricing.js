const axios = require('axios');

const baseURL = 'http://localhost:5002/api';

async function testSpecialPricing() {
  try {
    console.log('💰 Testing Special Pricing Feature...\n');

    // Test data
    const testData = {
      startDate: '2025-08-01',
      endDate: '2025-08-02',
      price: 1500,
      reason: 'Test Special Price',
      isActive: true
    };

    // 1. Test getting parking types first
    console.log('1. Getting parking types...');
    const parkingTypesResponse = await axios.get(`${baseURL}/admin/parking-types`);
    console.log('✅ Parking types response:', parkingTypesResponse.status);
    
    if (parkingTypesResponse.data.parkingTypes.length === 0) {
      console.log('❌ No parking types found');
      return;
    }

    const parkingType = parkingTypesResponse.data.parkingTypes[0];
    console.log('   Selected parking type:', parkingType.name, `(${parkingType._id})`);

    // 2. Test getting existing special prices
    console.log('\n2. Getting existing special prices...');
    try {
      const specialPricesResponse = await axios.get(`${baseURL}/admin/parking-types/${parkingType._id}/special-prices`);
      console.log('✅ Special prices response:', specialPricesResponse.status);
      console.log('   Existing special prices:', specialPricesResponse.data.specialPrices.length);
    } catch (error) {
      console.log('❌ Error getting special prices:', error.response?.data?.message || error.message);
    }

    // 3. Test adding special price
    console.log('\n3. Adding special price...');
    try {
      const addResponse = await axios.post(`${baseURL}/admin/parking-types/${parkingType._id}/special-prices`, testData);
      console.log('✅ Add special price response:', addResponse.status);
      console.log('   Response:', addResponse.data);
      
      if (addResponse.data.specialPrice) {
        console.log('   Created special price ID:', addResponse.data.specialPrice._id);
      }
    } catch (error) {
      console.log('❌ Error adding special price:', error.response?.data?.message || error.message);
      console.log('   Request data:', testData);
      return;
    }

    // 4. Test getting special prices again
    console.log('\n4. Getting special prices after adding...');
    try {
      const specialPricesResponse2 = await axios.get(`${baseURL}/admin/parking-types/${parkingType._id}/special-prices`);
      console.log('✅ Special prices response:', specialPricesResponse2.status);
      console.log('   Special prices count:', specialPricesResponse2.data.specialPrices.length);
      
      if (specialPricesResponse2.data.specialPrices.length > 0) {
        const latestSpecialPrice = specialPricesResponse2.data.specialPrices[specialPricesResponse2.data.specialPrices.length - 1];
        console.log('   Latest special price:', {
          id: latestSpecialPrice._id,
          startDate: latestSpecialPrice.startDate,
          endDate: latestSpecialPrice.endDate,
          price: latestSpecialPrice.price,
          reason: latestSpecialPrice.reason,
          isActive: latestSpecialPrice.isActive
        });
      }
    } catch (error) {
      console.log('❌ Error getting special prices:', error.response?.data?.message || error.message);
    }

    // 5. Test updating special price
    console.log('\n5. Testing update special price...');
    try {
      const specialPricesResponse3 = await axios.get(`${baseURL}/admin/parking-types/${parkingType._id}/special-prices`);
      if (specialPricesResponse3.data.specialPrices.length > 0) {
        const specialPriceToUpdate = specialPricesResponse3.data.specialPrices[0];
        
        const updateData = {
          price: 2000,
          reason: 'Updated Test Special Price'
        };
        
        const updateResponse = await axios.put(`${baseURL}/admin/parking-types/${parkingType._id}/special-prices/${specialPriceToUpdate._id}`, updateData);
        console.log('✅ Update special price response:', updateResponse.status);
        console.log('   Updated special price:', updateResponse.data.specialPrice);
      }
    } catch (error) {
      console.log('❌ Error updating special price:', error.response?.data?.message || error.message);
    }

    // 6. Test deleting special price
    console.log('\n6. Testing delete special price...');
    try {
      const specialPricesResponse4 = await axios.get(`${baseURL}/admin/parking-types/${parkingType._id}/special-prices`);
      if (specialPricesResponse4.data.specialPrices.length > 0) {
        const specialPriceToDelete = specialPricesResponse4.data.specialPrices[0];
        
        const deleteResponse = await axios.delete(`${baseURL}/admin/parking-types/${parkingType._id}/special-prices/${specialPriceToDelete._id}`);
        console.log('✅ Delete special price response:', deleteResponse.status);
        console.log('   Delete message:', deleteResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Error deleting special price:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Special pricing test completed!');

  } catch (error) {
    console.error('❌ Error in special pricing test:', error.response?.data || error.message);
  }
}

testSpecialPricing(); 