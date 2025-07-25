const axios = require('axios');

async function testCORS() {
  const testUrls = [
    'https://parking-zone-fe-t3nr.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  const backendUrl = 'https://parking-zone-be.onrender.com';

  console.log('🧪 Testing CORS configuration (same for all environments)...\n');

  for (const origin of testUrls) {
    try {
      console.log(`Testing origin: ${origin}`);
      
      const response = await axios.get(`${backendUrl}/api/health`, {
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      console.log(`✅ Success: ${response.status}`);
      console.log(`Response:`, response.data);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log(`Headers:`, error.response.headers);
      }
    }
    
    console.log('---\n');
  }
}

testCORS().catch(console.error); 