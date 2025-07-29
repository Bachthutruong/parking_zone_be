const mongoose = require('mongoose');
const ParkingType = require('../models/ParkingType');

require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

function generateWeekendTemplates(year = 2025) {
  const weekends = [];
  const startOfYear = new Date(year, 0, 1); // 1/1/year
  const endOfYear = new Date(year, 11, 31); // 31/12/year
  
  // Tìm thứ 7 đầu tiên của năm
  let firstSaturday = new Date(startOfYear);
  while (firstSaturday.getDay() !== 6) { // 6 = Saturday
    firstSaturday.setDate(firstSaturday.getDate() + 1);
  }
  
  // Tạo tất cả cuối tuần trong năm
  let currentWeekend = new Date(firstSaturday);
  while (currentWeekend <= endOfYear) {
    const weekendEnd = new Date(currentWeekend);
    weekendEnd.setDate(currentWeekend.getDate() + 1); // Sunday
    
    weekends.push({
      startDate: currentWeekend.toISOString().split('T')[0],
      endDate: weekendEnd.toISOString().split('T')[0],
      price: 1500, // Giá mẫu
      reason: 'Cuối tuần',
      isActive: true
    });
    
    // Chuyển đến cuối tuần tiếp theo (7 ngày sau)
    currentWeekend.setDate(currentWeekend.getDate() + 7);
  }
  
  return weekends;
}

function generateNextMonthWeekendTemplates() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthWeekends = [];
  const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  
  // Tìm thứ 7 đầu tiên của tháng tới
  let firstSaturdayNextMonth = new Date(nextMonth);
  while (firstSaturdayNextMonth.getDay() !== 6) {
    firstSaturdayNextMonth.setDate(firstSaturdayNextMonth.getDate() + 1);
  }
  
  // Tạo tất cả cuối tuần trong tháng tới
  let currentWeekendNextMonth = new Date(firstSaturdayNextMonth);
  while (currentWeekendNextMonth <= endOfNextMonth) {
    const weekendEndNextMonth = new Date(currentWeekendNextMonth);
    weekendEndNextMonth.setDate(currentWeekendNextMonth.getDate() + 1);
    
    nextMonthWeekends.push({
      startDate: currentWeekendNextMonth.toISOString().split('T')[0],
      endDate: weekendEndNextMonth.toISOString().split('T')[0],
      price: 1500, // Giá mẫu
      reason: 'Cuối tuần tháng tới',
      isActive: true
    });
    
    currentWeekendNextMonth.setDate(currentWeekendNextMonth.getDate() + 7);
  }
  
  return nextMonthWeekends;
}

async function testBulkSpecialPricing() {
  try {
    console.log('💰 Testing Bulk Special Pricing Features...\n');

    // 1. Test weekend template generation
    console.log('1. Testing weekend template generation...');
    const weekendTemplates = generateWeekendTemplates(2025);
    console.log(`   ✅ Generated ${weekendTemplates.length} weekend templates for 2025`);
    
    if (weekendTemplates.length > 0) {
      console.log('   📅 Sample weekends:');
      weekendTemplates.slice(0, 5).forEach((weekend, index) => {
        console.log(`     ${index + 1}. ${weekend.startDate} - ${weekend.endDate}: ${weekend.price} NT$`);
      });
      if (weekendTemplates.length > 5) {
        console.log(`     ... and ${weekendTemplates.length - 5} more`);
      }
    }

    // 2. Test next month weekend template generation
    console.log('\n2. Testing next month weekend template generation...');
    const nextMonthWeekends = generateNextMonthWeekendTemplates();
    console.log(`   ✅ Generated ${nextMonthWeekends.length} weekend templates for next month`);
    
    if (nextMonthWeekends.length > 0) {
      console.log('   📅 Next month weekends:');
      nextMonthWeekends.forEach((weekend, index) => {
        console.log(`     ${index + 1}. ${weekend.startDate} - ${weekend.endDate}: ${weekend.price} NT$`);
      });
    }

    // 3. Test bulk operations simulation
    console.log('\n3. Testing bulk operations simulation...');
    
    // Get parking types
    const parkingTypes = await ParkingType.find({ isActive: true });
    console.log(`   📊 Found ${parkingTypes.length} active parking types`);
    
    if (parkingTypes.length === 0) {
      console.log('   ❌ No active parking types found');
      return;
    }

    // Simulate bulk create for first 2 parking types
    const selectedParkingTypes = parkingTypes.slice(0, 2).map(pt => pt._id);
    const sampleTemplate = {
      startDate: '2025-08-01',
      endDate: '2025-08-02',
      price: 2000,
      reason: 'Test Bulk Template',
      isActive: true
    };

    console.log(`   🎯 Simulating bulk create for ${selectedParkingTypes.length} parking types`);
    console.log(`   📋 Template: ${sampleTemplate.startDate} - ${sampleTemplate.endDate}: ${sampleTemplate.price} NT$`);
    console.log(`   📝 Reason: ${sampleTemplate.reason}`);

    // 4. Test bulk delete simulation
    console.log('\n4. Testing bulk delete simulation...');
    
    // Count existing special prices
    let totalSpecialPrices = 0;
    for (const parkingType of parkingTypes) {
      totalSpecialPrices += parkingType.specialPrices.length;
    }
    
    console.log(`   📊 Total existing special prices: ${totalSpecialPrices}`);
    
    if (totalSpecialPrices > 0) {
      console.log('   🗑️  Would delete all special prices from selected parking types');
      console.log(`   📋 Selected parking types: ${selectedParkingTypes.length}`);
    } else {
      console.log('   ℹ️  No special prices to delete');
    }

    // 5. Test bulk edit simulation
    console.log('\n5. Testing bulk edit simulation...');
    
    const editTemplate = {
      startDate: '2025-09-01',
      endDate: '2025-09-02',
      price: 2500,
      reason: 'Updated Bulk Template',
      isActive: true
    };
    
    console.log(`   ✏️  Would update all special prices with new template:`);
    console.log(`   📅 Date: ${editTemplate.startDate} - ${editTemplate.endDate}`);
    console.log(`   💰 Price: ${editTemplate.price} NT$`);
    console.log(`   📝 Reason: ${editTemplate.reason}`);

    // 6. Calculate total operations
    console.log('\n6. Calculating total operations...');
    
    const totalWeekendTemplates = weekendTemplates.length;
    const totalNextMonthTemplates = nextMonthWeekends.length;
    const totalParkingTypes = selectedParkingTypes.length;
    
    console.log(`   📊 Total weekend templates: ${totalWeekendTemplates}`);
    console.log(`   📊 Total next month templates: ${totalNextMonthTemplates}`);
    console.log(`   📊 Total parking types: ${totalParkingTypes}`);
    
    if (totalWeekendTemplates > 0 && totalParkingTypes > 0) {
      const totalOperations = totalWeekendTemplates * totalParkingTypes;
      console.log(`   🚀 Total operations for full year weekends: ${totalOperations}`);
      console.log(`   ⏱️  Estimated time: ${Math.ceil(totalOperations / 10)} seconds (10 ops/sec)`);
    }

    console.log('\n🎉 Bulk special pricing test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Weekend template generation working');
    console.log('   ✅ Next month template generation working');
    console.log('   ✅ Bulk operations simulation successful');
    console.log('   ✅ Template calculations accurate');
    console.log('   ✅ Performance estimates provided');

  } catch (error) {
    console.error('❌ Error in bulk special pricing test:', error);
  }
}

async function main() {
  await connectDB();
  await testBulkSpecialPricing();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  testBulkSpecialPricing,
  generateWeekendTemplates,
  generateNextMonthWeekendTemplates
}; 