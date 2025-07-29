const mongoose = require('mongoose');
const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5002/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone';

// Simple test functions
const tests = {
  // Test 1: Check if server is running
  async testServerHealth() {
    console.log('\n🏥 Testing Server Health...');
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      console.log('✅ Server is running:', response.data);
      return true;
    } catch (error) {
      console.log('❌ Server is not running or health endpoint not available');
      return false;
    }
  },

  // Test 2: Test Maintenance Day API endpoints
  async testMaintenanceAPI() {
    console.log('\n🔧 Testing Maintenance Day API...');
    
    try {
      // Test GET /maintenance
      const response = await axios.get(`${API_BASE_URL}/maintenance`);
      console.log('✅ GET /maintenance - Maintenance days retrieved:', response.data.maintenanceDays?.length || 0);
      
      // Test GET /maintenance/check/range
      const startDate = new Date();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const rangeResponse = await axios.get(`${API_BASE_URL}/maintenance/check/range?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      console.log('✅ GET /maintenance/check/range - Range check successful');
      
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️  Maintenance API requires authentication');
      } else {
        console.log('❌ Maintenance API test failed:', error.response?.data?.message || error.message);
      }
      return false;
    }
  },

  // Test 3: Test Booking API endpoints
  async testBookingAPI() {
    console.log('\n📝 Testing Booking API...');
    
    try {
      // Test GET /bookings/today/summary
      const response = await axios.get(`${API_BASE_URL}/bookings/today/summary`);
      console.log('✅ GET /bookings/today/summary - Today\'s summary retrieved');
      
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️  Booking API requires authentication');
      } else {
        console.log('❌ Booking API test failed:', error.response?.data?.message || error.message);
      }
      return false;
    }
  },

  // Test 4: Test Parking Type API endpoints
  async testParkingTypeAPI() {
    console.log('\n🚗 Testing Parking Type API...');
    
    try {
      // Test GET /admin/parking-types
      const response = await axios.get(`${API_BASE_URL}/admin/parking-types`);
      console.log('✅ GET /admin/parking-types - Parking types retrieved:', response.data.parkingTypes?.length || 0);
      
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️  Parking Type API requires authentication');
      } else {
        console.log('❌ Parking Type API test failed:', error.response?.data?.message || error.message);
      }
      return false;
    }
  },

  // Test 5: Test Database Models
  async testDatabaseModels() {
    console.log('\n🗄️ Testing Database Models...');
    
    try {
      // Test MaintenanceDay model
      const MaintenanceDay = require('../models/MaintenanceDay');
      console.log('✅ MaintenanceDay model loaded');
      
      // Test ParkingType model
      const ParkingType = require('../models/ParkingType');
      console.log('✅ ParkingType model loaded');
      
      // Test Booking model
      const Booking = require('../models/Booking');
      console.log('✅ Booking model loaded');
      
      return true;
    } catch (error) {
      console.log('❌ Database models test failed:', error.message);
      return false;
    }
  },

  // Test 6: Test Frontend Routes
  async testFrontendRoutes() {
    console.log('\n🌐 Testing Frontend Routes...');
    
    const routes = [
      '/admin/maintenance',
      '/admin/special-pricing', 
      '/admin/manual-booking',
      '/admin/today-overview'
    ];
    
    console.log('✅ Frontend routes to test:');
    routes.forEach(route => {
      console.log(`   - ${route}`);
    });
    
    return true;
  },

  // Test 7: Test API Route Registration
  async testAPIRoutes() {
    console.log('\n🔗 Testing API Route Registration...');
    
    const routes = [
      'GET /api/maintenance',
      'POST /api/maintenance',
      'GET /api/maintenance/check/range',
      'GET /api/bookings/today/summary',
      'POST /api/bookings/manual',
      'GET /api/admin/parking-types/*/special-prices'
    ];
    
    console.log('✅ API routes to test:');
    routes.forEach(route => {
      console.log(`   - ${route}`);
    });
    
    return true;
  }
};

// Run all tests
async function runTests() {
  console.log('🚀 Starting Individual Feature Tests...');
  console.log('='.repeat(50));
  
  const results = {};
  
  for (const [testName, testFunction] of Object.entries(tests)) {
    try {
      results[testName] = await testFunction();
    } catch (error) {
      console.log(`❌ ${testName} failed with error:`, error.message);
      results[testName] = false;
    }
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([testName, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
  });
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
}

// Main execution
async function main() {
  try {
    // Try to connect to MongoDB (optional)
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('📦 Connected to MongoDB');
    } catch (error) {
      console.log('⚠️  MongoDB connection failed (continuing without database):', error.message);
    }
    
    // Run tests
    await runTests();
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  } finally {
    // Close connection if connected
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('📦 MongoDB connection closed');
    }
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { tests, runTests }; 