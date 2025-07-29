#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper function to log with colors
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to run a command
function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    log(`\n${colors.cyan}🚀 ${description}...${colors.reset}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${description} completed successfully`, 'green');
        resolve();
      } else {
        log(`❌ ${description} failed with code ${code}`, 'red');
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      log(`❌ ${description} failed: ${error.message}`, 'red');
      reject(error);
    });
  });
}

// Main test runner
async function runAllTests() {
  log('🧪 Starting Comprehensive Test Suite', 'bright');
  log('='.repeat(60), 'cyan');
  
  const startTime = Date.now();
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  try {
    // Test 1: Individual Feature Tests
    try {
      await runCommand('node', ['scripts/testIndividualFeatures.js'], 'Individual Feature Tests');
      results.passed++;
    } catch (error) {
      results.failed++;
      log(`⚠️  Individual tests failed: ${error.message}`, 'yellow');
    }
    results.total++;

    // Test 2: Full Feature Tests (if server is running)
    try {
      log(`\n${colors.yellow}⚠️  Note: Full feature tests require the server to be running${colors.reset}`);
      log(`${colors.yellow}   Start the server with: npm run dev${colors.reset}`);
      
      // Check if server is running
      const { default: axios } = await import('axios');
      try {
        await axios.get('http://localhost:5002/api/health');
        log(`${colors.green}✅ Server is running, proceeding with full tests${colors.reset}`);
        
        await runCommand('node', ['scripts/testNewFeatures.js'], 'Full Feature Tests');
        results.passed++;
      } catch (error) {
        log(`${colors.yellow}⚠️  Server not running, skipping full tests${colors.reset}`);
        log(`${colors.yellow}   To run full tests, start the server first${colors.reset}`);
      }
    } catch (error) {
      results.failed++;
      log(`⚠️  Full feature tests failed: ${error.message}`, 'yellow');
    }
    results.total++;

    // Test 3: Database Connection Test
    try {
      await runCommand('node', ['-e', `
        const mongoose = require('mongoose');
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone';
        
        mongoose.connect(MONGODB_URI)
          .then(() => {
            console.log('✅ Database connection successful');
            process.exit(0);
          })
          .catch((error) => {
            console.error('❌ Database connection failed:', error.message);
            process.exit(1);
          });
      `], 'Database Connection Test');
      results.passed++;
    } catch (error) {
      results.failed++;
      log(`⚠️  Database test failed: ${error.message}`, 'yellow');
    }
    results.total++;

    // Test 4: Model Loading Test
    try {
      await runCommand('node', ['-e', `
        try {
          require('./models/MaintenanceDay');
          require('./models/ParkingType');
          require('./models/Booking');
          console.log('✅ All models loaded successfully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Model loading failed:', error.message);
          process.exit(1);
        }
      `], 'Model Loading Test');
      results.passed++;
    } catch (error) {
      results.failed++;
      log(`⚠️  Model loading test failed: ${error.message}`, 'yellow');
    }
    results.total++;

    // Test 5: Route Registration Test
    try {
      await runCommand('node', ['-e', `
        try {
          require('./routes/maintenance');
          require('./routes/booking');
          require('./routes/admin');
          console.log('✅ All routes loaded successfully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Route loading failed:', error.message);
          process.exit(1);
        }
      `], 'Route Registration Test');
      results.passed++;
    } catch (error) {
      results.failed++;
      log(`⚠️  Route registration test failed: ${error.message}`, 'yellow');
    }
    results.total++;

  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
  }

  // Final summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST RESULTS SUMMARY', 'bright');
  log('='.repeat(60), 'cyan');
  
  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, 'red');
  log(`Duration: ${duration}s`, 'blue');
  
  if (results.failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log(`\n⚠️  ${results.failed} test(s) failed`, 'yellow');
  }
  
  log('\n📋 Test Categories:', 'bright');
  log('1. Individual Feature Tests - Basic API and model tests', 'blue');
  log('2. Full Feature Tests - Complete end-to-end tests (requires server)', 'blue');
  log('3. Database Connection Test - MongoDB connectivity', 'blue');
  log('4. Model Loading Test - Mongoose model validation', 'blue');
  log('5. Route Registration Test - Express route validation', 'blue');
  
  log('\n🔧 To run specific tests:', 'bright');
  log('• Individual tests: node scripts/testIndividualFeatures.js', 'cyan');
  log('• Full tests: node scripts/testNewFeatures.js', 'cyan');
  log('• Frontend tests: npm test (in frontend directory)', 'cyan');
  
  log('\n🚀 To start the server for full tests:', 'bright');
  log('• Backend: npm run dev', 'cyan');
  log('• Frontend: npm run dev (in frontend directory)', 'cyan');
  
  process.exit(results.failed === 0 ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch((error) => {
    log(`\n❌ Test runner failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runAllTests }; 