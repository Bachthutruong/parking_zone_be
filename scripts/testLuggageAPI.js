const axios = require('axios');

const baseURL = 'http://localhost:5002/api';

async function testLuggageAPI() {
  try {
    console.log('🧳 Testing Luggage API...\n');

    // Test system settings endpoint
    console.log('1. Testing system settings endpoint...');
    const settingsResponse = await axios.get(`${baseURL}/system-settings`);
    console.log('Response status:', settingsResponse.status);
    console.log('Response data:', JSON.stringify(settingsResponse.data, null, 2));
    
    if (settingsResponse.data.settings && settingsResponse.data.settings.luggageSettings) {
      console.log('✅ Luggage settings found:', settingsResponse.data.settings.luggageSettings);
    } else {
      console.log('❌ Luggage settings not found in response');
    }

    // Test health endpoint
    console.log('\n2. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('Health status:', healthResponse.status);
    console.log('✅ Backend is running');

  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

testLuggageAPI(); 