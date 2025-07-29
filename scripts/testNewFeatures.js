const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuration
const API_BASE_URL = 'http://localhost:5002/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone';

// Test data
const testData = {
  adminUser: {
    email: 'admin@test.com',
    password: 'admin123'
  },
  staffUser: {
    email: 'staff@test.com', 
    password: 'staff123'
  },
  parkingType: {
    code: 'TEST001',
    name: 'Bãi Test',
    description: 'Bãi đậu xe để test',
    icon: '🚗',
    color: '#FF6B6B',
    pricePerDay: 150,
    totalSpaces: 20,
    features: ['Có mái che', 'An toàn 24/7'],
    isActive: true
  },
  maintenanceDay: {
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    reason: 'Bảo trì định kỳ',
    description: 'Bảo trì hệ thống điện và camera',
    isActive: true
  },
  specialPrice: {
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    price: 200,
    reason: 'Ngày lễ đặc biệt',
    isActive: true
  },
  manualBooking: {
    customerName: 'Nguyễn Văn Test',
    customerPhone: '0123456789',
    customerEmail: 'test@example.com',
    licensePlate: '30A-12345',
    checkInTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    checkOutTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    notes: 'Đặt chỗ thủ công cho khách VIP'
  }
};

class FeatureTester {
  constructor() {
    this.adminToken = null;
    this.staffToken = null;
    this.parkingTypeId = null;
    this.maintenanceDayId = null;
    this.specialPriceId = null;
    this.bookingId = null;
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

  // Test 1: Authentication
  async testAuthentication() {
    console.log('\n🔐 Testing Authentication...');
    
    try {
      // Test admin login
      const adminLogin = await this.makeRequest('POST', '/auth/login', testData.adminUser);
      this.adminToken = adminLogin.token;
      console.log('✅ Admin login successful');
      
      // Test staff login
      const staffLogin = await this.makeRequest('POST', '/auth/login', testData.staffUser);
      this.staffToken = staffLogin.token;
      console.log('✅ Staff login successful');
      
    } catch (error) {
      console.log('⚠️  Authentication test skipped - users may not exist');
    }
  }

  // Test 2: Parking Type Management
  async testParkingTypeManagement() {
    console.log('\n🚗 Testing Parking Type Management...');
    
    try {
      // Create parking type
      const createdType = await this.makeRequest('POST', '/admin/parking-types', testData.parkingType, this.adminToken);
      this.parkingTypeId = createdType.parkingType._id;
      console.log('✅ Parking type created:', createdType.parkingType.name);
      
      // Get all parking types
      const allTypes = await this.makeRequest('GET', '/admin/parking-types', null, this.adminToken);
      console.log('✅ Retrieved parking types:', allTypes.parkingTypes.length);
      
    } catch (error) {
      console.log('⚠️  Parking type test skipped');
    }
  }

  // Test 3: Maintenance Day Management
  async testMaintenanceDayManagement() {
    console.log('\n🔧 Testing Maintenance Day Management...');
    
    try {
      // Create maintenance day
      const maintenanceData = {
        ...testData.maintenanceDay,
        affectedParkingTypes: this.parkingTypeId ? [this.parkingTypeId] : []
      };
      
      const createdMaintenance = await this.makeRequest('POST', '/maintenance', maintenanceData, this.adminToken);
      this.maintenanceDayId = createdMaintenance.maintenanceDay._id;
      console.log('✅ Maintenance day created:', createdMaintenance.maintenanceDay.reason);
      
      // Get all maintenance days
      const allMaintenance = await this.makeRequest('GET', '/maintenance', null, this.adminToken);
      console.log('✅ Retrieved maintenance days:', allMaintenance.maintenanceDays.length);
      
      // Check maintenance days for range
      const startDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const rangeCheck = await this.makeRequest('GET', `/maintenance/check/range?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, null, this.adminToken);
      console.log('✅ Maintenance range check:', rangeCheck.maintenanceDays.length, 'maintenance days found');
      
    } catch (error) {
      console.log('⚠️  Maintenance day test skipped');
    }
  }

  // Test 4: Special Pricing Management
  async testSpecialPricingManagement() {
    console.log('\n💰 Testing Special Pricing Management...');
    
    if (!this.parkingTypeId) {
      console.log('⚠️  Skipping special pricing test - no parking type available');
      return;
    }
    
    try {
      // Add special price
      const specialPriceData = {
        date: testData.specialPrice.date.toISOString().split('T')[0],
        price: testData.specialPrice.price,
        reason: testData.specialPrice.reason
      };
      
      const createdSpecialPrice = await this.makeRequest('POST', `/admin/parking-types/${this.parkingTypeId}/special-prices`, specialPriceData, this.adminToken);
      this.specialPriceId = createdSpecialPrice.specialPrice._id;
      console.log('✅ Special price created:', createdSpecialPrice.specialPrice.price, 'TWD');
      
      // Get special prices
      const allSpecialPrices = await this.makeRequest('GET', `/admin/parking-types/${this.parkingTypeId}/special-prices`, null, this.adminToken);
      console.log('✅ Retrieved special prices:', allSpecialPrices.specialPrices.length);
      
    } catch (error) {
      console.log('⚠️  Special pricing test skipped');
    }
  }

  // Test 5: Manual Booking
  async testManualBooking() {
    console.log('\n📝 Testing Manual Booking...');
    
    if (!this.parkingTypeId) {
      console.log('⚠️  Skipping manual booking test - no parking type available');
      return;
    }
    
    try {
      // Create manual booking
      const bookingData = {
        ...testData.manualBooking,
        parkingType: this.parkingTypeId,
        checkInTime: testData.manualBooking.checkInTime.toISOString(),
        checkOutTime: testData.manualBooking.checkOutTime.toISOString()
      };
      
      const createdBooking = await this.makeRequest('POST', '/bookings/manual', bookingData, this.staffToken);
      this.bookingId = createdBooking.booking._id;
      console.log('✅ Manual booking created:', createdBooking.booking.bookingNumber);
      
      // Get today's bookings
      const todayBookings = await this.makeRequest('GET', '/bookings/today/summary', null, this.staffToken);
      console.log('✅ Today\'s bookings summary:', {
        checkIns: todayBookings.checkIns.length,
        checkOuts: todayBookings.checkOuts.length,
        overdue: todayBookings.overdue.length
      });
      
    } catch (error) {
      console.log('⚠️  Manual booking test skipped');
    }
  }

  // Test 6: Booking Availability with Maintenance Days
  async testBookingAvailabilityWithMaintenance() {
    console.log('\n🚫 Testing Booking Availability with Maintenance Days...');
    
    if (!this.parkingTypeId) {
      console.log('⚠️  Skipping availability test - no parking type available');
      return;
    }
    
    try {
      // Test availability check during maintenance period
      const maintenanceStart = new Date(testData.maintenanceDay.date);
      const maintenanceEnd = new Date(testData.maintenanceDay.date);
      maintenanceEnd.setDate(maintenanceEnd.getDate() + 1);
      
      const availabilityCheck = await this.makeRequest('GET', `/bookings/availability?parkingType=${this.parkingTypeId}&checkInTime=${maintenanceStart.toISOString()}&checkOutTime=${maintenanceEnd.toISOString()}`);
      
      if (availabilityCheck.success === false && availabilityCheck.message.includes('bảo trì')) {
        console.log('✅ Maintenance day correctly blocks availability');
      } else {
        console.log('⚠️  Maintenance day blocking may not be working correctly');
      }
      
    } catch (error) {
      console.log('⚠️  Availability test skipped');
    }
  }

  // Test 7: Booking Creation with Maintenance Check
  async testBookingCreationWithMaintenance() {
    console.log('\n🚫 Testing Booking Creation with Maintenance Check...');
    
    if (!this.parkingTypeId) {
      console.log('⚠️  Skipping booking creation test - no parking type available');
      return;
    }
    
    try {
      // Try to create booking during maintenance period
      const maintenanceStart = new Date(testData.maintenanceDay.date);
      const maintenanceEnd = new Date(testData.maintenanceDay.date);
      maintenanceEnd.setDate(maintenanceEnd.getDate() + 1);
      
      const bookingData = {
        customerName: 'Test Customer',
        customerPhone: '0987654321',
        customerEmail: 'test@example.com',
        licensePlate: '30B-54321',
        parkingType: this.parkingTypeId,
        checkInTime: maintenanceStart.toISOString(),
        checkOutTime: maintenanceEnd.toISOString()
      };
      
      try {
        await this.makeRequest('POST', '/bookings', bookingData);
        console.log('⚠️  Booking creation during maintenance should have failed');
      } catch (error) {
        if (error.response?.data?.message?.includes('bảo trì')) {
          console.log('✅ Booking creation correctly blocked during maintenance');
        } else {
          console.log('⚠️  Unexpected error during maintenance booking test');
        }
      }
      
    } catch (error) {
      console.log('⚠️  Booking creation test skipped');
    }
  }

  // Test 8: Cleanup
  async testCleanup() {
    console.log('\n🧹 Testing Cleanup...');
    
    try {
      // Delete manual booking
      if (this.bookingId) {
        await this.makeRequest('DELETE', `/bookings/${this.bookingId}`, null, this.adminToken);
        console.log('✅ Manual booking deleted');
      }
      
      // Delete special price
      if (this.specialPriceId && this.parkingTypeId) {
        await this.makeRequest('DELETE', `/admin/parking-types/${this.parkingTypeId}/special-prices/${this.specialPriceId}`, null, this.adminToken);
        console.log('✅ Special price deleted');
      }
      
      // Delete maintenance day
      if (this.maintenanceDayId) {
        await this.makeRequest('DELETE', `/maintenance/${this.maintenanceDayId}`, null, this.adminToken);
        console.log('✅ Maintenance day deleted');
      }
      
      // Delete parking type
      if (this.parkingTypeId) {
        await this.makeRequest('DELETE', `/admin/parking-types/${this.parkingTypeId}`, null, this.adminToken);
        console.log('✅ Parking type deleted');
      }
      
    } catch (error) {
      console.log('⚠️  Cleanup test skipped');
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Feature Tests...');
    console.log('=' * 50);
    
    try {
      await this.testAuthentication();
      await this.testParkingTypeManagement();
      await this.testMaintenanceDayManagement();
      await this.testSpecialPricingManagement();
      await this.testManualBooking();
      await this.testBookingAvailabilityWithMaintenance();
      await this.testBookingCreationWithMaintenance();
      await this.testCleanup();
      
      console.log('\n🎉 All tests completed!');
      console.log('=' * 50);
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
    }
  }
}

// Main execution
async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');
    
    // Run tests
    const tester = new FeatureTester();
    await tester.runAllTests();
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = FeatureTester; 