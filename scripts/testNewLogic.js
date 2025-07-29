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

// Test 1: Check if bookingNumber format is correct
const testBookingNumberFormat = async () => {
  log('\n🧪 Test 1: Booking Number Format', 'blue');
  
  try {
    const response = await axios.get(`${baseURL}/bookings/search?licensePlate=BEA-9919`);
    const bookings = response.data.bookings;
    
    if (bookings.length > 0) {
      const booking = bookings[0];
      const bookingNumber = booking.bookingNumber;
      
      log(`📋 Found booking: ${bookingNumber}`, 'green');
      
      // Check format: YYYYMMDD + licensePlate
      const datePart = bookingNumber.substring(0, 8);
      const licensePart = bookingNumber.substring(8);
      
      log(`📅 Date part: ${datePart}`, 'yellow');
      log(`🚗 License part: ${licensePart}`, 'yellow');
      
      // Validate format
      const isValidFormat = /^\d{8}[A-Z0-9-]+$/.test(bookingNumber);
      const isCorrectLicense = licensePart === booking.licensePlate;
      
      if (isValidFormat && isCorrectLicense) {
        log('✅ Booking number format is correct!', 'green');
        return true;
      } else {
        log('❌ Booking number format is incorrect!', 'red');
        return false;
      }
    } else {
      log('⚠️  No bookings found for testing', 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Error testing booking number format: ${error.message}`, 'red');
    return false;
  }
};

// Test 2: Check if status is confirmed by default
const testDefaultStatus = async () => {
  log('\n🧪 Test 2: Default Status', 'blue');
  
  try {
    const response = await axios.get(`${baseURL}/bookings/search?licensePlate=ABC-1234`);
    const bookings = response.data.bookings;
    
    if (bookings.length > 0) {
      const booking = bookings[0];
      log(`📋 Booking status: ${booking.status}`, 'yellow');
      
      if (booking.status === 'confirmed') {
        log('✅ Default status is confirmed!', 'green');
        return true;
      } else {
        log('❌ Default status is not confirmed!', 'red');
        return false;
      }
    } else {
      log('⚠️  No recent bookings found for testing', 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Error testing default status: ${error.message}`, 'red');
    return false;
  }
};

// Test 3: Create a new booking and verify logic
const testNewBookingCreation = async () => {
  log('\n🧪 Test 3: New Booking Creation', 'blue');
  
  try {
    // Get parking types first
    const parkingResponse = await axios.get(`${baseURL}/parking`);
    const parkingTypes = parkingResponse.data.parkingTypes;
    
    if (parkingTypes.length === 0) {
      log('❌ No parking types available', 'red');
      return false;
    }
    
    const parkingType = parkingTypes[0];
    const testLicensePlate = `TEST-${Date.now()}`;
    
    log(`🚗 Using parking type: ${parkingType.name}`, 'yellow');
    log(`🔢 Test license plate: ${testLicensePlate}`, 'yellow');
    
    // Create new booking
    const bookingData = {
      parkingTypeId: parkingType._id,
      checkInTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      checkOutTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
      driverName: 'Test Driver',
      phone: '0900000000',
      email: 'test@example.com',
      licensePlate: testLicensePlate,
      passengerCount: 1,
      luggageCount: 0,
      addonServices: [],
      termsAccepted: true
    };
    
    const response = await axios.post(`${baseURL}/bookings`, bookingData);
    const booking = response.data.booking;
    
    log(`📋 New booking created:`, 'green');
    log(`   ID: ${booking._id}`, 'yellow');
    log(`   Number: ${booking.bookingNumber}`, 'yellow');
    log(`   Status: ${booking.status}`, 'yellow');
    log(`   License: ${booking.licensePlate}`, 'yellow');
    
    // Verify booking number format
    const today = new Date();
    const expectedDate = today.getFullYear().toString() + 
                        String(today.getMonth() + 1).padStart(2, '0') + 
                        String(today.getDate()).padStart(2, '0');
    
    const expectedNumber = expectedDate + testLicensePlate;
    
    if (booking.bookingNumber === expectedNumber) {
      log('✅ Booking number format is correct!', 'green');
    } else {
      log(`❌ Booking number mismatch! Expected: ${expectedNumber}, Got: ${booking.bookingNumber}`, 'red');
    }
    
    if (booking.status === 'confirmed') {
      log('✅ Status is confirmed!', 'green');
    } else {
      log(`❌ Status is not confirmed! Got: ${booking.status}`, 'red');
    }
    
    return booking.bookingNumber === expectedNumber && booking.status === 'confirmed';
    
  } catch (error) {
    log(`❌ Error creating new booking: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
};

// Test 4: Check API responses include bookingNumber
const testAPIResponses = async () => {
  log('\n🧪 Test 4: API Responses', 'blue');
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${baseURL}/health`);
    log(`✅ Health endpoint: ${healthResponse.data.status}`, 'green');
    
    // Test parking types endpoint
    const parkingResponse = await axios.get(`${baseURL}/parking`);
    log(`✅ Parking types: ${parkingResponse.data.parkingTypes.length} found`, 'green');
    
    // Test bookings search endpoint
    const searchResponse = await axios.get(`${baseURL}/bookings/search?licensePlate=BEA-9919`);
    const bookings = searchResponse.data.bookings;
    
    if (bookings.length > 0) {
      const booking = bookings[0];
      if (booking.bookingNumber) {
        log(`✅ Booking search includes bookingNumber: ${booking.bookingNumber}`, 'green');
      } else {
        log('❌ Booking search missing bookingNumber', 'red');
      }
    }
    
    return true;
  } catch (error) {
    log(`❌ Error testing API responses: ${error.message}`, 'red');
    return false;
  }
};

// Test 5: Check frontend accessibility
const testFrontendAccess = async () => {
  log('\n🧪 Test 5: Frontend Access', 'blue');
  
  try {
    const response = await axios.get('http://localhost:3000');
    if (response.status === 200) {
      log('✅ Frontend is accessible', 'green');
      return true;
    } else {
      log(`❌ Frontend returned status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Frontend not accessible: ${error.message}`, 'red');
    return false;
  }
};

// Main test runner
const runTests = async () => {
  log('\n🚀 Starting New Logic Tests', 'bold');
  log('=====================================', 'blue');
  
  const tests = [
    { name: 'Booking Number Format', fn: testBookingNumberFormat },
    { name: 'Default Status', fn: testDefaultStatus },
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
  log('\n📊 Test Results Summary', 'bold');
  log('=====================================', 'blue');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    log(`${status} ${result.name}`, color);
  });
  
  log(`\n🎯 Overall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All tests passed! New logic is working correctly!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please check the logs above.', 'yellow');
  }
  
  return passed === total;
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests }; 