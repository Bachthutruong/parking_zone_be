#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5002/api';

// Test data
const testData = {
  parkingTypeId: '', // Will be set dynamically
  checkInTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
  checkOutTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
  phone: '0123456789',
  licensePlate: '30A-12345'
};

class PublicAPITester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  // Helper method to make requests
  async makeRequest(method, endpoint, data = null) {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      },
      ...(data && { data })
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`❌ ${method} ${endpoint} failed:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Test 1: Get available parking types
  async testGetAvailableParkingTypes() {
    console.log('\n🚗 Testing Get Available Parking Types...');
    
    try {
      const result = await this.makeRequest('GET', '/bookings/available-parking-types?type=indoor&checkInTime=2024-01-15T10:00:00.000Z&checkOutTime=2024-01-17T10:00:00.000Z');
      console.log('✅ Get available parking types successful');
      console.log(`   Found ${result.parkingTypes?.length || 0} parking types`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Get available parking types failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 2: Check availability
  async testCheckAvailability() {
    console.log('\n🔍 Testing Check Availability...');
    
    try {
      const result = await this.makeRequest('POST', '/bookings/check-availability', {
        parkingTypeId: testData.parkingTypeId,
        checkInTime: testData.checkInTime,
        checkOutTime: testData.checkOutTime
      });
      console.log('✅ Check availability successful');
      console.log(`   Success: ${result.success}`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Check availability failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 3: Search bookings by phone
  async testSearchByPhone() {
    console.log('\n📱 Testing Search by Phone...');
    
    try {
      const result = await this.makeRequest('GET', `/bookings/search?phone=${testData.phone}`);
      console.log('✅ Search by phone successful');
      console.log(`   Found ${result.bookings?.length || 0} bookings`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Search by phone failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 4: Search bookings by license plate
  async testSearchByLicensePlate() {
    console.log('\n🚙 Testing Search by License Plate...');
    
    try {
      const result = await this.makeRequest('GET', `/bookings/search?licensePlate=${testData.licensePlate}`);
      console.log('✅ Search by license plate successful');
      console.log(`   Found ${result.bookings?.length || 0} bookings`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Search by license plate failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 5: Get system settings
  async testGetSystemSettings() {
    console.log('\n⚙️ Testing Get System Settings...');
    
    try {
      const result = await this.makeRequest('GET', '/system-settings');
      console.log('✅ Get system settings successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Get system settings failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 6: Get parking types
  async testGetParkingTypes() {
    console.log('\n🏢 Testing Get Parking Types...');
    
    try {
      const result = await this.makeRequest('GET', '/parking');
      console.log('✅ Get parking types successful');
      console.log(`   Found ${result.parkingTypes?.length || 0} parking types`);
      
      // Set parking type ID for other tests
      if (result.parkingTypes && result.parkingTypes.length > 0) {
        testData.parkingTypeId = result.parkingTypes[0]._id;
        console.log(`   Using parking type ID: ${testData.parkingTypeId}`);
      }
      
      this.results.passed++;
    } catch (error) {
      console.log('❌ Get parking types failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 7: Get addon services
  async testGetAddonServices() {
    console.log('\n🔧 Testing Get Addon Services...');
    
    try {
      const result = await this.makeRequest('GET', '/addon-services');
      console.log('✅ Get addon services successful');
      console.log(`   Found ${result.addonServices?.length || 0} services`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Get addon services failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Testing Public APIs...');
    console.log('='.repeat(50));

    try {
      await this.testGetSystemSettings();
      await this.testGetParkingTypes();
      await this.testGetAddonServices();
      await this.testGetAvailableParkingTypes();
      await this.testCheckAvailability();
      await this.testSearchByPhone();
      await this.testSearchByLicensePlate();

      console.log('\n📊 Test Results Summary:');
      console.log('='.repeat(50));
      console.log(`Total Tests: ${this.results.total}`);
      console.log(`Passed: ${this.results.passed}`);
      console.log(`Failed: ${this.results.failed}`);

      if (this.results.failed === 0) {
        console.log('\n🎉 All public API tests passed!');
      } else {
        console.log(`\n⚠️ ${this.results.failed} test(s) failed`);
      }

    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
    }
  }
}

// Main execution
async function main() {
  try {
    const tester = new PublicAPITester();
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = PublicAPITester; 