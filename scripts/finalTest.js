#!/usr/bin/env node

const axios = require('axios');
const baseURL = 'http://localhost:5002/api';

// Test colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Test 1: Verify booking number format for existing data
const testExistingDataFormat = async () => {
  log('\n🧪 Test 1: Existing Data Format', 'blue');
  
  const testCases = [
    { licensePlate: 'BEA-9919', expectedDate: '20250728' },
    { licensePlate: '30A-12345', expectedDate: '20250729' },
    { licensePlate: '51B-67890', expectedDate: '20250729' }
  ];
  
  let passed = 0;
  let total = testCases.length;
  
  for (const testCase of testCases) {
    try {
      const response = await axios.get(`${baseURL}/bookings/search?licensePlate=${testCase.licensePlate}`);
      const bookings = response.data.bookings;
      
      if (bookings.length > 0) {
        const booking = bookings[0];
        const bookingNumber = booking.bookingNumber;
        const datePart = bookingNumber.substring(0, 8);
        const licensePart = bookingNumber.substring(8);
        
        log(`📋 ${testCase.licensePlate}: ${bookingNumber}`, 'yellow');
        
        if (datePart === testCase.expectedDate && licensePart === testCase.licensePlate) {
          log(`✅ Format correct for ${testCase.licensePlate}`, 'green');
          passed++;
        } else {
          log(`❌ Format incorrect for ${testCase.licensePlate}`, 'red');
        }
      } else {
        log(`⚠️  No bookings found for ${testCase.licensePlate}`, 'yellow');
      }
    } catch (error) {
      log(`❌ Error testing ${testCase.licensePlate}: ${error.message}`, 'red');
    }
  }
  
  log(`📊 Format Test: ${passed}/${total} passed`, passed === total ? 'green' : 'red');
  return passed === total;
};

// Test 2: Verify status distribution
const testStatusDistribution = async () => {
  log('\n🧪 Test 2: Status Distribution', 'blue');
  
  try {
    // Test different statuses
    const statusTests = [
      { licensePlate: '30A-12345', expectedStatus: 'confirmed' },
      { licensePlate: '75A-33333', expectedStatus: 'checked-in' },
      { licensePlate: '29H-11111', expectedStatus: 'cancelled' }
    ];
    
    let passed = 0;
    let total = statusTests.length;
    
    for (const test of statusTests) {
      const response = await axios.get(`${baseURL}/bookings/search?licensePlate=${test.licensePlate}`);
      const bookings = response.data.bookings;
      
      if (bookings.length > 0) {
        const booking = bookings.find(b => b.status === test.expectedStatus);
        if (booking) {
          log(`✅ Found ${test.expectedStatus} status for ${test.licensePlate}`, 'green');
          passed++;
        } else {
          log(`❌ Expected ${test.expectedStatus} status for ${test.licensePlate}`, 'red');
        }
      } else {
        log(`⚠️  No bookings found for ${test.licensePlate}`, 'yellow');
      }
    }
    
    log(`📊 Status Test: ${passed}/${total} passed`, passed === total ? 'green' : 'red');
    return passed === total;
    
  } catch (error) {
    log(`❌ Error testing status distribution: ${error.message}`, 'red');
    return false;
  }
};

// Test 3: Create new booking and verify logic
const testNewBookingCreation = async () => {
  log('\n🧪 Test 3: New Booking Creation', 'blue');
  
  try {
    // Get parking types
    const parkingResponse = await axios.get(`${baseURL}/parking`);
    const parkingTypes = parkingResponse.data.parkingTypes;
    
    if (parkingTypes.length === 0) {
      log('❌ No parking types available', 'red');
      return false;
    }
    
    const parkingType = parkingTypes[0];
    const testLicensePlate = `FINAL-${Date.now()}`;
    
    log(`🚗 Creating booking with license: ${testLicensePlate}`, 'yellow');
    
    // Create new booking
    const bookingData = {
      parkingTypeId: parkingType._id,
      checkInTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      checkOutTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      driverName: 'Final Test User',
      phone: '0909999999',
      email: 'finaltest@example.com',
      licensePlate: testLicensePlate,
      passengerCount: 1,
      luggageCount: 0,
      addonServices: [],
      termsAccepted: true
    };
    
    const response = await axios.post(`${baseURL}/bookings`, bookingData);
    const booking = response.data.booking;
    
    log(`📋 New booking created:`, 'green');
    log(`   Number: ${booking.bookingNumber}`, 'yellow');
    log(`   Status: ${booking.status}`, 'yellow');
    log(`   License: ${booking.licensePlate}`, 'yellow');
    
    // Verify format
    const today = new Date();
    const expectedDate = today.getFullYear().toString() + 
                        String(today.getMonth() + 1).padStart(2, '0') + 
                        String(today.getDate()).padStart(2, '0');
    
    const expectedNumber = expectedDate + testLicensePlate;
    const formatCorrect = booking.bookingNumber === expectedNumber;
    const statusCorrect = booking.status === 'confirmed';
    
    if (formatCorrect) {
      log('✅ Booking number format is correct', 'green');
    } else {
      log(`❌ Booking number format incorrect. Expected: ${expectedNumber}, Got: ${booking.bookingNumber}`, 'red');
    }
    
    if (statusCorrect) {
      log('✅ Status is confirmed', 'green');
    } else {
      log(`❌ Status incorrect. Expected: confirmed, Got: ${booking.status}`, 'red');
    }
    
    return formatCorrect && statusCorrect;
    
  } catch (error) {
    log(`❌ Error creating new booking: ${error.message}`, 'red');
    return false;
  }
};

// Test 4: Test API responses include bookingNumber
const testAPIResponses = async () => {
  log('\n🧪 Test 4: API Responses', 'blue');
  
  try {
    const tests = [
      { name: 'Health', url: '/health', check: (data) => data.status === 'OK' },
      { name: 'Parking Types', url: '/parking', check: (data) => data.parkingTypes && data.parkingTypes.length > 0 },
      { name: 'Booking Search', url: '/bookings/search?licensePlate=30A-12345', check: (data) => data.bookings && data.bookings[0] && data.bookings[0].bookingNumber }
    ];
    
    let passed = 0;
    let total = tests.length;
    
    for (const test of tests) {
      try {
        const response = await axios.get(`${baseURL}${test.url}`);
        if (test.check(response.data)) {
          log(`✅ ${test.name} API working correctly`, 'green');
          passed++;
        } else {
          log(`❌ ${test.name} API response incorrect`, 'red');
        }
      } catch (error) {
        log(`❌ ${test.name} API failed: ${error.message}`, 'red');
      }
    }
    
    log(`📊 API Test: ${passed}/${total} passed`, passed === total ? 'green' : 'red');
    return passed === total;
    
  } catch (error) {
    log(`❌ Error testing API responses: ${error.message}`, 'red');
    return false;
  }
};

// Test 5: Test frontend accessibility
const testFrontendAccess = async () => {
  log('\n🧪 Test 5: Frontend Access', 'blue');
  
  try {
    const frontendTests = [
      { name: 'Homepage', url: 'http://localhost:3000' },
      { name: 'Lookup Page', url: 'http://localhost:3000/lookup' },
      { name: 'Booking Page', url: 'http://localhost:3000/booking' }
    ];
    
    let passed = 0;
    let total = frontendTests.length;
    
    for (const test of frontendTests) {
      try {
        const response = await axios.get(test.url);
        if (response.status === 200) {
          log(`✅ ${test.name} accessible`, 'green');
          passed++;
        } else {
          log(`❌ ${test.name} returned status: ${response.status}`, 'red');
        }
      } catch (error) {
        log(`❌ ${test.name} not accessible: ${error.message}`, 'red');
      }
    }
    
    log(`📊 Frontend Test: ${passed}/${total} passed`, passed === total ? 'green' : 'red');
    return passed === total;
    
  } catch (error) {
    log(`❌ Error testing frontend access: ${error.message}`, 'red');
    return false;
  }
};

// Main test runner
const runFinalTest = async () => {
  log('\n🚀 FINAL TEST - New Logic Verification', 'bold');
  log('=========================================', 'blue');
  
  const tests = [
    { name: 'Existing Data Format', fn: testExistingDataFormat },
    { name: 'Status Distribution', fn: testStatusDistribution },
    { name: 'New Booking Creation', fn: testNewBookingCreation },
    { name: 'API Responses', fn: testAPIResponses },
    { name: 'Frontend Access', fn: testFrontendAccess }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      log(`❌ Test "${test.name}" failed with error: ${error.message}`, 'red');
      results.push({ name: test.name, passed: false });
    }
  }
  
  // Summary
  log('\n📊 FINAL TEST RESULTS', 'bold');
  log('=========================================', 'blue');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    log(`${status} ${result.name}`, color);
  });
  
  log(`\n🎯 Overall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 ALL TESTS PASSED!', 'green');
    log('✅ New booking logic is working perfectly!', 'green');
    log('✅ Booking numbers follow format: YYYYMMDD + LicensePlate', 'green');
    log('✅ Default status is "confirmed" (Đặt thành công)', 'green');
    log('✅ All APIs return bookingNumber correctly', 'green');
    log('✅ Frontend is accessible and ready', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please check the logs above.', 'yellow');
  }
  
  return passed === total;
};

// Run tests if this file is executed directly
if (require.main === module) {
  runFinalTest().catch(console.error);
}

module.exports = { runFinalTest }; 