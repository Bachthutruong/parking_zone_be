#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5002/api';

// Test data
const testData = {
  adminUser: {
    email: 'admin@test.com',
    password: 'admin123'
  },
  parkingTypeId: '',
  maintenanceDay: {
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    reason: 'Bảo trì hệ thống',
    description: 'Bảo trì định kỳ hệ thống điện và camera',
    affectedParkingTypes: []
  },
  bookingData: {
    checkInTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Same as maintenance day
    checkOutTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    driverName: 'Nguyễn Văn Test',
    phone: '0123456789',
    email: 'test@example.com',
    licensePlate: '30A-12345',
    passengerCount: 1,
    luggageCount: 0,
    addonServices: [],
    termsAccepted: true
  }
};

class MaintenanceIntegrationTester {
  constructor() {
    this.adminToken = null;
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  // Helper method to make authenticated requests
  async makeRequest(method, endpoint, data = null, token = null) {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
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

  // Test 1: Admin login
  async testAdminLogin() {
    console.log('\n🔐 Testing Admin Login...');
    
    try {
      const result = await this.makeRequest('POST', '/auth/login', testData.adminUser);
      this.adminToken = result.token;
      console.log('✅ Admin login successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Admin login failed - may need to create admin user first');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 2: Get parking types
  async testGetParkingTypes() {
    console.log('\n🏢 Testing Get Parking Types...');
    
    try {
      const result = await this.makeRequest('GET', '/parking');
      console.log('✅ Get parking types successful');
      console.log(`   Found ${result.parkingTypes?.length || 0} parking types`);
      
      if (result.parkingTypes && result.parkingTypes.length > 0) {
        testData.parkingTypeId = result.parkingTypes[0]._id;
        testData.maintenanceDay.affectedParkingTypes = [testData.parkingTypeId];
        testData.bookingData.parkingTypeId = testData.parkingTypeId;
        console.log(`   Using parking type ID: ${testData.parkingTypeId}`);
      }
      
      this.results.passed++;
    } catch (error) {
      console.log('❌ Get parking types failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 3: Create maintenance day
  async testCreateMaintenanceDay() {
    console.log('\n🔧 Testing Create Maintenance Day...');
    
    if (!this.adminToken) {
      console.log('⚠️ Skipping - no admin token');
      this.results.failed++;
      this.results.total++;
      return;
    }
    
    try {
      const result = await this.makeRequest('POST', '/maintenance', testData.maintenanceDay, this.adminToken);
      console.log('✅ Create maintenance day successful');
      console.log(`   Maintenance ID: ${result.maintenanceDay._id}`);
      console.log(`   Date: ${testData.maintenanceDay.date}`);
      console.log(`   Reason: ${testData.maintenanceDay.reason}`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Create maintenance day failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 4: Check maintenance days for date range
  async testCheckMaintenanceRange() {
    console.log('\n📅 Testing Check Maintenance Range...');
    
    if (!this.adminToken) {
      console.log('⚠️ Skipping - no admin token');
      this.results.failed++;
      this.results.total++;
      return;
    }
    
    try {
      const startDate = new Date(testData.maintenanceDay.date);
      const endDate = new Date(testData.maintenanceDay.date);
      endDate.setDate(endDate.getDate() + 1);
      
      const result = await this.makeRequest('GET', `/maintenance/check/range?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, null, this.adminToken);
      console.log('✅ Check maintenance range successful');
      console.log(`   Found ${result.maintenanceDays?.length || 0} maintenance days`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Check maintenance range failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 5: Try to create booking during maintenance (should fail)
  async testBookingDuringMaintenance() {
    console.log('\n🚫 Testing Booking During Maintenance...');
    
    try {
      const result = await this.makeRequest('POST', '/bookings', testData.bookingData);
      console.log('❌ Booking during maintenance should have failed');
      this.results.failed++;
    } catch (error) {
      if (error.response?.data?.message?.includes('bảo trì') || error.response?.data?.message?.includes('maintenance')) {
        console.log('✅ Booking correctly blocked during maintenance');
        this.results.passed++;
      } else {
        console.log('⚠️ Booking failed but not due to maintenance');
        console.log(`   Error: ${error.response?.data?.message}`);
        this.results.failed++;
      }
    }
    this.results.total++;
  }

  // Test 6: Check availability during maintenance (should show unavailable)
  async testAvailabilityDuringMaintenance() {
    console.log('\n🔍 Testing Availability During Maintenance...');
    
    try {
      const result = await this.makeRequest('POST', '/bookings/check-availability', {
        parkingTypeId: testData.parkingTypeId,
        checkInTime: testData.bookingData.checkInTime,
        checkOutTime: testData.bookingData.checkOutTime
      });
      
      if (result.success === false) {
        console.log('✅ Availability correctly shows unavailable during maintenance');
        this.results.passed++;
      } else {
        console.log('❌ Availability should show unavailable during maintenance');
        this.results.failed++;
      }
    } catch (error) {
      console.log('❌ Check availability failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 7: Try booking on different dates (should succeed)
  async testBookingOnDifferentDates() {
    console.log('\n✅ Testing Booking On Different Dates...');
    
    const differentBookingData = {
      ...testData.bookingData,
      checkInTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      checkOutTime: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString() // 16 days from now
    };
    
    try {
      const result = await this.makeRequest('POST', '/bookings', differentBookingData);
      console.log('✅ Booking on different dates successful');
      console.log(`   Booking ID: ${result.booking._id}`);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Booking on different dates failed');
      console.log(`   Error: ${error.response?.data?.message}`);
      this.results.failed++;
    }
    this.results.total++;
  }

  // Test 8: Cleanup - Delete maintenance day
  async testCleanup() {
    console.log('\n🧹 Testing Cleanup...');
    
    if (!this.adminToken) {
      console.log('⚠️ Skipping - no admin token');
      this.results.failed++;
      this.results.total++;
      return;
    }
    
    try {
      // Get maintenance days first
      const maintenanceDays = await this.makeRequest('GET', '/maintenance', null, this.adminToken);
      
      if (maintenanceDays.maintenanceDays && maintenanceDays.maintenanceDays.length > 0) {
        const maintenanceId = maintenanceDays.maintenanceDays[0]._id;
        await this.makeRequest('DELETE', `/maintenance/${maintenanceId}`, null, this.adminToken);
        console.log('✅ Cleanup successful - maintenance day deleted');
        this.results.passed++;
      } else {
        console.log('⚠️ No maintenance days to clean up');
        this.results.passed++;
      }
    } catch (error) {
      console.log('❌ Cleanup failed');
      this.results.failed++;
    }
    this.results.total++;
  }

  // Run all tests
  async runAllTests() {
    console.log('🔧 Testing Maintenance Day Integration...');
    console.log('='.repeat(60));

    try {
      await this.testAdminLogin();
      await this.testGetParkingTypes();
      await this.testCreateMaintenanceDay();
      await this.testCheckMaintenanceRange();
      await this.testBookingDuringMaintenance();
      await this.testAvailabilityDuringMaintenance();
      await this.testBookingOnDifferentDates();
      await this.testCleanup();

      console.log('\n📊 Test Results Summary:');
      console.log('='.repeat(60));
      console.log(`Total Tests: ${this.results.total}`);
      console.log(`Passed: ${this.results.passed}`);
      console.log(`Failed: ${this.results.failed}`);

      if (this.results.failed === 0) {
        console.log('\n🎉 All maintenance integration tests passed!');
        console.log('✅ Maintenance day system is working correctly');
        console.log('✅ Bookings are properly blocked during maintenance');
        console.log('✅ Availability checks work correctly');
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
    const tester = new MaintenanceIntegrationTester();
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

module.exports = MaintenanceIntegrationTester; 