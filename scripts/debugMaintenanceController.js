const maintenanceController = require('../controllers/maintenanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

console.log('🔍 Debugging Maintenance Controller...');
console.log('='.repeat(50));

// Check if all functions exist
const functions = [
  'getAllMaintenanceDays',
  'createMaintenanceDay', 
  'updateMaintenanceDay',
  'deleteMaintenanceDay',
  'getMaintenanceDayById',
  'checkMaintenanceDays'
];

functions.forEach(funcName => {
  const func = maintenanceController[funcName];
  if (typeof func === 'function') {
    console.log(`✅ ${funcName}: Function exists (${func.length} parameters)`);
  } else {
    console.log(`❌ ${funcName}: Function is ${typeof func}`);
    if (func === undefined) {
      console.log(`   - Value: ${func}`);
    }
  }
});

console.log('\n📋 All exported functions:');
console.log(Object.keys(maintenanceController));

console.log('\n🔧 Controller object type:', typeof maintenanceController);
console.log('🔧 Controller is function:', typeof maintenanceController === 'function');
console.log('🔧 Controller is object:', typeof maintenanceController === 'object');

// Test specific function that might be undefined
console.log('\n🔍 Testing specific functions:');
console.log('getAllMaintenanceDays:', typeof maintenanceController.getAllMaintenanceDays);
console.log('checkMaintenanceDays:', typeof maintenanceController.checkMaintenanceDays);

// Test if we can call the functions
try {
  console.log('\n🧪 Testing function calls:');
  console.log('getAllMaintenanceDays callable:', typeof maintenanceController.getAllMaintenanceDays === 'function');
  console.log('checkMaintenanceDays callable:', typeof maintenanceController.checkMaintenanceDays === 'function');
} catch (error) {
  console.log('❌ Error testing functions:', error.message);
}

// Test middleware
console.log('\n🔐 Testing Middleware:');
console.log('authenticateToken:', typeof authenticateToken);
console.log('requireRole:', typeof requireRole);

if (typeof authenticateToken === 'function') {
  console.log('✅ authenticateToken is a function');
} else {
  console.log('❌ authenticateToken is not a function');
}

if (typeof requireRole === 'function') {
  console.log('✅ requireRole is a function');
} else {
  console.log('❌ requireRole is not a function');
} 