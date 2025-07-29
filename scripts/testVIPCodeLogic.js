// Test VIP code generation logic without database
function generateVIPCode(phone, year = new Date().getFullYear()) {
  const yearCode = year === 2025 ? '114' : year === 2026 ? '115' : '114'; // Default to 114 for other years
  
  // Clean phone number - remove all non-digits and handle country codes
  let phoneNumber = phone.replace(/\D/g, ''); // Remove non-digits
  
  // If phone starts with country code (886), remove it
  if (phoneNumber.startsWith('886')) {
    phoneNumber = phoneNumber.substring(3);
  }
  
  // Ensure phone number is 10 digits (Taiwan format)
  if (phoneNumber.length > 10) {
    phoneNumber = phoneNumber.substring(phoneNumber.length - 10);
  }
  
  return `${yearCode}${phoneNumber}`;
}

console.log('🧪 Testing VIP Code Generation Logic\n');

// Test cases
const testCases = [
  { phone: '0908805805', year: 2025, expected: '1140908805805' },
  { phone: '0912345678', year: 2026, expected: '1150912345678' },
  { phone: '0987654321', year: 2024, expected: '1140987654321' },
  { phone: '+886-912-345-678', year: 2025, expected: '114912345678' },
  { phone: '0912-345-678', year: 2026, expected: '1150912345678' }
];

testCases.forEach((testCase, index) => {
  const result = generateVIPCode(testCase.phone, testCase.year);
  const passed = result === testCase.expected;
  
  console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'}`);
  console.log(`   Phone: ${testCase.phone}`);
  console.log(`   Year: ${testCase.year}`);
  console.log(`   Expected: ${testCase.expected}`);
  console.log(`   Result: ${result}`);
  console.log(`   Status: ${passed ? 'PASSED' : 'FAILED'}\n`);
});

// Test current year logic
const currentYear = new Date().getFullYear();
const currentYearCode = currentYear === 2025 ? '114' : currentYear === 2026 ? '115' : '114';
console.log(`📅 Current Year: ${currentYear}`);
console.log(`🔢 Current Year Code: ${currentYearCode}`);

// Test phone number cleaning
console.log('\n🧹 Phone Number Cleaning Tests:');
const phoneTests = [
  '0908805805',
  '+886-908-805-805',
  '0908-805-805',
  '0908 805 805',
  '(0908) 805-805'
];

phoneTests.forEach(phone => {
  const cleaned = phone.replace(/\D/g, '');
  console.log(`   "${phone}" -> "${cleaned}"`);
});

console.log('\n✨ VIP Code Generation Logic Test Complete!'); 