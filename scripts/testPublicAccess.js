#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5002/api';

// Test data
const testData = {
  parkingTypeId: '',
  bookingData: {
    parkingTypeId: '',
    checkInTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    checkOutTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    driverName: 'Nguyễn Văn Test',
    phone: '0123456789',
    email: 'test@example.com',
    licensePlate: '30A-12345',
    passengerCount: 1,
    luggageCount: 0,
    addonServices: [],
    termsAccepted: true
  },
  searchData: {
    phone: '0123456789',
    licensePlate: '30A-12345'
  }
};

class PublicAccessTester {
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

  // Test 1: Get parking types (for booking page)
  async testGetParkingTypes() {
    console.log('\n🏢 Testing Get Parking Types (Booking Page)...');
    
    try {
      const result = await this.makeRequest('GET', '/parking');
      console.log('✅ Get parking types successful');
      console.log(`   Found ${result.parkingTypes?.length || 0} parking types`);
      
      if (result.parkingTypes && result.parkingTypes.length > 0) {
        testData.parkingTypeId = result.parkingTypes[0]._id;
        testData.bookingData.parkingTypeId = result.parkingTypes[0]._id;
        console.log(`   Using parking type ID: ${testData.parkingTypeId}`);
      }
      
      this.results.passed++;
    } catch (error) {
      console.log('❌ Get parking types failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 2: Get system settings (for booking page)
  async testGetSystemSettings() {
    console.log('\n⚙️ Testing Get System Settings (Booking Page)...');
    
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

  // Test 3: Get addon services (for booking page)
  async testGetAddonServices() {
    console.log('\n🔧 Testing Get Addon Services (Booking Page)...');
    
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

  // Test 4: Check availability (for booking page)
  async testCheckAvailability() {
    console.log('\n🔍 Testing Check Availability (Booking Page)...');
    
    if (!testData.parkingTypeId) {
      console.log('⚠️ Skipping - no parking type ID available');
      this.results.failed++;
      this.results.total++;
      return;
    }
    
    try {
      const result = await this.makeRequest('POST', '/bookings/check-availability', {
        parkingTypeId: testData.parkingTypeId,
        checkInTime: testData.bookingData.checkInTime,
        checkOutTime: testData.bookingData.checkOutTime
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

  // Test 5: Create booking (for booking page)
  async testCreateBooking() {
    console.log('\n📝 Testing Create Booking (Booking Page)...');
    
    if (!testData.parkingTypeId) {
      console.log('⚠️ Skipping - no parking type ID available');
      this.results.failed++;
      this.results.total++;
      return;
    }
    
    try {
      const result = await this.makeRequest('POST', '/bookings', testData.bookingData);
      console.log('✅ Create booking successful');
      console.log(`   Booking ID: ${result.booking._id}`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Create booking failed');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 6: Search bookings by phone (for lookup page)
  async testSearchByPhone() {
    console.log('\n📱 Testing Search by Phone (Lookup Page)...');
    
    try {
      const result = await this.makeRequest('GET', `/bookings/search?phone=${testData.searchData.phone}`);
      console.log('✅ Search by phone successful');
      console.log(`   Found ${result.bookings?.length || 0} bookings`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Search by phone failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 7: Search bookings by license plate (for lookup page)
  async testSearchByLicensePlate() {
    console.log('\n🚙 Testing Search by License Plate (Lookup Page)...');
    
    try {
      const result = await this.makeRequest('GET', `/bookings/search?licensePlate=${testData.searchData.licensePlate}`);
      console.log('✅ Search by license plate successful');
      console.log(`   Found ${result.bookings?.length || 0} bookings`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Search by license plate failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 8: Get booking details (for lookup page)
  async testGetBookingDetails() {
    console.log('\n📋 Testing Get Booking Details (Lookup Page)...');
    
    try {
      // First search for a booking
      const searchResult = await this.makeRequest('GET', `/bookings/search?phone=${testData.searchData.phone}`);
      
      if (searchResult.bookings && searchResult.bookings.length > 0) {
        const bookingId = searchResult.bookings[0]._id;
        const result = await this.makeRequest('GET', `/bookings/${bookingId}`);
        console.log('✅ Get booking details successful');
        console.log(`   Booking ID: ${result.booking._id}`);
        this.results.passed++;
      } else {
        console.log('⚠️ No bookings found to test details');
        this.results.passed++;
      }
    } catch (error) {
      console.log('❌ Get booking details failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 9: Apply discount code (for booking page)
  async testApplyDiscount() {
    console.log('\n🎫 Testing Apply Discount Code (Booking Page)...');
    
    if (!testData.parkingTypeId) {
      console.log('⚠️ Skipping - no parking type ID available');
      this.results.failed++;
      this.results.total++;
      return;
    }
    
    try {
      const result = await this.makeRequest('POST', '/bookings/apply-discount', {
        discountCode: 'TEST123',
        parkingTypeId: testData.parkingTypeId,
        checkInTime: testData.bookingData.checkInTime,
        checkOutTime: testData.bookingData.checkOutTime,
        addonServices: [],
        isVIP: false,
        email: testData.bookingData.email
      });
      
      if (result.success === false) {
        console.log('✅ Apply discount correctly rejected invalid code');
        this.results.passed++;
      } else {
        console.log('✅ Apply discount successful');
        this.results.passed++;
      }
    } catch (error) {
      console.log('❌ Apply discount failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 10: Calculate price (for booking page)
  async testCalculatePrice() {
    console.log('\n💰 Testing Calculate Price (Booking Page)...');
    
    if (!testData.parkingTypeId) {
      console.log('⚠️ Skipping - no parking type ID available');
      this.results.failed++;
      this.results.total++;
      return;
    }
    
    try {
      const result = await this.makeRequest('POST', '/bookings/calculate-price', {
        parkingTypeId: testData.parkingTypeId,
        checkInTime: testData.bookingData.checkInTime,
        checkOutTime: testData.bookingData.checkOutTime,
        addonServices: [],
        isVIP: false
      });
      console.log('✅ Calculate price successful');
      console.log(`   Total Price: ${result.totalPrice}`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Calculate price failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Run all tests
  async runAllTests() {
    console.log('🌐 Testing Public Access - Booking & Lookup Pages');
    console.log('='.repeat(60));

    try {
      // Booking page tests
      await this.testGetParkingTypes();
      await this.testGetSystemSettings();
      await this.testGetAddonServices();
      await this.testCheckAvailability();
      await this.testCalculatePrice();
      await this.testApplyDiscount();
      await this.testCreateBooking();

      // Lookup page tests
      await this.testSearchByPhone();
      await this.testSearchByLicensePlate();
      await this.testGetBookingDetails();

      console.log('\n📊 Test Results Summary:');
      console.log('='.repeat(60));
      console.log(`Total Tests: ${this.results.total}`);
      console.log(`Passed: ${this.results.passed}`);
      console.log(`Failed: ${this.results.failed}`);

      if (this.results.failed === 0) {
        console.log('\n🎉 All public access tests passed!');
        console.log('✅ Booking page works without authentication');
        console.log('✅ Lookup page works without authentication');
        console.log('✅ All required APIs are publicly accessible');
      } else {
        console.log(`\n⚠️ ${this.results.failed} test(s) failed`);
        console.log('❌ Some APIs may require authentication');
      }

    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
    }
  }
}

// Main execution
async function main() {
  try {
    const tester = new PublicAccessTester();
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

module.exports = PublicAccessTester; 