const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const ParkingType = require('../models/ParkingType');
const AddonService = require('../models/AddonService');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking_zone');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Create sample data with new logic
const createSampleData = async () => {
  try {
    console.log('🔄 Creating sample data with new logic...');
    
    // Get existing parking types and addon services
    const parkingTypes = await ParkingType.find({ isActive: true });
    const addonServices = await AddonService.find({ isActive: true });
    
    if (parkingTypes.length === 0) {
      console.log('❌ No active parking types found');
      return;
    }
    
    console.log(`📋 Found ${parkingTypes.length} parking types and ${addonServices.length} addon services`);
    
    // Sample data for bookings
    const sampleBookings = [
      {
        driverName: 'Nguyễn Văn An',
        phone: '0901234567',
        email: 'nguyenvanan@example.com',
        licensePlate: '30A-12345',
        passengerCount: 2,
        luggageCount: 1,
        addonServices: addonServices.slice(0, 2).map(service => ({
          service: service._id,
          price: service.price
        }))
      },
      {
        driverName: 'Trần Thị Bình',
        phone: '0902345678',
        email: 'tranthibinh@example.com',
        licensePlate: '51B-67890',
        passengerCount: 1,
        luggageCount: 0,
        addonServices: addonServices.slice(1, 3).map(service => ({
          service: service._id,
          price: service.price
        }))
      },
      {
        driverName: 'Lê Văn Cường',
        phone: '0903456789',
        email: 'levancuong@example.com',
        licensePlate: '29H-11111',
        passengerCount: 3,
        luggageCount: 2,
        addonServices: addonServices.slice(0, 1).map(service => ({
          service: service._id,
          price: service.price
        }))
      },
      {
        driverName: 'Phạm Thị Dung',
        phone: '0904567890',
        email: 'phamthidung@example.com',
        licensePlate: '92C-22222',
        passengerCount: 1,
        luggageCount: 1,
        addonServices: []
      },
      {
        driverName: 'Hoàng Văn Em',
        phone: '0905678901',
        email: 'hoangvanem@example.com',
        licensePlate: '75A-33333',
        passengerCount: 2,
        luggageCount: 0,
        addonServices: addonServices.slice(2, 4).map(service => ({
          service: service._id,
          price: service.price
        }))
      }
    ];
    
    // Create or find users
    const users = [];
    for (const bookingData of sampleBookings) {
      let user = await User.findOne({ email: bookingData.email });
      if (!user) {
        user = await User.create({
          name: bookingData.driverName,
          email: bookingData.email,
          phone: bookingData.phone,
          licensePlate: bookingData.licensePlate,
          password: Math.random().toString(36).slice(-8),
          isVIP: Math.random() > 0.7 // 30% chance of being VIP
        });
      }
      users.push(user);
    }
    
    console.log(`👥 Created/found ${users.length} users`);
    
    // Create bookings with different dates and statuses
    const today = new Date();
    const statuses = ['confirmed', 'checked-in', 'checked-out', 'cancelled'];
    
    for (let i = 0; i < sampleBookings.length; i++) {
      const bookingData = sampleBookings[i];
      const user = users[i];
      const parkingType = parkingTypes[i % parkingTypes.length];
      
      // Create bookings for different dates
      for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
        const checkInDate = new Date(today);
        checkInDate.setDate(today.getDate() + dayOffset);
        
        const checkOutDate = new Date(checkInDate);
        checkOutDate.setDate(checkInDate.getDate() + Math.floor(Math.random() * 3) + 1);
        
        // Calculate base price
        const durationDays = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const basePrice = parkingType.pricePerDay * durationDays;
        
        // Calculate addon total
        const addonTotal = bookingData.addonServices.reduce((sum, addon) => sum + addon.price, 0);
        
        // Calculate VIP discount
        const vipDiscount = user.isVIP ? (basePrice + addonTotal) * 0.1 : 0;
        
        const totalAmount = basePrice + addonTotal;
        const finalAmount = totalAmount - vipDiscount;
        
        // Random status based on date
        let status = 'confirmed';
        if (dayOffset === 0) {
          status = statuses[Math.floor(Math.random() * statuses.length)];
        }
        
        const booking = await Booking.create({
          user: user._id,
          parkingType: parkingType._id,
          checkInTime: checkInDate,
          checkOutTime: checkOutDate,
          driverName: bookingData.driverName,
          phone: bookingData.phone,
          email: bookingData.email,
          licensePlate: bookingData.licensePlate,
          passengerCount: bookingData.passengerCount,
          luggageCount: bookingData.luggageCount,
          addonServices: bookingData.addonServices,
          totalAmount: totalAmount,
          discountAmount: 0,
          finalAmount: finalAmount,
          isVIP: user.isVIP,
          vipDiscount: vipDiscount,
          status: status,
          paymentStatus: status === 'cancelled' ? 'refunded' : 'paid',
          paymentMethod: 'cash',
          isManualBooking: false
        });
        
        console.log(`📋 Created booking: ${booking.bookingNumber} - ${bookingData.licensePlate} - ${status}`);
      }
    }
    
    console.log('🎉 Sample data created successfully!');
    
    // Show summary
    const totalBookings = await Booking.countDocuments();
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    const checkedInBookings = await Booking.countDocuments({ status: 'checked-in' });
    const checkedOutBookings = await Booking.countDocuments({ status: 'checked-out' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
    
    console.log('\n📊 Booking Summary:');
    console.log(`   Total bookings: ${totalBookings}`);
    console.log(`   Confirmed: ${confirmedBookings}`);
    console.log(`   Checked-in: ${checkedInBookings}`);
    console.log(`   Checked-out: ${checkedOutBookings}`);
    console.log(`   Cancelled: ${cancelledBookings}`);
    
    // Show sample booking numbers
    const recentBookings = await Booking.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('parkingType', 'name');
    
    console.log('\n📋 Recent Booking Numbers:');
    recentBookings.forEach(booking => {
      console.log(`   ${booking.bookingNumber} - ${booking.licensePlate} - ${booking.parkingType.name} - ${booking.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
};

// Test the new logic with sample data
const testNewLogicWithSampleData = async () => {
  try {
    console.log('\n🧪 Testing new logic with sample data...');
    
    // Test 1: Check booking numbers format
    const bookings = await Booking.find({}).limit(5);
    console.log('\n📋 Sample Booking Numbers:');
    bookings.forEach(booking => {
      const datePart = booking.bookingNumber.substring(0, 8);
      const licensePart = booking.bookingNumber.substring(8);
      console.log(`   ${booking.bookingNumber} (Date: ${datePart}, License: ${licensePart})`);
    });
    
    // Test 2: Check status distribution
    const statusCounts = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📊 Status Distribution:');
    statusCounts.forEach(status => {
      console.log(`   ${status._id}: ${status.count}`);
    });
    
    // Test 3: Check that no bookings have pending status
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    if (pendingBookings === 0) {
      console.log('✅ No bookings with pending status (as expected)');
    } else {
      console.log(`⚠️  Found ${pendingBookings} bookings with pending status`);
    }
    
    console.log('\n🎉 New logic test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing new logic:', error);
  }
};

// Main execution
const main = async () => {
  console.log('🚀 Starting Sample Data Creation with New Logic');
  console.log('==============================================');
  
  await connectDB();
  await createSampleData();
  await testNewLogicWithSampleData();
  
  console.log('==============================================');
  console.log('✅ Sample data creation completed!');
  
  // Close database connection
  await mongoose.connection.close();
  console.log('📦 Database connection closed');
};

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createSampleData, testNewLogicWithSampleData }; 